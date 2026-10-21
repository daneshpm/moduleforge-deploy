import type { PaymentProvider } from './types';
import { mockProvider } from './mock';
import { stripeProvider } from './stripe';
import { razorpayProvider } from './razorpay';

export function getProvider(name = 'mock'): PaymentProvider {
  const providers: Record<string, PaymentProvider> = { mock: mockProvider, stripe: stripeProvider, razorpay: razorpayProvider };
  const p = providers[name];
  if (!p) throw new Error(`unknown PAYMENT_PROVIDER "${name}"`);
  return p;
}
export type { PaymentProvider, ProviderMethod } from './types';
