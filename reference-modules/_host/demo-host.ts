import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Express } from 'express';
import type { HostServices, ModuleInstance } from '@moduleforge/host-types';
import { runMigrations } from './sqlite-db';
import { createFakeHost } from './fake-host';
import { createModule as createPaymentMethod } from '../payment-method/src/index';
import { createModule as createInvoice } from '../invoice/src/index';
import { createModule as createPaymentGateway } from '../payment-gateway/src/index';
import { createModule as createNotificationAdapter } from '../notification-adapter/src/index';

export const DEMO_WEBHOOK_SECRET = 'whsec_demo_only';
const dir = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));

/** A host app that mounts the four reference modules at their module.json apiPrefix. */
export async function createDemoHost() {
  const fake = createFakeHost({
    PAYMENT_PROVIDER: 'mock', PAYMENT_GATEWAY_PROVIDER: 'mock', STRIPE_WEBHOOK_SECRET: DEMO_WEBHOOK_SECRET,
    PAYMENT_SUCCESS_URL: 'https://demo.invalid/success', PAYMENT_CANCEL_URL: 'https://demo.invalid/cancel',
  });
  const { host } = fake;
  const modules: { name: string; prefix?: string; make: (h: HostServices) => ModuleInstance }[] = [
    // The gateway must be mounted before anything that applies a global JSON body parser (its webhook needs the raw body).
    { name: 'payment-gateway', prefix: '/api/payment-gateway', make: createPaymentGateway },
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
