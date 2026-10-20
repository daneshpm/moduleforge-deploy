export interface LineItem { description: string; quantity: number; unitPriceCents: number }

/** All money is integer cents. Tax is rounded to the nearest cent. */
export function computeTotals(items: LineItem[], taxPercent = 0) {
  const subtotalCents = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
  const taxCents = Math.round((subtotalCents * taxPercent) / 100);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** Returns an error message, or null if the input is a valid invoice payload. */
export function validateInvoiceInput(b: any): string | null {
  if (!b || typeof b.customerName !== 'string' || !b.customerName.trim()) return 'customerName is required';
  if (!Array.isArray(b.items) || b.items.length === 0) return 'at least one item is required';
  for (const i of b.items) {
    if (typeof i.description !== 'string' || !i.description) return 'item.description is required';
    if (!Number.isInteger(i.quantity) || i.quantity < 1) return 'item.quantity must be a positive integer';
    if (!Number.isInteger(i.unitPriceCents) || i.unitPriceCents < 0) return 'item.unitPriceCents must be a non-negative integer (cents)';
  }
  if (b.taxPercent !== undefined && (typeof b.taxPercent !== 'number' || b.taxPercent < 0 || b.taxPercent > 100)) return 'taxPercent must be 0-100';
  return null;
}
