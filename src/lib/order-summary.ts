export interface OrderRowSummary {
  product: string;
  fabric: string;
  qty: number;
  uom: string;
  value: number;
}

export const EMPTY_ORDER_SUMMARY: OrderRowSummary = { product: '', fabric: '', qty: 0, uom: '', value: 0 };

interface Resolvers {
  getProduct?: (id: string) => string;
  getFabric?: (id: string) => string;
}

/**
 * order_headers carries no line-item fields — product, fabric, qty, uom and rate all
 * live on order_rows. Roll them up per order for list columns, totals and exports.
 */
export function summariseOrderRows(rows: any[], { getProduct, getFabric }: Resolvers = {}): Map<string, OrderRowSummary> {
  const acc = new Map<string, { products: Set<string>; fabrics: Set<string>; uoms: Set<string>; qty: number; value: number }>();
  for (const r of rows || []) {
    if (!r?.orderId) continue;
    let a = acc.get(r.orderId);
    if (!a) { a = { products: new Set(), fabrics: new Set(), uoms: new Set(), qty: 0, value: 0 }; acc.set(r.orderId, a); }
    if (r.productId && getProduct) { const n = getProduct(r.productId); if (n) a.products.add(n); }
    if (r.fabricId && getFabric) { const n = getFabric(r.fabricId); if (n) a.fabrics.add(n); }
    if (r.uom) a.uoms.add(r.uom);
    a.qty += Number(r.orderQty) || 0;
    a.value += (Number(r.orderQty) || 0) * (Number(r.ratePerItem) || 0);
  }

  const out = new Map<string, OrderRowSummary>();
  for (const [id, a] of acc) {
    out.set(id, {
      product: [...a.products].join(', '),
      fabric: [...a.fabrics].join(', '),
      qty: a.qty,
      // blank when the order mixes units — a qty summed across units would be a lie
      uom: a.uoms.size === 1 ? [...a.uoms][0] : '',
      value: a.value,
    });
  }
  return out;
}
