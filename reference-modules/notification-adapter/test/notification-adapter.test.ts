import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from '../../_host/fake-host';
import { createModule } from '../src/index';

test('turns events into notifications via host.notifications', async () => {
  const { host, sent } = createFakeHost();
  const mod = createModule(host);
  await host.events.publish('invoice.paid', { userId: 'u1', number: 'INV-0001', totalCents: 13750, currency: 'USD' });
  await host.events.publish('payment_method.added', { userId: 'u1', brand: 'visa', last4: '4242' });
  await host.events.publish('invoice.created', { number: 'x' }); // no userId -> skipped
  await host.events.publish('something.else', {});
  assert.deepEqual(sent.map((n) => n.subject), ['Invoice INV-0001 paid', 'Payment method added']);
  assert.match(sent[0].body, /137\.50 USD/);

  mod.dispose();
  await host.events.publish('invoice.paid', { userId: 'u1', number: 'INV-0002', totalCents: 1, currency: 'USD' });
  assert.equal(sent.length, 2);
});
