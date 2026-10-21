import type { CheckoutProvider } from './types';
import { normalizeStripeEvent } from './stripe';

/** Mock provider for tests/demo. Webhooks use the same Stripe-shaped events and signature scheme. */
export const mockProvider: CheckoutProvider = {
  name: 'mock',
  async createCheckoutSession() {
    const providerSessionId = `cs_mock_${crypto.randomUUID().replace(/-/g, '')}`;
    return { providerSessionId, url: `https://mock-pay.invalid/checkout/${providerSessionId}` };
  },
  normalizeEvent: normalizeStripeEvent,
};

/** Build a Stripe-shaped "paid" webhook event body for a session (test/demo helper). */
export function mockCompletedEvent(o: { eventId: string; providerSessionId: string; amountCents: number; currency: string; paymentIntent?: string }) {
  return {
    id: o.eventId,
    type: 'checkout.session.completed',
    data: { object: { id: o.providerSessionId, payment_status: 'paid', amount_total: o.amountCents, currency: o.currency.toLowerCase(), payment_intent: o.paymentIntent ?? `pi_mock_${o.eventId}` } },
  };
}
