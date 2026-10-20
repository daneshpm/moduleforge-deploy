import { useCallback, useEffect, useState } from 'react';

interface Method { id: string; brand: string; last4: string }

/** Lists / adds / removes saved payment methods. `getToken` should return a provider token (e.g. from Stripe Elements). */
export function PaymentMethods({ apiBase = '/api/payment-methods', headers = {}, getToken = async () => 'tok_visa_4242' }: {
  apiBase?: string;
  headers?: Record<string, string>;
  getToken?: () => Promise<string>;
}) {
  const [methods, setMethods] = useState<Method[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(apiBase, { headers });
    if (r.ok) setMethods(await r.json());
    else setError('Could not load payment methods');
  }, [apiBase]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const r = await fetch(apiBase, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ providerToken: await getToken() }),
    });
    setError(r.ok ? null : (await r.json()).error);
    await load();
  };
  const remove = async (id: string) => { await fetch(`${apiBase}/${id}`, { method: 'DELETE', headers }); await load(); };

  return (
    <section>
      <h3>Payment methods</h3>
      {error && <p role="alert">{error}</p>}
      <ul>
        {methods.map((m) => (
          <li key={m.id}>{m.brand} **** {m.last4} <button onClick={() => remove(m.id)}>Remove</button></li>
        ))}
      </ul>
      <button onClick={add}>Add payment method</button>
    </section>
  );
}
