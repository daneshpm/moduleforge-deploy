import { Router, json } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { CreateModule, HostServices } from '@moduleforge/host-types';
import { computeTotals, validateInvoiceInput } from './totals';

export { computeTotals } from './totals';

type Status = 'draft' | 'sent' | 'paid' | 'void';
interface Row {
  id: string; user_id: string; number: string; customer_name: string; currency: string; status: Status;
  tax_percent: number; subtotal_cents: number; tax_cents: number; total_cents: number; created_at: string; paid_at: string | null;
}
interface ItemRow { description: string; quantity: number; unit_price_cents: number }

const present = (r: Row, items?: ItemRow[]) => ({
  id: r.id, number: r.number, customerName: r.customer_name, currency: r.currency, status: r.status,
  taxPercent: r.tax_percent, subtotalCents: r.subtotal_cents, taxCents: r.tax_cents, totalCents: r.total_cents,
  createdAt: r.created_at, paidAt: r.paid_at,
  ...(items && { items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPriceCents: i.unit_price_cents })) }),
});

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

/** Consume `payment.received` (published by a payment provider / the host) and mark the invoice paid. */
async function markPaid(host: HostServices, p: { invoiceId?: string; amountCents?: number }) {
  if (!p?.invoiceId) return;
  const [inv] = await host.db.query<Row>('SELECT * FROM inv_invoices WHERE id = ?', [p.invoiceId]);
  if (!inv || (inv.status !== 'draft' && inv.status !== 'sent')) return;
  if (p.amountCents !== undefined && p.amountCents < inv.total_cents) return; // partial payments not supported yet
  const paidAt = new Date().toISOString();
  await host.db.exec("UPDATE inv_invoices SET status = 'paid', paid_at = ? WHERE id = ?", [paidAt, inv.id]);
  await host.events.publish('invoice.paid', {
    invoiceId: inv.id, userId: inv.user_id, number: inv.number, totalCents: inv.total_cents, currency: inv.currency, paidAt,
  });
}

export const createModule: CreateModule = (host) => {
  const router = Router();
  router.use(json());
  router.use((req, res, next) => {
    const user = host.currentUser(req);
    if (!user) return void res.status(401).json({ error: 'unauthenticated' });
    res.locals.user = user;
    next();
  });

  const load = async (id: string, userId: string) =>
    (await host.db.query<Row>('SELECT * FROM inv_invoices WHERE id = ? AND user_id = ?', [id, userId]))[0];

  router.get('/', wrap(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const rows = await host.db.query<Row>(
      `SELECT * FROM inv_invoices WHERE user_id = ? ${status ? 'AND status = ?' : ''} ORDER BY created_at DESC`,
      status ? [res.locals.user.id, status] : [res.locals.user.id],
    );
    res.json(rows.map((r) => present(r)));
  }));

  router.post('/', wrap(async (req, res) => {
    const err = validateInvoiceInput(req.body);
    if (err) return void res.status(400).json({ error: err });
    const userId: string = res.locals.user.id;
    const { customerName, items, taxPercent = 0, currency = 'USD' } = req.body;
    const t = computeTotals(items, taxPercent);
    const [{ n }] = await host.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM inv_invoices WHERE user_id = ?', [userId]);
    const id = crypto.randomUUID();
    const number = `INV-${String(Number(n) + 1).padStart(4, '0')}`;
    await host.db.exec(
      'INSERT INTO inv_invoices (id,user_id,number,customer_name,currency,status,tax_percent,subtotal_cents,tax_cents,total_cents,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, userId, number, customerName.trim(), currency, 'draft', taxPercent, t.subtotalCents, t.taxCents, t.totalCents, new Date().toISOString()],
    );
    for (const i of items) {
      await host.db.exec('INSERT INTO inv_items (invoice_id,description,quantity,unit_price_cents) VALUES (?,?,?,?)', [id, i.description, i.quantity, i.unitPriceCents]);
    }
    await host.events.publish('invoice.created', { invoiceId: id, userId, number, totalCents: t.totalCents, currency, customerName });
    const inv = (await load(id, userId))!;
    const itemRows = await host.db.query<ItemRow>('SELECT * FROM inv_items WHERE invoice_id = ? ORDER BY id', [id]);
    res.status(201).json(present(inv, itemRows));
  }));

  router.get('/:id', wrap(async (req, res) => {
    const inv = await load(req.params.id, res.locals.user.id);
    if (!inv) return void res.status(404).json({ error: 'not found' });
    const items = await host.db.query<ItemRow>('SELECT * FROM inv_items WHERE invoice_id = ? ORDER BY id', [inv.id]);
    res.json(present(inv, items));
  }));

  const transition = (to: Status, from: Status[]) => wrap(async (req, res) => {
    const inv = await load(req.params.id, res.locals.user.id);
    if (!inv) return void res.status(404).json({ error: 'not found' });
    if (!from.includes(inv.status)) return void res.status(409).json({ error: `cannot go from ${inv.status} to ${to}` });
    await host.db.exec('UPDATE inv_invoices SET status = ? WHERE id = ?', [to, inv.id]);
    res.json(present({ ...inv, status: to }));
  });
  router.post('/:id/send', transition('sent', ['draft']));
  router.post('/:id/void', transition('void', ['draft', 'sent']));

  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  const unsubscribe = host.events.subscribe('payment.received', (p) => markPaid(host, p));
  return { router, dispose: unsubscribe };
};
