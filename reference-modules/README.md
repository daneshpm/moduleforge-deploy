# ModuleForge reference modules

Three small, runnable modules plus a demo host, showing the module contract in practice.

| Module | Type | Publishes | Consumes |
|---|---|---|---|
| `payment-method` | fullstack | `payment_method.added/removed` | - |
| `invoice` | fullstack | `invoice.created/paid` | `payment.received` |
| `notification-adapter` | backend | - | `invoice.created`, `invoice.paid`, `payment_method.added` |

Modules never import each other. Each exports `createModule(host)` returning `{ router, dispose }`, where `host` is `HostServices` (`_host/types.ts`): `db`, `currentUser(req)`, `events`, `notifications`, `config`.

## Run it

```
cd reference-modules
npm install
npm test         # node:test + tsx, in-memory fake host
npm run typecheck
npm run demo     # payment method -> invoice -> payment.received -> paid -> notification
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
5. To get paid invoices, Billing (or a payment integration) publishes `payment.received` with `{ invoiceId, amountCents }` on the event bus. Optionally import `payment-method` and `notification-adapter` the same way; they cooperate through events only.

## Uploading to the marketplace

`npm run zip` produces `dist/invoice-1.0.0.zip` etc. Each archive has `module.json` at its root and contains `migrations/`, `src/`, `package.json` and `README.md` (tests and `node_modules` are left out). Upload the zip in the ModuleForge publish flow.

## Deviations from the draft contract

- `dependsOn[]` entries gain an optional `"optional": true` flag (used by `invoice` for `payment-method`).
- `runtime.frontendCommand/backendCommand` are `null` and `ports` is `[]`: these modules are libraries mounted into a host, not standalone processes.
- `notification-adapter` has `database: { tables: [], prefix: "" }`.
- Route entries in `provides.routes` are strings like `"GET /api/invoices"`.
- Notification payloads include `userId`; every published event payload carries the `userId` of the owner.
- Stripe and Razorpay adapters are intentionally TODO stubs.
