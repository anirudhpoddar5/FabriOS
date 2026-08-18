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

## STILL NOT DONE — end-to-end verification

Unit tests (133/133), build and lint all pass, and a mutation check confirms the new
regression tests genuinely fail when their fix is removed. **But nothing has been
click-tested against a running app.**

`tests/order-fixes.spec.ts` is written and ready — it seeds its own throwaway orders
via the service-role client and cleans up after itself, covering: the summary columns,
the refused delete (asserting the order survives), a clean delete, the status dropdown,
and factory grouping.

It cannot run because the saved Playwright session
(`playwright/.auth/user.json`) expired on 2026-07-27 and there is no test password
available. To enable it, create `.env.test` (gitignored) containing:

```
FABRIOS_TEST_EMAIL=steelman@fabrios-demo.com
FABRIOS_TEST_PASSWORD=<the demo account password>
```

`playwright.config.ts` now loads that file automatically. Then:

```
npx playwright test order-fixes --project=chromium
```

Do NOT run `--project=qa-full` alongside it: that spec wipes 22 tables for the
current company.

The manual checklist below remains valid as an alternative.

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
