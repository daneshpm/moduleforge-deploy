import { Router, json, raw } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { CreateModule, HostServices, ModuleInstance } from '@moduleforge/host-types';
import { getProvider } from './providers';
import type { CheckoutProvider } from './providers';
import { verifySignature } from './signature';

export { signPayload, verifySignature, SIGNATURE_TOLERANCE_SECONDS } from './signature';
export { createStripeProvider, mockProvider, mockCompletedEvent } from './providers';
export type { CheckoutProvider } from './providers';

type Status = 'pending' | 'succeeded' | 'failed' | 'rejected';
interface SessionRow {
  id: string; user_id: string; provider: string; provider_session_id: string | null; reference: string; invoice_id: string | null;
  amount_cents: number; currency: string; status: Status; checkout_url: string | null; provider_payment_id: string | null;
  created_at: string; updated_at: string;
}
const present = (r: SessionRow) => ({
  id: r.id, provider: r.provider, reference: r.reference, invoiceId: r.invoice_id, amountCents: r.amount_cents, currency: r.currency,
  status: r.status, checkoutUrl: r.checkout_url, createdAt: r.created_at, updatedAt: r.updated_at,
});

export interface GatewayOptions {
  /** Override the provider adapter (tests). Default: chosen by config PAYMENT_GATEWAY_PROVIDER. */
  provider?: CheckoutProvider;
  /** Clock in unix seconds (tests). */
  now?: () => number;
}

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

const isUnique = (e: unknown) => /UNIQUE|constraint/i.test(String((e as Error)?.message));

export function createPaymentGateway(host: HostServices, opts: GatewayOptions = {}): ModuleInstance {
  const cfg = host.config;
  const provider = opts.provider ?? getProvider(cfg.PAYMENT_GATEWAY_PROVIDER, cfg);
  const nowSec = opts.now ?? (() => Math.floor(Date.now() / 1000));
  const router = Router();

  // ---- Webhook: registered BEFORE json parsing and user auth. Authenticated by signature only. ----
  router.post('/webhook', raw({ type: () => true, limit: '1mb' }), wrap(async (req, res) => {
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body)) {
      // A host-level express.json() ran first and destroyed the raw bytes; signatures cannot be checked.
      return void res.status(500).json({ error: 'webhook route requires the raw request body (do not apply express.json() before it)' });
    }
    const secret = cfg.STRIPE_WEBHOOK_SECRET ?? '';
    const sig = verifySignature(body, req.header('stripe-signature'), secret, nowSec());
    if (!sig.ok) return void res.status(400).json({ error: `invalid signature (${sig.reason})` });

    let parsed: any;
    try { parsed = JSON.parse(body.toString('utf8')); } catch { return void res.status(400).json({ error: 'invalid JSON' }); }
    const ev = provider.normalizeEvent(parsed);
    if (!ev) return void res.json({ received: true, outcome: 'ignored_event_type' });

    const [session] = await host.db.query<SessionRow>('SELECT * FROM pg_sessions WHERE provider_session_id = ? AND provider = ?', [ev.providerSessionId, provider.name]);
    if (!session) return void res.json({ received: true, outcome: 'unknown_session' });

    // Idempotency: claim the event id first; a replay hits the primary key and does nothing.
    try {
      await host.db.exec('INSERT INTO pg_webhook_events (event_id, provider, type, session_id, received_at) VALUES (?,?,?,?,?)',
        [ev.eventId, provider.name, ev.kind, session.id, new Date().toISOString()]);
    } catch (e) {
      if (isUnique(e)) return void res.json({ received: true, outcome: 'replay' });
      throw e;
    }

    const setOutcome = (o: string) => host.db.exec('UPDATE pg_webhook_events SET outcome = ? WHERE event_id = ?', [o, ev.eventId]);
    const nextStatus: Status = ev.kind === 'succeeded' ? 'succeeded' : 'failed';
    let finalStatus: Status = nextStatus;
    let rejection: string | null = null;
    if (ev.kind === 'succeeded') {
      // Never trust the webhook alone: amount and currency must equal what we stored when the session was created.
      if (ev.amountCents !== session.amount_cents) rejection = 'amount_mismatch';
      else if ((ev.currency ?? '').toUpperCase() !== session.currency.toUpperCase()) rejection = 'currency_mismatch';
      if (rejection) finalStatus = 'rejected';
    }

    // Atomic pending -> final transition; if another event already settled the session, do nothing.
    const upd = await host.db.exec(
      'UPDATE pg_sessions SET status = ?, provider_payment_id = COALESCE(?, provider_payment_id), updated_at = ? WHERE id = ? AND status = ?',
      [finalStatus, ev.providerPaymentId ?? null, new Date().toISOString(), session.id, 'pending']);
    if (upd.changes !== 1) {
      await setOutcome('session_already_settled');
      return void res.json({ received: true, outcome: 'session_already_settled' });
    }

    const base = {
      userId: session.user_id, reference: session.reference, invoiceId: session.invoice_id ?? undefined, sessionId: session.id,
      provider: provider.name, providerPaymentId: ev.providerPaymentId,
    };
    try {
      if (finalStatus === 'succeeded') {
        const paid = { ...base, amountCents: session.amount_cents, currency: session.currency };
        await host.events.publish('payment.received', paid);
        await host.events.publish('payment_gateway.payment_succeeded', paid);
      } else {
        const failed = { ...base, amountCents: session.amount_cents, currency: session.currency, reason: rejection ?? ev.reason ?? 'failed' };
        await host.events.publish('payment.failed', failed);
        await host.events.publish('payment_gateway.payment_failed', failed);
      }
    } catch (e) {
      // Publishing failed: release the claim and the session so the provider's retry can be processed.
      await host.db.exec("UPDATE pg_sessions SET status = 'pending' WHERE id = ?", [session.id]);
      await host.db.exec('DELETE FROM pg_webhook_events WHERE event_id = ?', [ev.eventId]);
      throw e;
    }
    const outcome = rejection ?? finalStatus;
    await setOutcome(outcome);
    res.json({ received: true, outcome });
  }));

  // ---- Everything below is authenticated user API. ----
  router.use(json());
  router.use((req, res, next) => {
    const user = host.currentUser(req);
    if (!user) return void res.status(401).json({ error: 'unauthenticated' });
    res.locals.user = user;
    next();
  });

  router.post('/checkout', wrap(async (req, res) => {
    const userId: string = res.locals.user.id;
    const b = req.body ?? {};
    let amountCents: number, currency: string, reference: string, invoiceId: string | undefined, description: string;

    if (b.invoiceId !== undefined) {
      if (typeof b.invoiceId !== 'string' || !b.invoiceId) return void res.status(400).json({ error: 'invoiceId must be a string' });
      // Amount comes from the invoice owned by the CURRENT user, never from the client.
      // Read-only lookup through the shared host db (no import of the invoice module).
      let inv: { id: string; number: string; currency: string; status: string; total_cents: number } | undefined;
      try {
        [inv] = await host.db.query('SELECT id, number, currency, status, total_cents FROM inv_invoices WHERE id = ? AND user_id = ?', [b.invoiceId, userId]);
      } catch {
        return void res.status(400).json({ error: 'invoice lookup unavailable; pass amountCents, currency and reference instead' });
      }
      if (!inv) return void res.status(404).json({ error: 'invoice not found' });
      if (inv.status !== 'draft' && inv.status !== 'sent') return void res.status(409).json({ error: `invoice is ${inv.status}` });
      if (b.amountCents !== undefined && b.amountCents !== inv.total_cents) return void res.status(400).json({ error: 'amountCents does not match the invoice total' });
      if (b.currency !== undefined && String(b.currency).toUpperCase() !== inv.currency.toUpperCase()) return void res.status(400).json({ error: 'currency does not match the invoice' });
      amountCents = inv.total_cents; currency = inv.currency.toUpperCase(); reference = inv.id; invoiceId = inv.id;
      description = `Invoice ${inv.number}`;
    } else {
      if (!Number.isSafeInteger(b.amountCents) || b.amountCents <= 0) return void res.status(400).json({ error: 'amountCents must be a positive integer' });
      if (typeof b.currency !== 'string' || !/^[A-Za-z]{3}$/.test(b.currency)) return void res.status(400).json({ error: 'currency must be a 3-letter code' });
      if (typeof b.reference !== 'string' || !b.reference.trim() || b.reference.length > 200) return void res.status(400).json({ error: 'reference is required' });
      amountCents = b.amountCents; currency = b.currency.toUpperCase(); reference = b.reference.trim();
      description = typeof b.description === 'string' && b.description.trim() ? b.description.trim().slice(0, 200) : `Payment ${reference}`;
    }

    const successUrl = cfg.PAYMENT_SUCCESS_URL, cancelUrl = cfg.PAYMENT_CANCEL_URL;
    if (!successUrl || !cancelUrl) return void res.status(500).json({ error: 'PAYMENT_SUCCESS_URL / PAYMENT_CANCEL_URL are not configured' });

    const id = crypto.randomUUID();
    let result;
    try {
      result = await provider.createCheckoutSession({ sessionId: id, userId, reference, invoiceId, amountCents, currency, description, successUrl, cancelUrl });
    } catch (e) {
      return void res.status(502).json({ error: (e as Error).message });
    }
    const now = new Date().toISOString();
    await host.db.exec(
      'INSERT INTO pg_sessions (id,user_id,provider,provider_session_id,reference,invoice_id,amount_cents,currency,status,checkout_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, userId, provider.name, result.providerSessionId, reference, invoiceId ?? null, amountCents, currency, 'pending', result.url, now, now]);
    const [row] = await host.db.query<SessionRow>('SELECT * FROM pg_sessions WHERE id = ?', [id]);
    res.status(201).json(present(row));
  }));

  router.get('/sessions', wrap(async (_req, res) => {
    const rows = await host.db.query<SessionRow>('SELECT * FROM pg_sessions WHERE user_id = ? ORDER BY created_at DESC', [res.locals.user.id]);
    res.json(rows.map(present));
  }));

  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  return { router, dispose() {} };
}

export const createModule: CreateModule = (host) => createPaymentGateway(host);
