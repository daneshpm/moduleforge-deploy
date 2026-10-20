import { Router, json } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { CreateModule } from '@moduleforge/host-types';
import { getProvider } from './providers';

export type { PaymentProvider } from './providers';

interface Row {
  id: string; user_id: string; provider: string; token: string; brand: string;
  last4: string; exp_month: number | null; exp_year: number | null; created_at: string;
}
// The provider token is never returned to the client.
const present = (r: Row) => ({
  id: r.id, provider: r.provider, brand: r.brand, last4: r.last4,
  expMonth: r.exp_month, expYear: r.exp_year, createdAt: r.created_at,
});

const FORBIDDEN_FIELDS = ['number', 'cardNumber', 'pan', 'cvc', 'cvv'];

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

export const createModule: CreateModule = (host) => {
  const provider = getProvider(host.config.PAYMENT_PROVIDER || 'mock');
  const router = Router();
  router.use(json());

  router.use((req, res, next) => {
    const user = host.currentUser(req);
    if (!user) return void res.status(401).json({ error: 'unauthenticated' });
    res.locals.user = user;
    next();
  });

  router.get('/', wrap(async (_req, res) => {
    const rows = await host.db.query<Row>('SELECT * FROM pm_methods WHERE user_id = ? ORDER BY created_at', [res.locals.user.id]);
    res.json(rows.map(present));
  }));

  router.post('/', wrap(async (req, res) => {
    const body = req.body ?? {};
    if (FORBIDDEN_FIELDS.some((f) => f in body)) {
      return void res.status(400).json({ error: 'raw card data is not accepted; send a providerToken' });
    }
    if (typeof body.providerToken !== 'string' || !body.providerToken) {
      return void res.status(400).json({ error: 'providerToken is required' });
    }
    const userId: string = res.locals.user.id;
    let m;
    try { m = await provider.attach({ userId, providerToken: body.providerToken }); }
    catch (e) { return void res.status(400).json({ error: (e as Error).message }); }
    const row: Row = {
      id: crypto.randomUUID(), user_id: userId, provider: provider.name, token: m.token, brand: m.brand,
      last4: m.last4, exp_month: m.expMonth ?? null, exp_year: m.expYear ?? null, created_at: new Date().toISOString(),
    };
    await host.db.exec(
      'INSERT INTO pm_methods (id,user_id,provider,token,brand,last4,exp_month,exp_year,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [row.id, row.user_id, row.provider, row.token, row.brand, row.last4, row.exp_month, row.exp_year, row.created_at],
    );
    await host.events.publish('payment_method.added', { id: row.id, userId, brand: row.brand, last4: row.last4 });
    res.status(201).json(present(row));
  }));

  router.delete('/:id', wrap(async (req, res) => {
    const userId: string = res.locals.user.id;
    const [row] = await host.db.query<Row>('SELECT * FROM pm_methods WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (!row) return void res.status(404).json({ error: 'not found' });
    await provider.detach(row.token);
    await host.db.exec('DELETE FROM pm_methods WHERE id = ?', [row.id]);
    await host.events.publish('payment_method.removed', { id: row.id, userId });
    res.status(204).end();
  }));

  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  return { router, dispose() {} };
};
