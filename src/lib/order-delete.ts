// Tables whose FK to order_headers has no ON DELETE rule, so they block the delete.
// Keyed by table name as it appears in the raw Postgres error, valued by what the
// user calls it. See supabase/migrations/20260404070741_*.sql and 20260415080631_*.sql.
const BLOCKERS: Record<string, string> = {
  production_entries: 'production entries logged against it',
  dispatch_records: 'dispatch records',
  bom_headers: 'a BOM',
  purchase_orders: 'purchase orders',
  stock_transactions: 'stock transactions',
};

/** Turns a raw Postgres FK error into something a factory manager can act on. */
export function friendlyOrderDeleteError(message: string, poLabel: string): string {
  const table = Object.keys(BLOCKERS).find(t => message.includes(`on table "${t}"`));
  if (!table) return `${poLabel} could not be deleted: ${message}`;
  return `${poLabel} has ${BLOCKERS[table]}, so it can't be deleted. Remove those first, or set the order to Cancelled instead.`;
}
