import type { Request, Router } from 'express';

/** Minimal SQL access the host gives to modules. Use `?` placeholders. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string, params?: unknown[]): Promise<{ changes: number }>;
}

export interface CurrentUser {
  id: string;
  email?: string;
  name?: string;
}

export type EventHandler<T = any> = (payload: T, meta: { type: string }) => void | Promise<void>;

/** Modules talk to each other ONLY through this bus (never by importing one another). */
export interface EventBus {
  publish<T = unknown>(type: string, payload: T): Promise<void>;
  /** Returns an unsubscribe function. */
  subscribe<T = any>(type: string, handler: EventHandler<T>): () => void;
}

export interface Notification {
  userId: string;
  subject: string;
  body: string;
  channel?: 'email' | 'inapp';
}

export interface NotificationService {
  send(n: Notification): Promise<void>;
}

/** Everything the host injects into `createModule(host)`. Maps to contract `requires.hostServices`. */
export interface HostServices {
  db: Db;
  /** Resolve the authenticated user for a request (`auth.currentUser`), or null. */
  currentUser(req: Request): CurrentUser | null;
  events: EventBus;
  notifications: NotificationService;
  /** Values for the env vars declared in module.json `requires.env` (host reads them, modules never touch process.env). */
  config: Record<string, string | undefined>;
}

export interface ModuleInstance {
  /** Mount at module.json `provides.apiPrefix`. */
  router: Router;
  dispose(): void;
}

export type CreateModule = (host: HostServices) => ModuleInstance;
