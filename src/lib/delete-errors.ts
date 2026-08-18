// Tables whose foreign keys have no ON DELETE rule, so they block a delete and
// surface a raw Postgres constraint error. Keyed by the table name as it appears
// in that error, valued by what the user calls it.
// See supabase/migrations/20260404070741_*.sql and 20260415080631_*.sql.
const BLOCKERS: Record<string, string> = {
  production_entries: 'production entries logged against it',
  dispatch_records: 'dispatch records',
  bom_headers: 'a BOM',
  purchase_orders: 'purchase orders',
  stock_transactions: 'stock movements recorded against it',
  grn_headers: 'goods receipts (GRNs) against it',
  grn_lines: 'goods receipt lines against it',
  invoices: 'invoices',
};

/**
 * Turns a raw Postgres foreign-key error into something a factory manager can act on.
 * `label` is what the user calls the record — a PO number, GRN number, etc.
 * `alternative` is the safe way out, e.g. 'set the order to Cancelled instead'.
 */
export function friendlyDeleteError(message: string, label: string, alternative = 'cancel it instead'): string {
  const table = Object.keys(BLOCKERS).find(t => message.includes(`on table "${t}"`));
  if (!table) return `${label} could not be deleted: ${message}`;
  return `${label} has ${BLOCKERS[table]}, so it can't be deleted. Remove those first, or ${alternative}.`;
}

/** Order-specific wording. */
export function friendlyOrderDeleteError(message: string, poLabel: string): string {
  return friendlyDeleteError(message, poLabel, 'set the order to Cancelled instead');
}
