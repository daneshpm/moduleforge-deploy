import { useCallback, useEffect, useState } from 'react';

interface Invoice { id: string; number: string; customerName: string; status: string; totalCents: number; currency: string }

const money = (cents: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);

/** Invoice list with a minimal "new invoice" form (one line item). */
export function Invoices({ apiBase = '/api/invoices', headers = {} }: { apiBase?: string; headers?: Record<string, string> }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customer, setCustomer] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(apiBase, { headers });
    if (r.ok) setInvoices(await r.json());
  }, [apiBase]);
  useEffect(() => { void load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(apiBase, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ customerName: customer, items: [{ description, quantity: 1, unitPriceCents: Math.round(Number(price) * 100) }] }),
    });
    setError(r.ok ? null : (await r.json()).error);
    if (r.ok) { setCustomer(''); setDescription(''); setPrice('0'); }
    await load();
  };
  const act = async (id: string, action: 'send' | 'void') => { await fetch(`${apiBase}/${id}/${action}`, { method: 'POST', headers }); await load(); };

  return (
    <section>
      <h3>Invoices</h3>
      <form onSubmit={create}>
        <input placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button type="submit">Create</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <table>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td>{i.number}</td><td>{i.customerName}</td><td>{i.status}</td><td>{money(i.totalCents, i.currency)}</td>
              <td>
                {i.status === 'draft' && <button onClick={() => act(i.id, 'send')}>Send</button>}
                {(i.status === 'draft' || i.status === 'sent') && <button onClick={() => act(i.id, 'void')}>Void</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
