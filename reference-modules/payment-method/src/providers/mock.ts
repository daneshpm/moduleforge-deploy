import type { PaymentProvider } from './types';

/** Mock provider. Token format: `tok_<brand>_<last4>`, e.g. `tok_visa_4242`. */
export const mockProvider: PaymentProvider = {
  name: 'mock',
  async attach({ providerToken }) {
    const m = /^tok_([a-z]+)_(\d{4})$/.exec(providerToken);
    if (!m) throw new Error('mock provider expects a token like tok_visa_4242');
    return { token: providerToken, brand: m[1], last4: m[2], expMonth: 12, expYear: 2030 };
  },
  async detach() {},
};
