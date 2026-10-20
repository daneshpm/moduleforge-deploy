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
  await fake.events.publish('payment.received', { invoiceId: inv.id, amountCents: inv.totalCents });
  assert.equal((await post(`/${inv.id}/void`)).status, 409);
});

test('payment.received marks paid and publishes invoice.paid; partial/unknown ignored', async () => {
  const inv = await (await post('', sample)).json();
  await fake.events.publish('payment.received', { invoiceId: inv.id, amountCents: 1 });
  assert.equal((await (await fetch(`${base}/${inv.id}`, { headers: h() })).json()).status, 'draft');
  await fake.events.publish('payment.received', { invoiceId: 'nope' });

  const before = fake.events.history.filter((e) => e.type === 'invoice.paid').length;
  await fake.events.publish('payment.received', { invoiceId: inv.id, amountCents: inv.totalCents });
  const paid = await (await fetch(`${base}/${inv.id}`, { headers: h() })).json();
  assert.equal(paid.status, 'paid');
  assert.ok(paid.paidAt);
  assert.equal(fake.events.history.filter((e) => e.type === 'invoice.paid').length, before + 1);
  // idempotent
  await fake.events.publish('payment.received', { invoiceId: inv.id, amountCents: inv.totalCents });
  assert.equal(fake.events.history.filter((e) => e.type === 'invoice.paid').length, before + 1);
});
