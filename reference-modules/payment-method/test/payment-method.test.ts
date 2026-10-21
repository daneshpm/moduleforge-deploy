import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createFakeHost } from '../../_host/fake-host';
import { runMigrations } from '../../_host/sqlite-db';
import { createModule } from '../src/index';

let server: Server, base: string;
const fake = createFakeHost();
const h = (user = 'u1') => ({ 'content-type': 'application/json', 'x-user-id': user });

before(async () => {
  await runMigrations(fake.host.db, fileURLToPath(new URL('..', import.meta.url)));
  const app = express().use('/pm', createModule(fake.host).router);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as any).port}/pm`;
});
after(() => server.close());

test('requires auth', async () => {
  assert.equal((await fetch(base)).status, 401);
});

test('add, list (no token leaked), remove, with events', async () => {
  const r = await fetch(base, { method: 'POST', headers: h(), body: JSON.stringify({ providerToken: 'tok_visa_4242' }) });
  assert.equal(r.status, 201);
  const pm = await r.json();
  assert.equal(pm.last4, '4242');
  assert.equal(pm.brand, 'visa');
  assert.equal('token' in pm, false);

  const list = await (await fetch(base, { headers: h() })).json();
  assert.equal(list.length, 1);
  assert.equal((await (await fetch(base, { headers: h('other') })).json()).length, 0);

  assert.equal((await fetch(`${base}/${pm.id}`, { method: 'DELETE', headers: h('other') })).status, 404);
  assert.equal((await fetch(`${base}/${pm.id}`, { method: 'DELETE', headers: h() })).status, 204);
  assert.deepEqual(fake.events.history.map((e) => e.type), ['payment_method.added', 'payment_method.removed']);
});

test('rejects raw card data and bad tokens', async () => {
  const raw = await fetch(base, { method: 'POST', headers: h(), body: JSON.stringify({ number: '4242424242424242', cvc: '123' }) });
  assert.equal(raw.status, 400);
  const bad = await fetch(base, { method: 'POST', headers: h(), body: JSON.stringify({ providerToken: 'nope' }) });
  assert.equal(bad.status, 400);
});
