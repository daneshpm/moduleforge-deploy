# payment-method

Saved payment methods per user. Stores only provider token, brand, last4 and expiry. Raw card data is rejected (HTTP 400).

- Mount `createModule(host).router` at `/api/payment-methods` (GET list, POST add `{providerToken}`, DELETE `/:id`).
- Provider adapters live in `src/providers/` behind the `PaymentProvider` interface. `mock` is implemented (token `tok_<brand>_<last4>`); `stripe` and `razorpay` are TODO stubs. Select with the `PAYMENT_PROVIDER` config value.
- Events published: `payment_method.added`, `payment_method.removed`.
- DB: `migrations/001_init.sql` creates `pm_methods`.
- UI: `src/ui/PaymentMethods.tsx` (`<PaymentMethods apiBase headers getToken />`).
- Host services used: `db`, `currentUser`, `events`, `config`.
