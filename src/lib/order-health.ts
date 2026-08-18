export type OrderHealthState = 'red' | 'amber' | 'green' | 'grey';

export interface OrderHealthResult {
  state: OrderHealthState;
  label: string;
  orderedQty: number;
  producedQty: number;
  dueDate: string | null;
  daysUntilDue: number | null;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(a).getTime() - new Date(b).getTime()) / 86400000,
  );
}

export function getOrderHealth(
  order: { id: string; status: string; targetEndDate?: string; buyerDeliveryDate?: string; createdAt: string },
  colourways: { orderId: string; orderedQty: number }[],
  entries: { orderId: string; outputQty: number }[],
  today: string,
  orderRows: { orderId: string; orderQty: number }[] = [],
): OrderHealthResult {
  const dueDate = order.targetEndDate || order.buyerDeliveryDate || null;

  const colourwayQty = colourways
    .filter(c => c.orderId === order.id)
    .reduce((s, c) => s + (c.orderedQty || 0), 0);
  // order_headers carries no orderQty field — an order saved with colourless rows
  // (no colour_name entered) has zero colourways, so fall back to order_rows.
  const rowQty = orderRows
    .filter(r => r.orderId === order.id)
    .reduce((s, r) => s + (r.orderQty || 0), 0);
  const orderedQty = colourwayQty > 0 ? colourwayQty : rowQty;

  const producedQty = entries
    .filter(e => e.orderId === order.id)
    .reduce((s, e) => s + (e.outputQty || 0), 0);

  if (producedQty === 0) {
    return { state: 'grey', label: 'Not started', orderedQty, producedQty, dueDate, daysUntilDue: dueDate ? daysBetween(dueDate, today) : null };
  }

  const incomplete = producedQty < orderedQty;

  if (!incomplete) {
    return { state: 'green', label: 'On track', orderedQty, producedQty, dueDate, daysUntilDue: dueDate ? daysBetween(dueDate, today) : null };
  }

  if (dueDate) {
    const daysUntilDue = daysBetween(dueDate, today);
    if (daysUntilDue < 0) {
      return { state: 'red', label: 'Late', orderedQty, producedQty, dueDate, daysUntilDue };
    }
    if (daysUntilDue <= 2) {
      return { state: 'amber', label: 'At risk', orderedQty, producedQty, dueDate, daysUntilDue };
    }
    if (orderedQty > 0) {
      const createdAt = order.createdAt || today;
      const totalDuration = daysBetween(dueDate, createdAt);
      if (totalDuration > 0) {
        const elapsed = daysBetween(today, createdAt);
        const completionPct = (producedQty / orderedQty) * 100;
        const schedulePct = Math.min((elapsed / totalDuration) * 100, 100);
        if (completionPct <= schedulePct - 10) {
          return { state: 'amber', label: 'At risk', orderedQty, producedQty, dueDate, daysUntilDue };
        }
      }
    }
  }

  return { state: 'green', label: 'On track', orderedQty, producedQty, dueDate, daysUntilDue: dueDate ? daysBetween(dueDate, today) : null };
}
