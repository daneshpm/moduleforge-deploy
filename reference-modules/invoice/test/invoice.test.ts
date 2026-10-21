import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createFakeHost } from '../../_host/fake-host';
import { runMigrations } from '../../_host/sqlite-db';
import { createModule } from '../src/index';
import { computeTotals } from '../src/totals';

let server: Server, base: string;
const fake = createFakeHost();
const h = (user = 'u1') => ({ 'content-type': 'application/json', 'x-user-id': user });
const post = (path: string, body?: unknown, user?: string) =>
  fetch(base + path, { method: 'POST', headers: h(user), body: body ? JSON.stringify(body) : undefined });
const pay = (inv: any, over: Record<string, unknown> = {}, user = 'u1') =>
  fake.events.publish('payment.received', { invoiceId: inv.id, userId: user, currency: inv.currency, amountCents: inv.totalCents, ...over });
const statusOf = async (inv: any) => (await (await fetch(`${base}/${inv.id}`, { headers: h() })).json()).status;
const sample = { customerName: 'Acme', taxPercent: 10, items: [{ description: 'Work', quantity: 2, unitPriceCents: 5000 }, { description: 'Setup', quantity: 1, unitPriceCents: 2500 }] };

before(async () => {
  await runMigrations(fake.host.db, fileURLToPath(new URL('..', import.meta.url)));
  server = express().use('/inv', createModule(fake.host).router).listen(0);
  base = `http://127.0.0.1:${(server.address() as any).port}/inv`;
});
after(() => server.close());

test('computeTotals', () => {
  assert.deepEqual(computeTotals(sample.items, 10), { subtotalCents: 12500, taxCents: 1250, totalCents: 13750 });
  assert.equal(computeTotals([{ description: 'x', quantity: 1, unitPriceCents: 333 }], 7.5).taxCents, 25);
});

test('create / get / list with totals and invoice.created event', async () => {
  const r = await post('', sample);
  assert.equal(r.status, 201);
  const inv = await r.json();
  assert.equal(inv.status, 'draft');
  assert.equal(inv.totalCents, 13750);
  assert.equal(inv.items.length, 2);
  assert.equal(inv.number, 'INV-0001');
  assert.equal((await (await fetch(`${base}/${inv.id}`, { headers: h() })).json()).customerName, 'Acme');
  assert.equal((await (await fetch(base, { headers: h() })).json()).length, 1);
  assert.equal((await fetch(`${base}/${inv.id}`, { headers: h('other') })).status, 404);
  assert.ok(fake.events.history.some((e) => e.type === 'invoice.created'));
});

test('validation and auth', async () => {
  assert.equal((await post('', { customerName: 'x', items: [] })).status, 400);
  assert.equal((await fetch(base)).status, 401);
});

test('status transitions: send, void, no void after paid', async () => {
  const inv = await (await post('', sample)).json();
  assert.equal((await post(`/${inv.id}/send`)).status, 200);
  assert.equal((await post(`/${inv.id}/send`)).status, 409);
  await pay(inv);
  assert.equal((await post(`/${inv.id}/void`)).status, 409);
});

test('payment.received marks paid and publishes invoice.paid; partial/unknown ignored', async () => {
  const inv = await (await post('', sample)).json();
  await pay(inv, { amountCents: 1 });
  assert.equal(await statusOf(inv), 'draft');
  await fake.events.publish('payment.received', { invoiceId: 'nope' });

  const before = fake.events.history.filter((e) => e.type === 'invoice.paid').length;
  await pay(inv);
  const paid = await (await fetch(`${base}/${inv.id}`, { headers: h() })).json();
  assert.equal(paid.status, 'paid');
  assert.ok(paid.paidAt);
  assert.equal(fake.events.history.filter((e) => e.type === 'invoice.paid').length, before + 1);
  // idempotent
  await pay(inv);
  assert.equal(fake.events.history.filter((e) => e.type === 'invoice.paid').length, before + 1);
});

test('payment.received requires amountCents, currency and the invoice owner userId', async () => {
  const inv = await (await post('', sample)).json();
  const total = inv.totalCents;
  // missing amount (previously: marked paid!)
  await fake.events.publish('payment.received', { invoiceId: inv.id, userId: 'u1', currency: 'USD' });
  // missing / wrong currency
  await fake.events.publish('payment.received', { invoiceId: inv.id, userId: 'u1', amountCents: total });
  await pay(inv, { currency: 'EUR' });
  // wrong / missing owner
  await pay(inv, {}, 'someone-else');
  await fake.events.publish('payment.received', { invoiceId: inv.id, currency: 'USD', amountCents: total });
  // malformed amounts
  for (const amountCents of [-1, 1.5, '13750', Number.NaN, null, Number.MAX_SAFE_INTEGER + 2]) await pay(inv, { amountCents });
  assert.equal(await statusOf(inv), 'draft');
  await pay(inv);
  assert.equal(await statusOf(inv), 'paid');
});

test('amounts are bounded: quantity * unitPriceCents and totals stay safe integers', async () => {
  const big = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
  const r = await post('', { customerName: 'Big', items: [{ description: 'x', quantity: 2, unitPriceCents: big }] });
  assert.equal(r.status, 400);
  const r2 = await post('', { customerName: 'Big', items: [{ description: 'x', quantity: 1, unitPriceCents: big }, { description: 'y', quantity: 1, unitPriceCents: big }] });
  assert.equal(r2.status, 400);
  const r3 = await post('', { customerName: 'Big', items: [{ description: 'x', quantity: Number.MAX_SAFE_INTEGER, unitPriceCents: 2 }] });
  assert.equal(r3.status, 400);
});

test('invoice numbers are unique per user (DB constraint) and concurrent creates still succeed', async () => {
  const inv = await (await post('', sample, 'uniq')).json();
  await assert.rejects(() => fake.host.db.exec(
    "INSERT INTO inv_invoices (id,user_id,number,customer_name,currency,status,tax_percent,subtotal_cents,tax_cents,total_cents,created_at) VALUES ('dup','uniq',?,'x','USD','draft',0,1,0,1,'now')",
    [inv.number],
  ), /UNIQUE/i);
  const rs = await Promise.all([1, 2, 3, 4].map(() => post('', sample, 'race')));
  assert.deepEqual(rs.map((r) => r.status), [201, 201, 201, 201]);
  const nums = (await Promise.all(rs.map((r) => r.json()))).map((i: any) => i.number);
  assert.equal(new Set(nums).size, 4);
});
