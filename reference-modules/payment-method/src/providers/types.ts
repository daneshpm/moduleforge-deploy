/** What a provider adapter returns: only non-sensitive data. Raw card numbers never reach this module. */
export interface ProviderMethod {
  token: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
}

/** Adapter interface: one implementation per payment provider. */
export interface PaymentProvider {
  readonly name: string;
  /** Turn a client-side token (from Stripe Elements, Razorpay Checkout, ...) into a stored method. */
  attach(input: { userId: string; providerToken: string }): Promise<ProviderMethod>;
  /** Detach / delete the method at the provider. */
  detach(token: string): Promise<void>;
}
