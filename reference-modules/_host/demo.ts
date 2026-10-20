import { createDemoHost } from './demo-host';

const { app, events, sent } = await createDemoHost();
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

console.log('3. host emits payment.received (as a payment gateway webhook would)');
await events.publish('payment.received', { invoiceId: inv.id, userId: 'user_1', paymentMethodId: pm.id, amountCents: inv.totalCents, currency: inv.currency });

console.log('4. invoice status now');
console.log('  ', (await call('GET', `/api/invoices/${inv.id}`)).status);

console.log('5. notifications sent via hostServices.notifications');
for (const n of sent) console.log(`   -> [${n.userId}] ${n.subject}`);

console.log('event log:', events.history.map((e) => e.type).join(' -> '));
server.close();
