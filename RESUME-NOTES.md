# Resume notes — FabriOS order + backlog work (2026-08-18)

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

## Backlog — now DONE (commit `b44b1bf`, deployed)

Every item A-H from the original sweep is implemented, reviewed and merged.

| Item | What was wrong | Fix |
|---|---|---|
| A | GRN delete destroyed line detail, orphaned the header (accepted GRNs) | delete header only; DB cascades; friendly FK error |
| B | PO delete could strand an empty PO header | same pattern |
| C | Editing a quotation deleted all lines before re-inserting | insert first, then delete leftovers **by quotation_id** |
| D | Quotation→Order bypassed the RPC, created no colourways (0% forever) | uses `save_order_with_rows_and_colourways` + one default colourway per row |
| E | Bulk deletes reported partial results as total failure | all report the count actually deleted |
| F | Dead `order.orderQty` fallbacks → 0% progress for colourless orders | fall back to `order_rows` qty in order-delay, order-health, 3 Dashboard sites |
| G | Stitching list missing Product/Fabric columns | added, colSpans corrected to 10 |
| H | No sorting on any master list | `MasterCRUD` click-to-sort (keyboard accessible) + opt-in `groupBy`, wired to factory |

### Review pass — five issues found in the agents' output, all fixed
1. Quotation edit deleted old lines by **cached** ids; a second edit in one session
   would have silently duplicated every line and doubled the total. Now deletes by
   `quotation_id`, excluding the just-inserted ids, and refreshes the cache.
2. `convertToOrder`'s early `return` skipped `setConvertingId(null)` — Convert button
   stuck disabled after any failure. Moved to `finally`.
3. A failed "mark accepted" showed an error toast *and* a success toast, then navigated
   away. Now returns after the warning.
4. The Playwright grouping test passed vacuously on an empty table. Now asserts rows
   exist first.
5. `MasterCRUD` sortable headers were mouse-only. Added `role`/`tabIndex`/Enter+Space
   and `aria-sort`.

## End-to-end verification — DONE (commit `b0a7d9a`)

`npx playwright test order-fixes --project=chromium` → **7/7 passing** against a real
browser. Covers: summary columns populated, totals non-zero, blocked delete refused in
plain English *with the order verified still intact afterwards*, clean delete works,
status dropdown writes through to the DB, printing tables grouped by factory.

Test account: `steelman@fabrios-demo.com`, password rotated 2026-08-18 and stored in
**`.env.test`** (gitignored, mode 600; `playwright.config.ts` loads it automatically).
Verified absent from all git history.

**Scoping — important:** that account belongs to the *SteelM Industries* company, the
test playground with ~168 throwaway orders. Your live company is **Poddar Exports**
(22 Godown, Sanganer). Confirmed after the run that Poddar Exports still had exactly
its 6 orders / 2 production entries / 505 colourways, matching the pre-work backup, and
the spec left no seeded rows behind. Keep tests pointed at SteelM.

Two failures in the first run were faults in the spec, not the app (singular page
heading; `[role=combobox]` matching the header's factory selector). Fixed, and the
status trigger gained `aria-label="Order status"` — it previously had no accessible
name.

## Backups

- `npm run backup` → all 40 tables to `~/Backups/fabrios/<timestamp>/`, **outside the
  repo** so live customer data is never committed. Table list is read from the generated
  types, so schema changes are picked up automatically.
- Backups taken 2026-08-18: three pre-purge (3,239 rows each) and one post-purge
  (91 rows). The pre-purge ones are the only copy of the deleted test data.
- **Not covered:** data only. Schema is in `supabase/migrations/` + `schema.sql`.
  **There is no restore script** — restoring would mean re-inserting the JSON in FK
  order. Worth building.
- **OPEN TODO for Anirudh:** confirm in the Supabase dashboard (Database → Backups)
  whether daily backups / PITR are enabled for `ejebukxlwgwebjgdicyb`. Free tier has
  none. Claude cannot check — the CLI account signed in on this Mac cannot see that
  project.

## Database cleanup — DONE 2026-08-18

Was 20 companies; 18 were junk from old E2E runs and 1 was the old SteelM test company.

- Deleted **3,156 rows across 19 companies**, plus **21 throwaway auth logins**
  (`@fabrios-e2e.com`, `@fabrios-test.com`) and their orphaned profiles.
- Kept: **Poddar Exports** (live) and the login `info@poddarexp.com`.
- Verified afterwards: Poddar Exports still has exactly 6 orders, 2 production entries,
  4 buyers, 4 fabrics, 2 factories — identical to the pre-purge backup.
- The purge stopped safely mid-run the first time (`worker_types.factory_id` blocked
  the factories delete) and resumed once reordered — nothing was left half-deleted.

### Test environment — rebuilt from scratch
- `npm run seed:test` creates **"FabriOS Test Co"**: 2 factories, shifts, 4 interleaved
  printing tables (so the grouping test has something real to prove), worker type, rate
  master, buyer, fabric, printing + stitching product — and points the test account at
  it. Safe to re-run; it wipes and recreates.
- Test account `steelman@fabrios-demo.com` now belongs to that company. Credentials in
  gitignored `.env.test`.
- `tests/helpers.ts` `TEST_COMPANY` updated to `FabriOS Test Co`.
- **`npx playwright test order-fixes --project=chromium` → 7/7 passing, none skipped.**
  A previously skipped totals test now seeds two different delivery months so the
  sub-total/page-total rows actually render, and fails loudly if they don't.
- Older specs still reference the deleted SteelM data (`steelman-full-lifecycle`,
  `steelman-user-audit`, `qa-full`) — they will need reworking against the new seed
  before they can run again.

## Housekeeping worth doing

The database holds **20 companies**, of which 18 are junk from old E2E runs
("Lifecycle Corp-*", "Zero Prod Corp-*", "E2E Test Company", "Probe Corp") — one of them
carrying 20 orders and 25 factories. Only *Poddar Exports* (live) and *SteelM
Industries* (test) are real. Worth purging, carefully, with a backup in hand.

## Manual live checklist (if not running Playwright)
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


### Additionally worth checking now
11. Settings → Printing Tables: rows grouped under a factory heading with a count; click any column header to sort.
12. Quotations: edit a quotation's lines, save, then edit and save **again** — line items must not duplicate.
13. Quotations: convert one to an order — the new order must show a colourway and real progress, not 0%.
14. GRN: try deleting an accepted GRN — must refuse in plain English, and its line items must survive.
