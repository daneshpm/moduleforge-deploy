CREATE TABLE IF NOT EXISTS pg_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_session_id TEXT UNIQUE,
  reference TEXT NOT NULL,
  invoice_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','rejected')),
  checkout_url TEXT,
  provider_payment_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pg_sessions_user ON pg_sessions(user_id);
CREATE TABLE IF NOT EXISTS pg_webhook_events (
  event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  session_id TEXT,
  outcome TEXT,
  received_at TEXT NOT NULL
);
