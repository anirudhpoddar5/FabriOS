# Resume notes — order list fixes (2026-08-18)

## Shipped and deployed (commit `6569caf`)

Live at https://18f9baef.fabrios.pages.dev (Cloudflare Pages, `npm run deploy`).
Build clean, 114/114 tests pass, 8 new tests in `src/lib/order-summary.test.ts`.

| # | Issue | Fix |
|---|---|---|
| 1 | Delete showed a raw Postgres FK error, and could half-delete an order | `src/lib/order-delete.ts` + both order pages: delete the header only (DB cascades the rest), translate blocking FK errors into English |
| 2 | Product / Fabric / Qty blank, all totals 0, CSV + print exports exported 0 | `src/lib/order-summary.ts` — roll up `order_rows` per order; wired into table cells, month sub-totals, page total, CSV, print, on both order pages |
| 2b | Reports "Total Qty" KPI tile always 0 (same bug class, found by sweep) | `ReportsPage.tsx` `orderSummary` now sums `data.orderRows` |
| 3 | No way to set order status from the order itself | Status dropdown in `OrderDetailPage` header + `ExplainerTip` on the list Status column explaining it is derived |
| — | Detail-page status badge rendered uncoloured | `derivedStatus.color` -> `.className` |

## NOT YET DONE — verify on live as a user

Deployed but **not click-tested on the live site**. Claude cannot sign in
(entering passwords is off-limits), so this needs either the user driving, or
an already-authenticated Chrome session on this Mac.

Checklist for the live pass, on `/printing-orders`:
1. Product, Fabric and Qty columns show values (not blank, not `—` for orders that have rows).
2. Month sub-total and Page Total show real qty and value, not 0.
3. CSV button — file has Product and Fabric columns and non-zero Qty.
4. Printer button — same.
5. Tick PO-P-0001 (has production entries) -> Delete -> expect:
   *"PO-P-0001 has production entries logged against it, so it can't be deleted.
   Remove those first, or set the order to Cancelled instead."*
   Then confirm the order and its colourways are **still intact**.
6. Tick an order with NO entries -> Delete -> deletes cleanly.
7. Open an order -> status dropdown in the header -> set Completed -> toast, badge updates.
8. Hover the (i) next to the Status column header -> tooltip explains the derived labels.
9. Repeat 1-2 and 5-7 on `/stitching-orders`.
10. Reports -> Order Status tab -> "Total Qty" tile is non-zero.

## Backlog found by the codebase sweep — not fixed

Ranked by real damage.

### A. GRN bulk delete destroys line detail — data loss
`src/pages/GRNPage.tsx` `handleBulkDelete` (~line 280). Deletes `grn_lines`
then `grn_headers`. `grn_lines` already cascades, so the first delete is
redundant — but `stock_transactions.grn_id` blocks the header delete with no
`ON DELETE`. So for any GRN that was ever **accepted** (the normal case), the
lines are permanently deleted and the header survives: inventory was credited,
but there is no record of what was received. Same one-line shape as the order
delete already fixed here.

### B. Purchase Order bulk delete can strand an empty PO
`src/pages/PurchaseOrdersPage.tsx` `handleBulkDelete` (~line 172). Same
redundant child delete; `grn_headers.po_id` can block step 2 after step 1
committed, leaving a PO header with no lines, still referenced by a GRN.

### C. Quotation edit deletes all lines before re-inserting them
`src/pages/QuotationsPage.tsx` `handleSave` (~line 192). `delete
quotation_lines` then insert new ones one at a time. If insert *i* fails, the
original lines are already gone and cannot be recovered. Needs a
`save_quotation_with_lines` RPC (mirroring `save_po_with_lines`), or at
minimum insert-then-delete.

### D. Quotation -> Order conversion bypasses the atomic RPC
`src/pages/QuotationsPage.tsx` `convertToOrder` (~line 275). Inserts
`order_headers`, loops inserting `order_rows`, then marks the quotation
accepted. Never creates `order_colourways` at all — so a converted order has
no colourways, which means 0% progress forever and blank colourway views. If
the status update fails the user can convert twice and get a duplicate order.
`save_order_with_rows_and_colourways` already exists for exactly this and is
what CLAUDE.md says to use.

### E. Every bulk-delete loop reports partial results as total failure
Printing, Stitching, Quotations, GRN, PO, Stock Jobs. If item 3 of 10 fails,
items 1-2 are already deleted and the user only sees "Delete failed". The two
order pages now report how many actually went; the others do not.

### F. Dead `order.orderQty` fallbacks (cosmetic today, wrong on real data)
`src/lib/order-delay.ts:82`, `src/lib/order-health.ts:29`,
`DashboardPage.tsx:354` and `:608` all do
`colourwayQty > 0 ? colourwayQty : order.orderQty || 0`. `order.orderQty` is
always `undefined`, so the fallback silently yields 0. This bites any order
saved **without colour names** — the save filters colourways by a non-empty
colour name, so such an order has zero colourways and shows 0% progress and 0
ordered qty on the dashboard and in delay exceptions. Fix: fall back to the
`order_rows` qty (i.e. `summariseOrderRows`), not to the header field.

### G. Stitching order list has no Product / Fabric columns
Printing has them; Stitching only shows Qty. Not a bug, but the two pages are
meant to mirror each other.

### H. Master lists cannot be sorted or grouped — reported 2026-08-18
`src/components/MasterCRUD.tsx` has **no sorting logic at all** (no sort, no
column headers you can click, no grouping). Every settings list — Printing
Tables, Stitching Lines, Buyers, Fabrics, Workers, Rates, Vendors, Products —
renders rows in whatever order Supabase happened to return them.

Reported against `/settings/printing-tables`, where the Factory column is the
first column but the rows are interleaved (22 Godown, Sanganer, 22 Godown,
Sanganer...), so you cannot read one factory's tables together.

Fix once in `MasterCRUD` so every master page benefits, rather than per page.
Minimum useful version: make the column headers click-to-sort. Better for this
case: an optional `groupBy` prop so Printing Tables and Stitching Lines can
show a factory sub-heading with its rows underneath — the same monthly-group
pattern the order lists already use.
