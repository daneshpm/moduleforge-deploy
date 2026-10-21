# notification-adapter

Backend-only glue. Subscribes to `invoice.created`, `invoice.paid` and `payment_method.added` and calls `host.notifications.send(...)`. It imports neither the invoice nor the payment-method module; the event payloads (documented in those modules' `module.json`) are the only coupling.

Mount at `/api/notification-adapter` (`GET /health`). No database tables.
