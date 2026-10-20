CREATE TABLE IF NOT EXISTS inv_invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','void')),
  tax_percent REAL NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS inv_invoices_user ON inv_invoices(user_id);
CREATE TABLE IF NOT EXISTS inv_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL REFERENCES inv_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL
);
