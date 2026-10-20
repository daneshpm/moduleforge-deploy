CREATE TABLE IF NOT EXISTS pm_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  token TEXT NOT NULL,
  brand TEXT NOT NULL,
  last4 TEXT NOT NULL,
  exp_month INTEGER,
  exp_year INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pm_methods_user ON pm_methods(user_id);
