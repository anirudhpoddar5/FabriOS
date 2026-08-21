# Resume notes — FabriOS (2026-08-20)

## STATE: the tool is proven to work end to end

`npx playwright test zero-to-production-pipeline --project=chromium --workers=1`
→ **24/24 passing, twice in a row.**

Signup → company setup → module select → factory, shift, worker type, rate master,
buyer, fabric, product, printing table, vendor → printing order → BOM → PO generated
from that BOM → GRN → production entry → dispatch → stock job → inventory inward →
reports → log out, log back in, data still there.

This spec had **never once run** before today: it signs up a new user but inherited a
logged-in session, so step 1 always timed out and the other 22 were skipped. 816 lines
that looked like coverage and proved nothing.

### Everything currently green
| Check | Result |
|---|---|
| `npx vitest run` | 133/133 |
| `npm run build` | clean |
| `npx playwright test zero-to-production-pipeline` | 24/24 (×2) |
| `npx playwright test order-fixes office-grid-entry` | 10/10 |
| `npx playwright test ui-audit` | 31/31, **0 findings across 30 routes** |

### The instruction that still governs
**No new features. Prove and repair what exists.** Supplier-bill entry is a real gap in
the process chain and is DEFERRED — do not build or re-propose it.

### Every pipeline failure was a stale test, not an app defect
Corrected: inherited session; `text-is()` never matching a required label (`Name *`);
`.first()` picking "Bulk Add" over "Add"; dropdowns searched by code where the app lists
names, and by style where it lists the internal PO; the order dialog labels are
"Customer *" and "Style / Design *"; the rate dialog has no Worker Type field; the
dispatch assertion looked for a vehicle number in a list with no vehicle column; a fixed
3s re-login wait that flaked under load; the guided-tour flag set after navigation.

**Three helpers were made stricter, and that is what exposed the rest:** `selectShadcn`
now throws instead of silently skipping (2.04 had been passing only because the app
auto-selects when one option exists), `noError` fails on an on-screen refusal toast, and
`checkToast` fails when no confirmation appears — it had been looking for markup sonner
does not emit and silently verified nothing on five steps.

Only one assertion is looser, because the old one was wrong: 1.01 demanded the setup
wizard, but the app deliberately shows "Your account has been created!" and may or may
not have advanced past it.

### Two real observations about the app — noted, not fixed
1. The **guided tour overlay covers the header** while open; Sign out is unreachable
   until it is dismissed.
2. **Where a new user lands after signup varies** (confirmation screen / wizard /
   module select) depending on how fast the session activates.

### Housekeeping — do not skip
Each pipeline run creates a company and a login. **`npm run clean:test`** (dry run) and
`npm run clean:test -- --execute`. It keeps only **Poddar Exports** (live) and
**FabriOS Test Co** (test). Currently clean: exactly those two.

## Live blocker for the owner (data, not code)

Production entries cannot be saved for **Sanganer** because no rate masters exist
for it — all four are for 22 Godown. Verified against live data.
Fix: Settings -> Workers & Rates -> click the worker type in the left list ->
**Add Rate** -> choose Factory = Sanganer. Confirmed this dialog has Factory and
Shift selectors and that the flow works (pipeline step 2.04 passes).
The grid now states this reason on screen instead of hiding it in a tooltip.

## Fixed and live today (https://afbe6328.fabrios.pages.dev)

| Reported by owner | Cause |
|---|---|
| Delete failed with a database error | Correct refusal, shown in raw Postgres text; also a half-delete risk |
| Product/Fabric/Qty blank, totals 0 | Read from order header; those fields live on order rows |
| No way to set order status | No control on the order page |
| "How to sort factory wise?" | MasterCRUD had no sorting at all |
| Persons/Output "won't accept input" | Accepted fine — 13px of usable width, digits clipped out of view |
| Product selection did nothing | validateRow overwrote the chosen product with the colour-derived value |
| "Unable to save", no reason given | Row errors hidden in a tooltip on a 14px icon |

Found and fixed without being reported: GRN delete destroying line detail,
quotation edit losing line items, quote->order creating 0%-forever orders,
zero-qty fallbacks hiding orders from the dashboard, Reports "Total Qty" always 0,
Reports date filters clipped on all 20 tabs, and the same input clipping in 8 pages.

## UI audit — built, validated, and now clean

`npx playwright test ui-audit --project=chromium` — 30 routes plus their tabs and
dialogs. Detects: inputs too narrow to show their value, clipped text, dropdowns
that discard your choice, disabled actions with no stated reason, colSpan
mismatches, raw `undefined`/`NaN` on screen, console errors.

**Validated against known bugs before being trusted** — v1 found zero of the three
reported bugs because it never opened tabs. v2 finds them.
**33 findings -> 1**, and that one is the detector being fussy about a hint that
is already in place.

## The process chain — verified by reading code and live data

quotation -> order -> production; order -> BOM -> PO -> GRN -> stock.
All those links exist in the schema AND are written by the app.

Two real weaknesses, neither fixed:
1. **No way to record a supplier bill.** invoice_number/amount/date/payment_status
   are displayed on the PO page, the PO list and Bill Tracking, and exported to
   CSV — but nothing writes them. Bill Tracking can only ever be empty. DEFERRED
   by the owner.
2. **Unknown material cost counts as zero, not unknown.** In `order_cost_summary`,
   `COALESCE(po_rate, bom_rate, 0)` silently understates cost. ReportsPage handles
   this correctly (shows N/A); the view does not.
   Also, the purchase price is chosen per item across all POs, not the PO linked
   to that order.

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
