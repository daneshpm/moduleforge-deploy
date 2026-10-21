import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createFakeHost } from '../../_host/fake-host';
import { runMigrations } from '../../_host/sqlite-db';
import { createModule as createInvoice } from '../../invoice/src/index';
import { createPaymentGateway, createStripeProvider, mockProvider, mockCompletedEvent, signPayload, verifySignature } from '../src/index';
import { buildCheckoutForm } from '../src/providers/stripe';

const SECRET = 'whsec_test_secret';
const config = {
  PAYMENT_GATEWAY_PROVIDER: 'mock', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_SECRET_KEY: 'sk_test_fake',
  PAYMENT_SUCCESS_URL: 'https://app.test/ok', PAYMENT_CANCEL_URL: 'https://app.test/cancel',
};
const fake = createFakeHost(config);
let server: Server, base: string;
let clock = Math.floor(Date.now() / 1000);

const h = (user = 'u1') => ({ 'content-type': 'application/json', 'x-user-id': user });
const post = (path: string, body: unknown, user?: string) => fetch(base + path, { method: 'POST', headers: h(user), body: JSON.stringify(body) });
const get = (path: string, user = 'u1') => fetch(base + path, { headers: h(user) });
const mkInvoice = async (user = 'u1', unit = 5000) =>
  (await (await post('/api/invoices', { customerName: 'Acme', items: [{ description: 'Work', quantity: 2, unitPriceCents: unit }] }, user)).json()) as any;
const checkout = async (body: unknown, user = 'u1') => { const r = await post('/api/payment-gateway/checkout', body, user); return { status: r.status, json: (await r.json()) as any }; };
const sendWebhook = (event: unknown, opts: { secret?: string; t?: number; body?: string; header?: string } = {}) => {
  const raw = opts.body ?? JSON.stringify(event);
  return fetch(base + '/api/payment-gateway/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': opts.header ?? signPayload(raw, opts.secret ?? SECRET, opts.t ?? clock) }, body: raw,
  });
};
const paidEvent = (s: any, over: Record<string, unknown> = {}, eventId = `evt_${crypto.randomUUID()}`) =>
  mockCompletedEvent({ eventId, providerSessionId: s.providerSessionId, amountCents: s.amountCents, currency: s.currency, ...over });
/** Start a checkout and also return the provider session id (not exposed by the API) from the db. */
async function startSession(body: unknown, user = 'u1') {
  const r = await checkout(body, user);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const [row] = await fake.host.db.query<{ provider_session_id: string }>('SELECT provider_session_id FROM pg_sessions WHERE id = ?', [r.json.id]);
  return { ...r.json, providerSessionId: row.provider_session_id };
}
const published = (type: string) => fake.events.history.filter((e) => e.type === type);
const statusOf = async (inv: any, user = 'u1') => ((await (await get(`/api/invoices/${inv.id}`, user)).json()) as any).status;

before(async () => {
  const here = (m: string) => fileURLToPath(new URL(`../../${m}`, import.meta.url));
  await runMigrations(fake.host.db, here('invoice'));
  await runMigrations(fake.host.db, here('payment-gateway'));
  const gw = createPaymentGateway(fake.host, { now: () => clock });
  // Host contract: the gateway is mounted FIRST, with no global express.json() in front of it.
  server = express().use('/api/payment-gateway', gw.router).use('/api/invoices', createInvoice(fake.host).router).listen(0);
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => server.close());

test('signature: valid, invalid, tampered, stale, malformed', () => {
  const body = '{"a":1}';
  const now = 1_700_000_000;
  const good = signPayload(body, SECRET, now);
  assert.deepEqual(verifySignature(body, good, SECRET, now), { ok: true });
  assert.deepEqual(verifySignature(body, good, SECRET, now + 299), { ok: true });
  assert.deepEqual(verifySignature(body, signPayload(body, 'other', now), SECRET, now), { ok: false, reason: 'mismatch' });
  assert.deepEqual(verifySignature('{"a":2}', good, SECRET, now), { ok: false, reason: 'mismatch' });
  assert.deepEqual(verifySignature(body, good, SECRET, now + 301), { ok: false, reason: 'stale' });
  assert.deepEqual(verifySignature(body, good, SECRET, now - 301), { ok: false, reason: 'stale' });
  assert.deepEqual(verifySignature(body, undefined, SECRET, now), { ok: false, reason: 'missing' });
  assert.deepEqual(verifySignature(body, good, '', now), { ok: false, reason: 'missing' });
  assert.equal(verifySignature(body, 'garbage', SECRET, now).ok, false);
  assert.equal(verifySignature(body, `t=${now},v1=zz`, SECRET, now).ok, false);
  // timestamp altered but old signature kept
  assert.equal(verifySignature(body, good.replace(`t=${now}`, `t=${now + 1}`), SECRET, now).ok, false);
});

test('webhook rejects bad signature, stale timestamp and tampered body (400, nothing published)', async () => {
  const inv = await mkInvoice();
  const s = await startSession({ invoiceId: inv.id });
  const before = published('payment.received').length;
  const ev = paidEvent(s);
  assert.equal((await sendWebhook(ev, { secret: 'wrong' })).status, 400);
  assert.equal((await sendWebhook(ev, { t: clock - 301 })).status, 400);
  const raw = JSON.stringify(ev);
  const tampered = raw.replace(String(s.amountCents), '1');
  assert.equal((await sendWebhook(ev, { body: tampered, header: signPayload(raw, SECRET, clock) })).status, 400);
  assert.equal((await fetch(base + '/api/payment-gateway/webhook', { method: 'POST', body: raw })).status, 400);
  assert.equal(published('payment.received').length, before);
  assert.equal(await statusOf(inv), 'draft');
});

test('valid webhook publishes payment.received + payment_gateway.payment_succeeded; replay is a no-op', async () => {
  const inv = await mkInvoice();
  const s = await startSession({ invoiceId: inv.id });
  assert.equal(s.status, 'pending');
  assert.equal(s.amountCents, 10000);
  const ev = paidEvent(s, {}, 'evt_replay_1');
  const r1 = await sendWebhook(ev);
  assert.equal(r1.status, 200);
  assert.equal(((await r1.json()) as any).outcome, 'succeeded');
  const rec = published('payment.received').at(-1)!.payload as any;
  assert.deepEqual(rec, { userId: 'u1', reference: inv.id, invoiceId: inv.id, sessionId: s.id, provider: 'mock', providerPaymentId: 'pi_mock_evt_replay_1', amountCents: 10000, currency: 'USD' });
  assert.equal(published('payment_gateway.payment_succeeded').at(-1)!.payload && (published('payment_gateway.payment_succeeded').at(-1)!.payload as any).sessionId, s.id);
  assert.equal(await statusOf(inv), 'paid'); // invoice module consumed payment.received through the bus only
  const count = fake.events.history.length;
  const r2 = await sendWebhook(ev);
  assert.equal(((await r2.json()) as any).outcome, 'replay');
  assert.equal(fake.events.history.length, count, 'replay must publish nothing');
  // a DIFFERENT event id for an already settled session must not pay twice either
  const r3 = await sendWebhook(paidEvent(s));
  assert.equal(((await r3.json()) as any).outcome, 'session_already_settled');
  assert.equal(fake.events.history.length, count);
  const [row] = await get('/api/payment-gateway/sessions').then((r) => r.json() as Promise<any[]>).then((l) => l.filter((x) => x.id === s.id));
  assert.equal(row.status, 'succeeded');
});

test('amount and currency mismatch are rejected, never paid', async () => {
  const inv = await mkInvoice();
  const s = await startSession({ invoiceId: inv.id });
  const before = published('payment.received').length;
  const r = await sendWebhook(paidEvent(s, { amountCents: 1 }));
  assert.equal(((await r.json()) as any).outcome, 'amount_mismatch');
  assert.equal(published('payment.received').length, before);
  assert.equal((published('payment.failed').at(-1)!.payload as any).reason, 'amount_mismatch');
  assert.equal(await statusOf(inv), 'draft');

  const inv2 = await mkInvoice();
  const s2 = await startSession({ invoiceId: inv2.id });
  const r2 = await sendWebhook(paidEvent(s2, { currency: 'eur' }));
  assert.equal(((await r2.json()) as any).outcome, 'currency_mismatch');
  assert.equal(await statusOf(inv2), 'draft');
});

test('unknown session is ignored (200, nothing published)', async () => {
  const count = fake.events.history.length;
  const r = await sendWebhook(mockCompletedEvent({ eventId: 'evt_x', providerSessionId: 'cs_nope', amountCents: 100, currency: 'usd' }));
  assert.equal(r.status, 200);
  assert.equal(((await r.json()) as any).outcome, 'unknown_session');
  assert.equal(fake.events.history.length, count);
  // unrelated event types are acknowledged and ignored
  const r2 = await sendWebhook({ id: 'evt_y', type: 'customer.created', data: { object: { id: 'cus_1' } } });
  assert.equal(((await r2.json()) as any).outcome, 'ignored_event_type');
});

test('failed / expired checkout publishes payment failed', async () => {
  const s = await startSession({ amountCents: 2500, currency: 'usd', reference: 'order-77' });
  const r = await sendWebhook({ id: 'evt_exp', type: 'checkout.session.expired', data: { object: { id: s.providerSessionId } } });
  assert.equal(((await r.json()) as any).outcome, 'failed');
  const f = published('payment_gateway.payment_failed').at(-1)!.payload as any;
  assert.equal(f.reference, 'order-77');
  assert.equal(f.reason, 'expired');
  assert.ok(published('payment.failed').length >= 1);
});

test('checkout without invoice: validation and reference carried to payment.received', async () => {
  assert.equal((await checkout({ amountCents: 0, currency: 'USD', reference: 'r' })).status, 400);
  assert.equal((await checkout({ amountCents: 10.5, currency: 'USD', reference: 'r' })).status, 400);
  assert.equal((await checkout({ amountCents: 100, currency: 'DOLLARS', reference: 'r' })).status, 400);
  assert.equal((await checkout({ amountCents: 100, currency: 'USD' })).status, 400);
  const s = await startSession({ amountCents: 4200, currency: 'usd', reference: 'sub-1' });
  assert.equal(s.currency, 'USD');
  await sendWebhook(paidEvent(s));
  const rec = published('payment.received').at(-1)!.payload as any;
  assert.equal(rec.reference, 'sub-1');
  assert.equal(rec.invoiceId, undefined);
});

test('per-user scoping: sessions are private, invoices of another user cannot be paid for', async () => {
  const invA = await mkInvoice('userA');
  assert.equal((await checkout({ invoiceId: invA.id }, 'userB')).status, 404);
  const sA = await startSession({ invoiceId: invA.id }, 'userA');
  const listB = (await (await get('/api/payment-gateway/sessions', 'userB')).json()) as any[];
  assert.equal(listB.some((x) => x.id === sA.id), false);
  const listA = (await (await get('/api/payment-gateway/sessions', 'userA')).json()) as any[];
  assert.deepEqual(listA.map((x) => x.id), [sA.id]);
  assert.equal((await fetch(base + '/api/payment-gateway/sessions')).status, 401);
  assert.equal((await checkout({ invoiceId: invA.id, amountCents: 1 }, 'userA')).status, 400); // client amounts are not trusted
  // payment.received carries the session owner, so it cannot pay another user's invoice
  await sendWebhook(paidEvent(sA));
  assert.equal(await statusOf(invA, 'userA'), 'paid');
  assert.equal((await checkout({ invoiceId: invA.id }, 'userA')).status, 409); // already paid
});

test('webhook with host-parsed body is refused clearly', async () => {
  const app = express().use(express.json()).use('/gw', createPaymentGateway(createFakeHost(config).host).router);
  const srv = app.listen(0);
  try {
    const raw = JSON.stringify({ id: 'evt' });
    const r = await fetch(`http://127.0.0.1:${(srv.address() as any).port}/gw/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signPayload(raw, SECRET) }, body: raw });
    assert.equal(r.status, 500);
  } finally { srv.close(); }
});

test('stripe adapter: request shape against a mocked fetch (no real network)', async () => {
  const calls: any[] = [];
  const logs: string[] = [];
  const origLog = console.log, origErr = console.error;
  console.log = (...a: unknown[]) => void logs.push(a.join(' ')); console.error = console.log;
  const stripe = createStripeProvider({
    secretKey: 'sk_test_SUPERSECRET',
    fetch: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }) }; },
  });
  try {
    const res = await stripe.createCheckoutSession({
      sessionId: 'sess-1', userId: 'u1', reference: 'inv-9', invoiceId: 'inv-9', amountCents: 13750, currency: 'USD',
      description: 'Invoice INV-0009', successUrl: 'https://app.test/ok', cancelUrl: 'https://app.test/cancel',
    });
    assert.deepEqual(res, { providerSessionId: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
  } finally { console.log = origLog; console.error = origErr; }
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, 'Bearer sk_test_SUPERSECRET');
  assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(init.headers['Idempotency-Key'], 'sess-1');
  const form = new URLSearchParams(init.body);
  assert.equal(form.get('mode'), 'payment');
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '13750');
  assert.equal(form.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(form.get('line_items[0][quantity]'), '1');
  assert.equal(form.get('metadata[userId]'), 'u1');
  assert.equal(form.get('metadata[reference]'), 'inv-9');
  assert.equal(form.get('payment_intent_data[metadata][userId]'), 'u1');
  assert.equal(form.get('success_url'), 'https://app.test/ok');
  assert.ok(!init.body.includes('SUPERSECRET'), 'secret must not be in the body');
  assert.ok(!logs.join('\n').includes('SUPERSECRET'), 'secret must not be logged');
  assert.ok(buildCheckoutForm({ sessionId: 's', userId: 'u', reference: 'r', amountCents: 1, currency: 'EUR', description: 'd', successUrl: 'a', cancelUrl: 'b' }).get('metadata[invoiceId]') === null);
});

test('stripe adapter: API errors do not leak the secret; normalizes events', async () => {
  const stripe = createStripeProvider({
    secretKey: 'sk_test_SUPERSECRET',
    fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid API Key provided: sk_test_****' } }) }),
  });
  await assert.rejects(
    stripe.createCheckoutSession({ sessionId: 's', userId: 'u', reference: 'r', amountCents: 100, currency: 'USD', description: 'd', successUrl: 'a', cancelUrl: 'b' }),
    (e: Error) => /401/.test(e.message) && !e.message.includes('SUPERSECRET'),
  );
  const paid = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 500, currency: 'usd', payment_intent: 'pi_1' } } };
  assert.deepEqual(stripe.normalizeEvent(paid), { eventId: 'evt_1', kind: 'succeeded', providerSessionId: 'cs_1', amountCents: 500, currency: 'USD', providerPaymentId: 'pi_1' });
  assert.equal(stripe.normalizeEvent({ ...paid, data: { object: { ...paid.data.object, payment_status: 'unpaid' } } }), null);
  assert.equal(stripe.normalizeEvent({ id: 'e', type: 'charge.refunded', data: { object: { id: 'x' } } }), null);
  assert.equal(mockProvider.name, 'mock');
});
