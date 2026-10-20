import type { EventBus, EventHandler } from '@moduleforge/host-types';

/** Tiny in-memory event bus. publish() awaits all handlers; a failing handler is logged, not thrown. */
export function createEventBus(log: (msg: string) => void = () => {}): EventBus & { history: { type: string; payload: unknown }[] } {
  const handlers = new Map<string, Set<EventHandler>>();
  const history: { type: string; payload: unknown }[] = [];
  return {
    history,
    async publish(type, payload) {
      history.push({ type, payload });
      for (const h of [...(handlers.get(type) ?? [])]) {
        try {
          await h(payload, { type });
        } catch (err) {
          log(`handler for ${type} failed: ${(err as Error).message}`);
        }
      }
    },
    subscribe(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
      return () => handlers.get(type)?.delete(handler);
    },
  };
}
