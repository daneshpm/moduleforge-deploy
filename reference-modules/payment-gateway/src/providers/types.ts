export interface CheckoutRequest {
  sessionId: string;
  userId: string;
  reference: string;
  invoiceId?: string;
  amountCents: number;
  /** Upper-case ISO code. */
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult { providerSessionId: string; url: string }

/** Provider-neutral view of a webhook event. Only what this module needs. */
export interface NormalizedEvent {
  eventId: string;
  kind: 'succeeded' | 'failed';
  providerSessionId: string;
  /** Amount/currency as reported by the provider (validated against the stored session, never trusted). */
  amountCents?: number;
  currency?: string;
  providerPaymentId?: string;
  reason?: string;
}

/** Adapter interface: one implementation per payment provider. */
export interface CheckoutProvider {
  readonly name: string;
  createCheckoutSession(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Map a parsed (already signature-verified) webhook JSON body; null = event type we do not care about. */
  normalizeEvent(event: any): NormalizedEvent | null;
}
