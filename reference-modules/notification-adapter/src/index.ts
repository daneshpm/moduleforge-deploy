import { Router } from 'express';
import type { CreateModule, Notification } from '@moduleforge/host-types';

const money = (cents: number, cur = 'USD') => `${(cents / 100).toFixed(2)} ${cur}`;

/** event type -> notification (or null to skip). Payload shapes are the publisher's contract (see their module.json). */
const rules: Record<string, (p: any) => Omit<Notification, 'channel'> | null> = {
  'invoice.created': (p) => p?.userId && { userId: p.userId, subject: `Invoice ${p.number} created`, body: `Total ${money(p.totalCents, p.currency)} for ${p.customerName}.` },
  'invoice.paid': (p) => p?.userId && { userId: p.userId, subject: `Invoice ${p.number} paid`, body: `Received ${money(p.totalCents, p.currency)}.` },
  'payment_method.added': (p) => p?.userId && { userId: p.userId, subject: 'Payment method added', body: `${p.brand} ending ${p.last4} was saved.` },
};

export const createModule: CreateModule = (host) => {
  let sent = 0;
  const unsubs = Object.entries(rules).map(([type, build]) =>
    host.events.subscribe(type, async (payload) => {
      const n = build(payload);
      if (!n) return;
      await host.notifications.send({ ...n, channel: 'email' });
      sent++;
    }),
  );
  const router = Router();
  router.get('/health', (_req, res) => res.json({ ok: true, sent }));
  return { router, dispose: () => unsubs.forEach((u) => u()) };
};
