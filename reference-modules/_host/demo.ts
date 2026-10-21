import { createDemoHost, DEMO_WEBHOOK_SECRET } from './demo-host';
import { signPayload, mockCompletedEvent } from '../payment-gateway/src/index';

const { app, events, sent, host } = await createDemoHost();
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const headers = { 'content-type': 'application/json', 'x-user-id': 'user_1' };
const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return r.json() as Promise<any>;
};

console.log('1. add payment method (mock token tok_visa_4242)');
const pm = await call('POST', '/api/payment-methods', { providerToken: 'tok_visa_4242' });
console.log('  ', pm);

console.log('2. create invoice');
const inv = await call('POST', '/api/invoices', {
  customerName: 'Acme Corp', taxPercent: 10,
  items: [{ description: 'Consulting', quantity: 2, unitPriceCents: 5000 }, { description: 'Setup', quantity: 1, unitPriceCents: 2500 }],
});
console.log('  ', { id: inv.id, number: inv.number, status: inv.status, totalCents: inv.totalCents });
await call('POST', `/api/invoices/${inv.id}/send`);

console.log('3. start checkout (mock provider) for the invoice');
const session = await call('POST', '/api/payment-gateway/checkout', { invoiceId: inv.id });
console.log('  ', { id: session.id, status: session.status, amountCents: session.amountCents, currency: session.currency, checkoutUrl: session.checkoutUrl });

console.log('4. simulated provider webhook (signed with the webhook secret) -> payment.received');
const [{ provider_session_id }] = await host.db.query<{ provider_session_id: string }>('SELECT provider_session_id FROM pg_sessions WHERE id = ?', [session.id]);
const raw = JSON.stringify(mockCompletedEvent({ eventId: 'evt_demo_1', providerSessionId: provider_session_id, amountCents: session.amountCents, currency: session.currency }));
const hook = (sig: string) => fetch(base + '/api/payment-gateway/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sig }, body: raw });
console.log('   unsigned/forged ->', (await hook('t=1,v1=00')).status);
console.log('   signed          ->', await (await hook(signPayload(raw, DEMO_WEBHOOK_SECRET))).json());
console.log('   replay          ->', await (await hook(signPayload(raw, DEMO_WEBHOOK_SECRET))).json());

console.log('5. invoice status now');
console.log('  ', (await call('GET', `/api/invoices/${inv.id}`)).status);

console.log('6. notifications sent via hostServices.notifications');
for (const n of sent) console.log(`   -> [${n.userId}] ${n.subject}`);

console.log('event log:', events.history.map((e) => e.type).join(' -> '));
server.close();
