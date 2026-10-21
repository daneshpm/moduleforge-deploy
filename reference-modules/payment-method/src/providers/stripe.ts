import type { PaymentProvider } from './types';

// TODO: implement with the Stripe SDK. Needs STRIPE_SECRET_KEY (secret) declared in module.json requires.env.
//   attach: stripe.paymentMethods.retrieve(providerToken) -> { card.brand, card.last4, card.exp_* }
//   detach: stripe.paymentMethods.detach(token)
export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  async attach() { throw new Error('stripe adapter not implemented (TODO)'); },
  async detach() { throw new Error('stripe adapter not implemented (TODO)'); },
};
