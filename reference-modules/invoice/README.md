# invoice

Invoices with line items, totals (integer cents, tax percent) and status `draft -> sent -> paid`, or `void`.

- Mount at `/api/invoices`: `GET /`, `POST /`, `GET /:id`, `POST /:id/send`, `POST /:id/void`.
- Publishes `invoice.created` and `invoice.paid`. Consumes `payment.received` (`{invoiceId, userId, amountCents, currency}`; all required, `userId` must be the invoice owner, `currency` must match the invoice), usually emitted by a payment provider integration or the host. Partial payments are ignored for now.
- Invoice numbers are unique per user (`migrations/002_unique_number.sql`); line amounts, subtotal and total are bounded to `Number.MAX_SAFE_INTEGER`.
- Optional dependency on `payment-method`: only through events/IDs, never imports.
- DB: `migrations/001_init.sql` creates `inv_invoices` and `inv_items`.
- UI: `src/ui/Invoices.tsx` (`<Invoices apiBase headers />`).
