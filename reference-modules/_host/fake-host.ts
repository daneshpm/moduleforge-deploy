import type { Request } from 'express';
import type { HostServices, Notification } from '@moduleforge/host-types';
import { createEventBus } from './event-bus';
import { createSqliteDb } from './sqlite-db';

/**
 * In-memory fake host used by unit tests and the demo.
 * "Auth" = the `x-user-id` request header. Notifications are recorded in `sent`.
 */
export function createFakeHost(config: Record<string, string | undefined> = {}) {
  const sent: Notification[] = [];
  const logs: string[] = [];
  const events = createEventBus((m) => logs.push(m));
  const host: HostServices = {
    db: createSqliteDb(':memory:'),
    currentUser: (req: Request) => {
      const id = req.header('x-user-id');
      return id ? { id, email: `${id}@example.com` } : null;
    },
    events,
    notifications: { send: async (n) => void sent.push(n) },
    config,
  };
  return { host, sent, logs, events };
}
