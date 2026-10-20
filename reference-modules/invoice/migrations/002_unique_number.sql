CREATE UNIQUE INDEX IF NOT EXISTS inv_invoices_user_number ON inv_invoices(user_id, number);
