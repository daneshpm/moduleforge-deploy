import type { CheckoutProvider, CheckoutRequest, NormalizedEvent } from './types';

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export interface StripeOptions {
  secretKey: string;
  fetch?: FetchLike;
  apiBase?: string;
}

/** Form-encode the body Stripe expects for POST /v1/checkout/sessions. Exported for tests. */
export function buildCheckoutForm(req: CheckoutRequest): URLSearchParams {
  const f = new URLSearchParams();
  f.set('mode', 'payment');
  f.set('success_url', req.successUrl);
  f.set('cancel_url', req.cancelUrl);
  f.set('client_reference_id', req.reference);
  f.set('line_items[0][quantity]', '1');
  f.set('line_items[0][price_data][currency]', req.currency.toLowerCase());
  f.set('line_items[0][price_data][unit_amount]', String(req.amountCents));
  f.set('line_items[0][price_data][product_data][name]', req.description);
  const meta: Record<string, string> = { userId: req.userId, reference: req.reference, sessionId: req.sessionId };
  if (req.invoiceId) meta.invoiceId = req.invoiceId;
  for (const [k, v] of Object.entries(meta)) {
    f.set(`metadata[${k}]`, v);
    f.set(`payment_intent_data[metadata][${k}]`, v);
  }
  return f;
}

/** Stripe adapter using plain fetch against the REST API (no SDK). */
export function createStripeProvider(opts: StripeOptions): CheckoutProvider {
  const doFetch: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));
  const base = opts.apiBase ?? 'https://api.stripe.com';
  return {
    name: 'stripe',
    async createCheckoutSession(req) {
      if (!opts.secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
      const res = await doFetch(`${base}/v1/checkout/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': req.sessionId,
        },
        body: buildCheckoutForm(req).toString(),
      });
      const data = await res.json().catch(() => ({}));
      // Error text comes from Stripe's response; the secret key is never included in messages.
      if (!res.ok) throw new Error(`stripe checkout failed (${res.status}): ${data?.error?.message ?? 'unknown error'}`);
      if (typeof data.id !== 'string' || typeof data.url !== 'string') throw new Error('stripe checkout returned an unexpected response');
      return { providerSessionId: data.id, url: data.url };
    },
    normalizeEvent: normalizeStripeEvent,
  };
}

/** checkout.session.completed (paid) -> succeeded; expired / async_payment_failed -> failed. Shared with the mock. */
export function normalizeStripeEvent(event: any): NormalizedEvent | null {
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') return null;
  const o = event.data?.object;
  if (!o || typeof o.id !== 'string') return null;
  const common = {
    eventId: event.id,
    providerSessionId: o.id,
    amountCents: Number.isSafeInteger(o.amount_total) ? o.amount_total : undefined,
    currency: typeof o.currency === 'string' ? o.currency.toUpperCase() : undefined,
    providerPaymentId: typeof o.payment_intent === 'string' ? o.payment_intent : undefined,
  };
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (o.payment_status !== 'paid') return null; // not paid yet (async methods): wait for async_payment_succeeded
      return { ...common, kind: 'succeeded' };
    case 'checkout.session.async_payment_failed':
      return { ...common, kind: 'failed', reason: 'async_payment_failed' };
    case 'checkout.session.expired':
      return { ...common, kind: 'failed', reason: 'expired' };
    default:
      return null;
  }
}
