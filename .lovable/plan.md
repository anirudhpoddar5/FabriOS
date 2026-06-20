

# PrintTrack V2 — Batch 2+3 Combined Implementation Plan

This is a large coordinated update covering bug fixes, order detail views, entry improvements, enhanced reports, and dashboard upgrades. Given the scope, I'll implement this as one coordinated update across ~15 files.

---

## 1. Fix Date Inputs on Order Forms
- The current `<Input type="date">` should work natively. The issue is likely the date inputs being inside a Dialog where pointer-events get blocked.
- Replace date fields in PrintingOrdersPage and StitchingOrdersPage with proper date inputs ensuring they work inside dialogs.
- Ensure dates persist correctly (they're already stored as ISO strings in localStorage).

## 2. Order Detail View (New Component + Routes)
- Create `src/pages/OrderDetailPage.tsx` — a shared detail page for both printing and stitching orders.
- Add routes: `/printing-orders/:id` and `/stitching-orders/:id`.
- Make order table rows clickable (navigate to detail page on click, keep pencil for edit dialog).
- Detail page shows: all order header fields, colourway table with per-colour produced/balance/percentage, cost-to-date, output-to-date, status badges, progress bar.
- Back button to return to order list.
- Status logic: Not Started (0% produced), In Progress (<100%), Completed (100%), Overproduced (>100%), Delayed (past target end date and not completed).

## 3. Fix Module Context in Entries
- `EntriesPage` reads `currentModule` from `useAuth()` and defaults module selector accordingly.
- `SingleEntryForm` and `BulkEntryGrid` accept a `defaultModule` prop derived from `currentModule`.
- Labels switch correctly (Table vs Line).

## 4. Factory Selection UX
- In SingleEntryForm and BulkEntryGrid: if no factory selected, show an alert banner "Please select a factory first" and disable shift/resource dropdowns.
- Auto-select factory if only one exists for the current module context.

## 5. Worker Type Module Awareness
- Worker type dropdowns already filter by module — add module label suffix in dropdowns: e.g. "Printer (Printing)", "Tailor (Stitching)", "Helper (Both)".

## 6. Better Filters/Search/Sort on Orders Pages
- Add status filter dropdown and buyer filter to order list pages.
- Add sort by date, PO number, status.
- Add progress column (produced/ordered %) with color-coded progress bar.

## 7. Enhanced Dashboard
- Add more KPI cards: Delayed Orders, Completed This Week, Total Active Orders.
- Make cards clickable — navigate to filtered reports or order lists.
- Show module-specific breakdowns.

## 8. Reports Improvements
- Fix status filter dropdown values (currently shows Draft/Open/Closed, should be Started/Completed/Cancelled/Shipped).
- Add product filter.
- Add default date range (last 30 days).
- Add color-coded status badges in report tables.
- Add progress percentage column with visual indicator.
- Improve CSV export to include all visible columns.

## 9. Entry Workflow Polish
- After saving single entry, keep date/shift/resource/worker type pre-filled for repeated entries.
- Allow 0 as valid output qty (currently `|| 0` prevents typing 0).
- Show cumulative totals row in bulk grid.
- Filter shifts by current factory in both entry forms.

## 10. Deployment
- The app can be published via Lovable's built-in publish button. I'll note this for the user after implementation — no code changes needed.

---

## Files to Create
- `src/pages/OrderDetailPage.tsx` — shared order detail/progress view

## Files to Modify
- `src/App.tsx` — add order detail routes
- `src/pages/PrintingOrdersPage.tsx` — clickable rows, filters, progress column, date fix
- `src/pages/StitchingOrdersPage.tsx` — same as above
- `src/pages/EntriesPage.tsx` — module context default
- `src/components/entries/SingleEntryForm.tsx` — factory UX, module default, worker labels, repeated entry workflow
- `src/components/entries/BulkEntryGrid.tsx` — factory UX, module default, totals row, shift filtering
- `src/pages/DashboardPage.tsx` — enhanced KPIs, clickable cards
- `src/pages/ReportsPage.tsx` — fix status values, add product filter, date defaults, color coding
- `src/components/AppSidebar.tsx` — no changes needed (already module-aware)

## Technical Notes
- Order detail page uses `useParams()` to get order ID, determines module from URL prefix.
- Progress calculation: `producedQty / orderedQty * 100` per colourway and per order.
- Status derivation logic is display-only (doesn't change stored status).
- All existing data structures remain compatible — no schema changes needed.

