import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Express } from 'express';
import type { HostServices, ModuleInstance } from '@moduleforge/host-types';
import { runMigrations } from './sqlite-db';
import { createFakeHost } from './fake-host';
import { createModule as createPaymentMethod } from '../payment-method/src/index';
import { createModule as createInvoice } from '../invoice/src/index';
import { createModule as createNotificationAdapter } from '../notification-adapter/src/index';

const dir = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));

/** A host app that mounts the three reference modules at their module.json apiPrefix. */
export async function createDemoHost() {
  const fake = createFakeHost({ PAYMENT_PROVIDER: 'mock' });
  const { host } = fake;
  const modules: { name: string; prefix?: string; make: (h: HostServices) => ModuleInstance }[] = [
    { name: 'payment-method', prefix: '/api/payment-methods', make: createPaymentMethod },
    { name: 'invoice', prefix: '/api/invoices', make: createInvoice },
    { name: 'notification-adapter', prefix: '/api/notification-adapter', make: createNotificationAdapter },
  ];
  const app: Express = express();
  for (const m of modules) {
    await runMigrations(host.db, dir(m.name));
    app.use(m.prefix!, m.make(host).router);
  }
  return { app, ...fake };
}
