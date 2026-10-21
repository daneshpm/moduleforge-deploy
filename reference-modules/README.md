# ModuleForge reference modules

Four small, runnable modules plus a demo host, showing the module contract in practice.

| Module | Type | Publishes | Consumes |
|---|---|---|---|
| `payment-method` | fullstack | `payment_method.added/removed` | - |
| `invoice` | fullstack | `invoice.created/paid` | `payment.received` |
| `payment-gateway` | backend | `payment_gateway.payment_succeeded/failed` and the platform events `payment.received`, `payment.failed` | - |
| `notification-adapter` | backend | - | `invoice.created`, `invoice.paid`, `payment_method.added` |

Modules never import each other. Each exports `createModule(host)` returning `{ router, dispose }`, where `host` is `HostServices` (`_host/types.ts`): `db`, `currentUser(req)`, `events`, `notifications`, `config`.

## Run it

```
cd reference-modules
npm install
npm test         # node:test + tsx, in-memory fake host
npm run typecheck
npm run demo     # payment method -> invoice -> checkout (mock) -> signed webhook -> payment.received -> paid -> notification
npm run zip      # writes dist/<id>-<version>.zip
```

Requires Node 22.5+ (the demo host uses the built-in `node:sqlite`).

## How a "Billing" app imports `invoice`

1. In the ModuleForge marketplace, open `invoice` and import it into Billing. ModuleForge reads `module.json`: it checks `compatibility.moduleforge`, resolves `dependsOn` (`payment-method` is optional), and lists what Billing must provide: env vars, host services (`auth.currentUser`, `db`) and DB tables with prefix `inv_`.
2. Copy/install the module source into Billing (e.g. `modules/invoice`), and run `migrations/*.sql` against Billing's database.
3. Wire it into Billing's host (Express):

```ts
import { createModule as createInvoice } from './modules/invoice/src';

const host: HostServices = {
  db,                                  // Billing's DB wrapper (query/exec)
  currentUser: (req) => req.user ?? null,
  events,                              // Billing's event bus
  notifications,                       // Billing's notification service
  config: { /* values for requires.env */ },
};
app.use('/api/invoices', createInvoice(host).router);   // provides.apiPrefix
```

4. Render the UI export: `import { Invoices } from './modules/invoice/src/ui/Invoices'`.
5. To get paid invoices, import `payment-gateway` (see its README: mount it before any global `express.json()` and without user auth on `/webhook`), or have Billing publish `payment.received` with `{ invoiceId, userId, amountCents, currency }` on the event bus (`userId` must be the invoice owner and `amountCents`/`currency` are required; events missing or mismatching any of them are ignored). Optionally import `payment-method` and `notification-adapter` the same way; they cooperate through events only.

## payment-gateway

Starts hosted checkout sessions (Stripe via plain `fetch`, or a `mock` adapter) and turns the provider's signed webhook into `payment.received` (HMAC-SHA256 `Stripe-Signature` verification, 5 minute tolerance, idempotent by event id, amounts checked against the stored session). It publishes the cross-module `payment.received` / `payment.failed` events, which the contract permits through the closed list of well-known platform events (`shared/module.schema.json` `definitions.wellKnownPlatformEvents`); see `payment-gateway/README.md` for the rationale and host requirements.

## Uploading to the marketplace

`npm run zip` produces `dist/invoice-1.0.0.zip` etc. Each archive has `module.json` at its root and contains `migrations/`, `src/`, `package.json` and `README.md` (tests and `node_modules` are left out). Upload the zip in the ModuleForge publish flow.

## Deviations from the draft contract

- `dependsOn[]` entries gain an optional `"optional": true` flag (used by `invoice` for `payment-method`).
- `runtime.frontendCommand/backendCommand` are `null` and `ports` is `[]`: these modules are libraries mounted into a host, not standalone processes.
- `notification-adapter` has `database: { tables: [], prefix: "" }`.
- Route entries in `provides.routes` are strings like `"GET /api/invoices"`.
- Notification payloads include `userId`; every published event payload carries the `userId` of the owner.
- `payment-method`'s Stripe and Razorpay adapters are intentionally TODO stubs; `payment-gateway` has a real (fetch-based) Stripe checkout adapter.
- `payment-gateway` publishes the well-known platform events `payment.received` / `payment.failed` besides its own `payment_gateway.*` events, and declares the `config` host service.
