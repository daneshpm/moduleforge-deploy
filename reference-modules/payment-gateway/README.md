# payment-gateway

Turns a real payment into the platform `payment.received` event, without importing `invoice` (or any module).

```
POST /checkout  ->  provider checkout session (Stripe / mock)  ->  pending pg_sessions row (owned by the current user)
buyer pays at the provider
provider -> POST /webhook (signed)  ->  verify, dedupe, validate  ->  payment.received  ->  invoice marks itself paid
```

## Routes (mount at `/api/payment-gateway`)

| Route | Auth | Notes |
|---|---|---|
| `POST /checkout` | user | Body: `{ invoiceId }` or `{ amountCents, currency, reference, description? }`. With `invoiceId` the amount/currency come from the invoice (owned by the current user, status draft/sent); client-supplied amounts that differ are rejected. Returns the session incl. `checkoutUrl`. |
| `GET /sessions` | user | Own sessions only. |
| `POST /webhook` | **signature only** | Provider callback. |

### Host requirements for the webhook

1. Mount the router **before** any global `express.json()`; the webhook route parses the body itself with `express.raw` and needs the exact bytes the provider signed. If a parsed body is detected it answers `500` with an explanation instead of guessing.
2. Do **not** put user authentication in front of `/api/payment-gateway/webhook` (the provider has no session). The route authenticates itself via `Stripe-Signature`; all other routes use `host.currentUser`.
3. Point the Stripe dashboard webhook at `https://<host>/api/payment-gateway/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.

## Webhook handling

- Signature: `Stripe-Signature: t=<unix>,v1=<hex>`, `v1 = HMAC-SHA256(STRIPE_WEBHOOK_SECRET, "<t>.<rawBody>")`, implemented with `node:crypto` (no Stripe SDK): constant-time compare, 5 minute timestamp tolerance, anything else is `400`.
- Idempotent by provider event id (`pg_webhook_events` primary key). Replays do nothing. If publishing fails, the claim and session are released so the provider's retry succeeds. A different event id for an already settled session is also ignored.
- Never trusts the webhook amounts: `amount_total` and `currency` must equal the values stored when the session was created, else the session is marked `rejected` and a failure is published.
- Unknown sessions and unrelated event types are acknowledged with `200` and ignored.

## Events

| Event | When | Payload |
|---|---|---|
| `payment.received` | verified, matching payment | `{ userId, reference, invoiceId?, sessionId, provider, providerPaymentId, amountCents, currency }` |
| `payment_gateway.payment_succeeded` | same moment | same payload |
| `payment.failed` / `payment_gateway.payment_failed` | expired, async failure, or amount/currency mismatch | same plus `reason` |

`userId` is always the session owner, which is what `invoice` requires (owner, integer `amountCents`, matching `currency`).

### Why `payment.received` is allowed in `events.publishes`

The contract says a module may only publish events prefixed with its own id. `invoice` consumes the cross-module event `payment.received`, and someone has to publish it. Options considered: (a) a tiny adapter module that re-publishes, (b) a narrow rule relaxation. We chose (b): `shared/module.schema.json` has a closed list `definitions.wellKnownPlatformEvents` (`payment.received`, `payment.failed`), the validator reads that list, and any module may publish exactly those names in addition to its own `<id>.*` events. This keeps one module and one hop, keeps the rule machine-checked (any other foreign prefix is still an error), and documents the shared event vocabulary in one place. An adapter would add a module whose only job is renaming, with the same trust surface.

## Invoice lookup

For `{ invoiceId }` checkouts the gateway does a read-only `SELECT` on `inv_invoices` through the shared `host.db`, scoped to the current user (no import). This is the one soft coupling to another module's table; if that table is absent the route answers `400` and callers use `{ amountCents, currency, reference }`. Everything else is event-based.

## Config (`requires.env`)

`STRIPE_SECRET_KEY` (secret), `STRIPE_WEBHOOK_SECRET` (secret), `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL`, optional `PAYMENT_GATEWAY_PROVIDER` (`stripe` default, or `mock` for tests/demo; the mock uses the same signature scheme and Stripe-shaped events). Secrets are only sent in the `Authorization` header and never logged or included in error messages.

## Provider adapter

`CheckoutProvider { name, createCheckoutSession(req), normalizeEvent(rawEvent) }`. The Stripe adapter calls `POST https://api.stripe.com/v1/checkout/sessions` with plain `fetch` (form-encoded, `Authorization: Bearer`, `Idempotency-Key = session id`, `metadata[userId|reference|sessionId|invoiceId]`). `createPaymentGateway(host, { provider, now })` accepts an injected provider/clock for tests.

## Tables (`pg_`)

`pg_sessions` (session per checkout: owner, amount, currency, status pending/succeeded/failed/rejected), `pg_webhook_events` (processed provider event ids). Run `migrations/*.sql`.
