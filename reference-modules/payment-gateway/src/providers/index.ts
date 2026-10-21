import type { CheckoutProvider } from './types';
import { mockProvider } from './mock';
import { createStripeProvider } from './stripe';

export function getProvider(name: string | undefined, config: Record<string, string | undefined>): CheckoutProvider {
  switch (name || 'stripe') {
    case 'mock': return mockProvider;
    case 'stripe': return createStripeProvider({ secretKey: config.STRIPE_SECRET_KEY ?? '' });
    default: throw new Error(`unknown PAYMENT_GATEWAY_PROVIDER "${name}"`);
  }
}
export type { CheckoutProvider, CheckoutRequest, NormalizedEvent } from './types';
export { createStripeProvider } from './stripe';
export { mockProvider, mockCompletedEvent } from './mock';
