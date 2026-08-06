# FabriOS — Codex Notes

## 1. PROJECT OVERVIEW

**FabriOS** is a production OS for print and stitch manufacturing businesses. It lets users:

- Create and track printing and stitching orders with colourways
- Log daily production entries (date + resource + worker type + qty + cost)
- Manage BOMs and generate purchase orders from material requirements
- Track goods receipt (GRN), inventory stock levels, and dispatches
- Create quotations, invoices, and subcontract jobs
- Track worker attendance and material consumption against BOM
- Configure master data: factories, shifts, worker types, rate masters, buyers, fabrics, products

**Target users:** Small-to-medium print/stitch factories. Multi-module: a company can operate in printing only, stitching only, or both.

**Auth model:** Users register, get placed in `pending` approval, then an admin approves them. A one-time setup wizard creates the company record. There is no multi-tenancy beyond `company_id` row-level filtering.

---

## 2. TECH STACK

| Layer | Library | Version |
|---|---|---|
| UI framework | React | 18.3.1 |
| Language | TypeScript | 5.8.3 |
| Build tool | Vite | 5.4.19 |
| Styling | Tailwind CSS | (via postcss) |
| Component library | shadcn/ui (Radix UI primitives) | 40+ components |
| Routing | react-router-dom | 6.30.1 |
| Server state | @tanstack/react-query | 5.83.0 |
| Backend / DB | @supabase/supabase-js | 2.101.1 |
| Forms | react-hook-form | 7.61.1 |
| Validation | zod | 3.25.76 |
| Dates | date-fns | 3.6.0 |
| Charts | recharts | 2.15.4 |
| Toast notifications | sonner | 1.7.4 |
| Icons | lucide-react | 0.462.0 |
| Theme | next-themes | 0.3.0 |
| Testing (unit) | Vitest | 3.2.4 |
| Testing (e2e) | Playwright | 1.57.0 |

**Dev commands:**
```bash
npm run dev        # Dev server on localhost:8080
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run Vitest
npm run lint       # ESLint
```

**Environment variables (`.env`):**
```
VITE_SUPABASE_URL=https://ejebukxlwgwebjgdicyb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<JWT>
VITE_SUPABASE_PROJECT_ID=ejebukxlwgwebjgdicyb
```

**Deploy:** Cloudflare Pages via `npx wrangler pages deploy dist --project-name fabrios` (not Vercel). `npm run deploy` wraps this.

---

## 3. FOLDER STRUCTURE

```
fabrios-main/
├── index.html                      # HTML shell — title "FabriOS"
├── vite.config.ts                  # Vite config — dev port 8080
├── tailwind.config.ts              # Tailwind config
├── src/
│   ├── main.tsx                    # React root mount
│   ├── App.tsx                     # Provider stack + routing (QueryClient → AuthProvider → Router)
│   ├── index.css                   # Global styles + Tailwind base
│   ├── vite-env.d.ts               # Vite type shims
│   │
│   ├── context/
│   │   ├── AuthContext.tsx         # Auth state: session, user, profile, currentModule — see §4
│   │   └── DataContext.tsx         # All master data + order data; CRUD via Supabase — THE critical file
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts               # Supabase JS client singleton (localStorage session)
│   │   └── types.ts                # Auto-generated DB types — Row/Insert/Update per table (2000+ lines)
│   │
│   ├── types/
│   │   └── index.ts                # Frontend TypeScript interfaces: User, Factory, PrintingOrder, etc.
│   │
│   ├── lib/
│   │   ├── utils.ts                # cn() helper (clsx + tailwind-merge)
│   │   ├── pdf-export.ts           # PDF generation utility
│   │   └── countries.ts            # Country list for buyer master
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx          # Mobile viewport detection
│   │   └── use-toast.ts            # Toast hook wrapper
│   │
│   ├── components/
│   │   ├── AppLayout.tsx           # Main grid: sidebar + header + <Outlet>
│   │   ├── AppHeader.tsx           # Top bar: module badge, factory selector, user menu
│   │   ├── AppSidebar.tsx          # Left nav sidebar
│   │   ├── NavLink.tsx             # Active-aware nav link
│   │   ├── MasterCRUD.tsx          # Generic CRUD table+dialog component (used by all settings pages)
│   │   ├── ExplainerTip.tsx        # Small (i) tooltip — use for any metric that isn't self-evident from its label
│   │   ├── entries/
│   │   │   ├── SingleEntryForm.tsx # Single production entry: cascading selects + rate lookup + cost calc
│   │   │   └── BulkEntryGrid.tsx   # Multi-row entry with clipboard paste support
│   │   └── ui/                     # 40+ shadcn/ui components (accordion, badge, button, dialog, etc.)
│   │
│   ├── pages/
│   │   ├── Login.tsx               # Auth page (sign-in / sign-up / forgot-password tabs)
│   │   ├── ResetPassword.tsx       # Password reset
│   │   ├── SetupWizard.tsx         # One-time company creation + auto-approve
│   │   ├── PendingApproval.tsx     # Shown to unapproved users
│   │   ├── ModuleSelect.tsx        # Choose printing / stitching / both
│   │   ├── LandingPage.tsx         # Public marketing landing page
│   │   ├── DashboardPage.tsx       # KPI cards, WIP progress, active/delayed counts
│   │   ├── PrintingOrdersPage.tsx  # Order list + create/edit dialog with colourways
│   │   ├── StitchingOrdersPage.tsx # Same structure as printing orders
│   │   ├── OrderDetailPage.tsx     # Order detail: colourway list + entry sub-table
│   │   ├── OrderPODPage.tsx        # Printable proof-of-delivery view for an order
│   │   ├── EntriesPage.tsx         # Tabs: SingleEntryForm + BulkEntryGrid
│   │   ├── AttendancePage.tsx      # Worker attendance (check-in/out, hours, overtime)
│   │   ├── ReportsPage.tsx         # 20-tab report viewer with CSV/Excel/PDF export — see §6 for full tab list
│   │   ├── ProductionControlPage.tsx # WIP / Bottlenecks / Capacity tabs
│   │   ├── BomPage.tsx             # BOM headers + lines; generate POs from BOM (atomic RPC)
│   │   ├── BOMDetailPage.tsx       # Single BOM detail view
│   │   ├── QuotationsPage.tsx      # Quotation list + create/edit, convert to order
│   │   ├── PurchaseOrdersPage.tsx  # PO list + create/edit (atomic RPC)
│   │   ├── PODetailPage.tsx        # Single PO detail view
│   │   ├── GRNPage.tsx             # Goods receipt notes (atomic RPC)
│   │   ├── GRNDetailPage.tsx       # Single GRN detail view
│   │   ├── DispatchPage.tsx        # Dispatch records
│   │   ├── InvoicesPage.tsx        # Invoice list + create/edit, AR tracking
│   │   ├── StockJobsPage.tsx       # Stock production jobs (not linked to customer orders)
│   │   ├── SubcontractJobsPage.tsx # Outsourced process jobs (send/receive qty, vendor)
│   │   ├── MaterialIssuesPage.tsx  # Material issue tracking vs BOM planned qty
│   │   ├── InventoryPage.tsx       # Inventory items + stock transactions
│   │   ├── VendorsPage.tsx         # Vendor master
│   │   ├── HelpPage.tsx            # In-app help/FAQ
│   │   ├── TermsPage.tsx / PrivacyPage.tsx  # Static legal pages
│   │   ├── NotFound.tsx            # 404
│   │   └── masters/
│   │       ├── CompaniesPage.tsx         # Company settings (incl. base_currency)
│   │       ├── FactoriesShiftsPage.tsx   # Factory + shift master (tabbed)
│   │       ├── WorkersRatesPage.tsx      # Worker types + rate masters (tabbed)
│   │       ├── BuyersPage.tsx            # Buyer master + bulk add
│   │       ├── FabricsPage.tsx           # Fabric master
│   │       ├── PrintingTablesPage.tsx    # Printing table master
│   │       ├── StitchingLinesPage.tsx    # Stitching line master
│   │       ├── PrintingProductsPage.tsx  # Printing product master
│   │       ├── StitchingProductsPage.tsx # Stitching product master
│   │       └── UsersPage.tsx             # User management + approval
│   │
│   └── test/
│       ├── setup.ts                # Vitest test setup
│       └── example.test.ts         # Example test
```

---

## 4. KEY FILES

### `src/context/DataContext.tsx` — Central data cache and CRUD

This is the most important file. It:
- Maintains a single `AppData` object in React state covering the app's master + order data (factories, buyers, orders, entries, companies, etc.)
- Maps frontend camelCase keys to Supabase snake_case table names via `TABLE_MAP`
- Auto-converts camelCase ↔ snake_case with `objectToSnake()` / `objectToCamel()` / `dbToFrontend()` / `frontendToDb()`
- Exposes `addItem`, `updateItem`, `deleteItem`, `addItems`, `getItems`, `refreshData`
- On insert: adds `company_id` for company-scoped tables; handles `module` for orders

**Multi-table writes bypass the generic `addItem`/`updateItem` path.** Any write that touches more than one table (order + rows + colourways, PO + lines, BOM + lines, GRN + lines) goes through a dedicated `SECURITY INVOKER` Postgres RPC instead — `save_order_with_rows_and_colourways`, `save_po_with_lines`, `save_bom_with_lines`, `save_grn_with_lines` (see `supabase/migrations/20260710*.sql`). This is the established, atomic pattern — **never** reintroduce sequential client-side inserts for these flows (this happened once, in an uncommitted regression, and was reverted).

### `src/context/AuthContext.tsx` — Auth and module selection

Stores `session`, `user`, `profile` (from `profiles` table). Profile shape: `{ id, display_name, email, approval_status, company_id, is_active }`. Module selection persisted in localStorage key `fabrios_module`. Factory selection persisted in `fabrios_factory`.

### `src/types/index.ts` — Frontend TypeScript interfaces

Defines `PrintingOrder`, `StitchingOrder`, `PrintingColourway`, `ProductionEntry`, etc. — the camelCase shapes used throughout the frontend. `PrintingOrder`/`StitchingOrder` fields that describe a specific line item (`fabricId`, `orderQty`, `chartQty`, `ratePerItem`, `noOfColours`, `fabricWidth`, `printingProductId`) live in `order_rows` in the DB, not `order_headers` — the order save RPC (`save_order_with_rows_and_colourways`) is what reconciles this split; don't read/write those fields directly against `order_headers`.

### `src/integrations/supabase/types.ts` — Auto-generated DB types

Source of truth for actual DB column names — check this file when any column name is in doubt. Regenerate with the Supabase CLI when schema changes. **Known gap:** `companies.base_currency` (added by `supabase/migrations/20260804000000_company_base_currency.sql`) is not yet reflected here — the frontend reads it fine anyway (`appData.companies[0].baseCurrency`) because `dbToFrontend()` converts whatever Supabase actually returns rather than relying on this file's declared shape, but this file is due for a regeneration.

### `src/components/MasterCRUD.tsx` — Generic CRUD component

All settings/master pages use this. Props: `title`, `dataKey` (key in `AppData`), `columns`, `renderForm`, `defaultValues`, `validate`. Features: search, active/inactive toggle (soft deactivate only — no hard delete), duplicate-save guard (`saving` state + ref, plus a client-side code/name uniqueness pre-check). No delete button is shown.

### `src/components/entries/SingleEntryForm.tsx`

Production entry: order → colourway → shift → resource → worker type → persons + output qty. Auto-looks up active rate master for (factory, shift, worker type, date). Cost = `persons * rate_value` (per-person) or `output_qty * rate_value` (per-piece/meter).

### `src/components/ExplainerTip.tsx`

A small `(i)` tooltip icon (`@/components/ui/tooltip`). Use this whenever a displayed number/label could plausibly be misread as measuring something it doesn't (e.g. a headcount ratio that could look like a throughput measure) — a code comment does not help the end user, an `ExplainerTip` does.

---

## 5. DATA FLOW

### Reading data (on app load)

```
AuthContext detects session → profile.company_id available
    ↓
DataContext.fetchAllData() — fires once via useEffect + loadedRef guard
    ↓
Parallel Supabase queries (companies, factories, shifts, buyers, order_headers, order_rows, ...)
    ↓
Results mapped through dbToFrontend() (snake_case → camelCase, is_active → active alias)
    ↓
order_headers split by module field → printingOrders / stitchingOrders
    ↓
setData(AppData) — single React state update
    ↓
All page components read from useData().data (no per-page fetches for master data)
```

Pages that need data NOT in AppData (BOM, Quotations, POs, GRN, Invoices, Inventory, StockJobs, SubcontractJobs, MaterialIssues, Attendance) use `useQuery` directly with the Supabase client.

### Writing data — two paths

**Single-table writes** (most master data, entries, dispatch records) go through `DataContext`'s generic `addItem`/`updateItem`:

```
User fills form in a dialog
    ↓
handleSave() calls addItem(key, item) or updateItem(key, id, updates)
    ↓
DataContext.addItem():
  1. frontendToDb(item) — camelCase → snake_case, strips active/createdAt
  2. Injects company_id, module (for orders)
  3. Strips undefined keys + created_at / updated_at
  4. supabase.from(TABLE_MAP[key]).insert(dbRow)
  5. Optimistically updates local state (no re-fetch)
    ↓
Error → return { error: error.message } → page shows toast.error()
Success → return { error: null } → page shows toast.success(), closes dialog
```

**Multi-table writes** (orders, POs, BOMs, GRNs) call the dedicated RPCs directly via `supabase.rpc(...)` from the page component — see §4. These are atomic on the Postgres side; the page still updates local `AppData` state afterward (usually via a re-fetch of the relevant query, not the optimistic-update pattern above).

**Important:** the single-table path has NO automatic re-fetch after writes — local state is updated optimistically. Call `refreshData()` if you need to sync with DB.

### Rate lookup (entries)

```typescript
// In SingleEntryForm / BulkEntryGrid:
rateMasters.find(r =>
  r.active &&
  r.factoryId === factoryId &&
  r.shiftId === shiftId &&
  r.workerTypeId === workerTypeId &&
  r.effectiveFrom <= date &&
  (!r.effectiveTo || r.effectiveTo >= date)
)
```

ISO date string comparison is used — works correctly for `YYYY-MM-DD` strings.

---

## 6. DATABASE

All tables are in the Supabase `public` schema with `company_id`-based row filtering (RLS assumed). The canonical column names are in `src/integrations/supabase/types.ts` (except `companies.base_currency`, see §4).

### order_headers

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `module` | text | `'printing'` or `'stitching'` |
| `internal_po` | text | NOT NULL — auto-generated (e.g., `PO-P-0001`) |
| `buyer_po` | text \| null | Buyer's PO reference |
| `buyer_p_o` | text \| null | Duplicate column, still present in schema — unclear if intentional or a migration artifact; `buyer_po` is the one the app writes to |
| `buyer_id` | uuid \| null | FK → buyers |
| `quotation_id` | uuid \| null | FK → quotations, set when an order was converted from a quotation |
| `style` | text \| null | Style code string |
| `currency` | text | Buyer-facing order currency, e.g. `'USD'`, `'INR'` — distinct from `companies.base_currency` (internal/procurement currency); never conflate the two |
| `target_end_date` | text \| null | ISO date string |
| `buyer_delivery_date` | text \| null | ISO date string |
| `remarks` | text \| null | |
| `status` | text | `'Started'` \| `'Completed'` \| `'Shipped'` \| `'Cancelled'` |
| `created_at` / `updated_at` | timestamptz | DB-managed |

`order_headers` does not carry line-item fields (`fabric_id`, `order_qty`, `chart_qty`, `uom`, `rate_per_item`, `no_of_colours`, `fabric_width`, `printing_product_id`) — those belong to `order_rows`. Every order write goes through `save_order_with_rows_and_colourways`, which creates the header, its `order_rows`, and their `order_colourways` in one atomic call.

### Other tables

| Table | Key columns |
|---|---|
| `order_rows` | `id, order_id, product_id, fabric_id, fabric_width, order_qty, chart_qty, uom, no_of_colours, rate_per_item, sort_order` |
| `order_colourways` | `id, order_row_id, colour_name, ordered_qty, uom, size, notes, sort_order` |
| `production_entries` | `id, company_id, date, module, order_id, order_row_id, colourway_id, factory_id, shift_id, resource_id, worker_type_id, persons_used, output_qty, output_uom, rate_master_id, rate_basis, rate_value, cost_amount, notes` — note `worker_type_id` is a category/role FK, not an individual employee; there is no per-entry link to the `workers` table |
| `rate_masters` | `id, company_id, factory_id, shift_id, worker_type_id, rate_basis, rate_value, effective_from, effective_to, is_active` |
| `companies` | `id, name, legal_name, address, is_active, working_days, created_by` + `base_currency` (see §4) |
| `factories` | `id, company_id, code, name, type ('printing'\|'stitching'\|'mixed'), is_active` |
| `shifts` | `id, factory_id, code, name, start_time, end_time, is_active` |
| `worker_types` | `id, company_id, name, module, is_active` — a role/category master ("Tailor", "Operator"), not individual people |
| `workers` | `id, company_id, employee_code, name, phone, factory_id, worker_type_id, hourly_rate, is_active` — individual named employees, used by Attendance; **not** referenced by `production_entries` |
| `attendance` | `id, company_id, worker_id, date, shift_id, check_in, check_out, hours_worked, overtime_hours, status, notes` |
| `printing_tables` | `id, factory_id, code, name, size, supervisor_name, is_active` |
| `stitching_lines` | `id, factory_id, code, name, machines, supervisor_name, is_active` |
| `buyers` | `id, company_id, code, name, contact_person, country, phone, email, address, is_active` |
| `fabrics` | `id, company_id, name, short_form, gsm, width, width_unit, is_active` |
| `printing_products` | `id, company_id, code, name, size, uom, is_active` |
| `stitching_products` | `id, company_id, code, name, size_spec, uom, is_active` |
| `profiles` | `id (= auth.users.id), display_name, email, approval_status, company_id, is_active` |
| `quotations` | `id, company_id, quotation_number, buyer_id, date, valid_until, currency, subtotal, tax_percent, tax_amount, total, status, remarks` |
| `bom_headers` | `id, company_id, title, bom_type ('order'\|'stock'\|'manual'), order_id, status, remarks` |
| `bom_lines` | `id, bom_id, category, item_name, item_id, quantity, uom, avg_consumption, extra_pct, rate, total_amount (nullable), vendor_name, sort_order` |
| `material_issues` | `id, company_id, order_id, row_id, item_id, item_name, uom, date, qty_issued, qty_consumed, qty_wasted, notes` — actual-vs-BOM-planned consumption tracking |
| `purchase_orders` | `id, company_id, po_number, vendor_id, po_date, status, currency, total_amount, source_type, order_id, invoice_number, invoice_amount, invoice_date, payment_status, remarks` |
| `purchase_order_lines` | `id, po_id, item_name, item_id, uom, qty_ordered, rate, amount` — no `sort_order` column (a migration once assumed one; see `20260803120000_fix_po_lines_sort_order_column.sql`) |
| `grn_headers` | `id, company_id, grn_number, vendor_id, grn_date, status` |
| `grn_lines` | `id, grn_id, item_id, qty_received, remarks` |
| `inventory_items` | `id, company_id, code, name, category, uom, reorder_level, opening_stock, is_active` |
| `stock_transactions` | `id, company_id, item_id, txn_date, txn_type, qty, lot_number, batch_number, remarks, grn_id, order_id, stock_job_id, vendor_id, uom` — written by the GRN receipt RPC (`inward`), production auto-consumption (`consumption`), and `InventoryPage`'s manual entry dialog |
| `stock_jobs` | `id, company_id, job_number, product_name, module, target_qty, produced_qty, uom, status, start_date, end_date, remarks` |
| `dispatch_records` | `id, company_id, dispatch_date, order_id, buyer_id, qty, product_name, size, colour, challan_number, vehicle_number, dispatch_type, remarks, uom` |
| `invoices` | `id, company_id, invoice_number, buyer_id, order_id, dispatch_id, invoice_date, due_date, currency, subtotal, tax_percent, tax_amount, grand_total, status, payment_date, payment_mode, notes` |
| `subcontract_jobs` | `id, company_id, job_number, order_id, subcontractor_id, process, product_description, send_date, expected_return_date, received_date, qty_sent, qty_received, qty_balance, rate, amount, status, notes` |
| `vendors` | `id, company_id, code, name, contact_person, phone, email, address, payment_terms, is_active` — also used as the subcontractor list on `SubcontractJobsPage` |
| `onboarding_progress` | `id, company_id, company_done, factories_done, buyers_done, fabrics_done, printing_products_done, printing_tables_done, stitching_lines_done, stitching_products_done, wizard_completed` |

---

## 7. WHAT IS WORKING

These modules are in a stable state and should not be touched unless fixing a specific bug:

- **Auth flow** — Login, register, forgot password, reset password, setup wizard, pending approval page
- **Master CRUD pages** — All settings pages (factories, shifts, worker types, rate masters, buyers, fabrics, printing/stitching products, tables/lines, users, companies). All use `MasterCRUD` and `DataContext.updateItem/addItem`, with duplicate-save guards.
- **Production entry** — `SingleEntryForm` and `BulkEntryGrid`. Rate lookup and cost calculation are correct.
- **Order save/edit** — Printing and Stitching orders, including colourways and "No. of Colours", via the atomic RPC.
- **Dashboard** — KPI cards, WIP summary, progress bars.
- **Reports** — 20-tab report page (Order Status, Production, Daily Detail, Factory Output, Delayed, Dispatch, PO Status, Pending Purchase, GRN Pending, Bill Tracking, Stock On Hand, Shortage, Inward/Outward, Consumption vs BOM, Capacity vs Demand, Vendor Performance, By Buyer, Profit/Loss, Monthly Trend, Operator Productivity), CSV/Excel/PDF export on every tab.
- **BOM** — Full save/edit and PO generation, via atomic RPCs.
- **Purchase Orders, GRN** — Full save/edit, via atomic RPCs.
- **Dispatch, Inventory** — Direct Supabase queries, independent of the order data model.
- **Stock Jobs, Quotations, Invoices, Subcontract Jobs, Material Issues, Attendance** — Full CRUD.
- **Production Control** — WIP / Bottlenecks / Capacity tabs.

**Not yet built:** single-document printing for challans/POs/GRN/dispatch (a dedicated print layout beyond the generic list-export PDFs) — blocked on the owner supplying a sample of their actual paper format.

---

## 8. OPEN QUESTIONS — RESOLVED

These were open questions in an earlier version of this file. Recorded here for history; all are now answered.

1. **Colourway `orderId` shim / `order_rows` never created** — resolved. Orders are saved via `save_order_with_rows_and_colourways`, which atomically creates the header, its `order_rows`, and their `order_colourways` in one transaction. `order_colourways.order_row_id` always has a valid `order_rows` FK.
2. **Two `buyer_po` columns** — `buyer_p_o` still exists in the schema alongside `buyer_po`; the app only writes `buyer_po`. `buyer_p_o` looks like a migration artifact but hasn't been dropped — treat it as dead, don't write to it.
3. **`order_headers` missing expected columns** — resolved; this was the header/row split, and the frontend types and save path are now reconciled via the RPC (see §4, §6).
4. **Optimistic updates without re-fetch** — still true for the single-table `addItem`/`updateItem` path (§5); call `refreshData()` after any write where staleness would matter.
5. **Hard deletes on orders** — `deleteItem()` still hard-deletes; no soft-delete path exists for orders specifically (master data uses soft-deactivate via `MasterCRUD`).
6. **`shifts`/`printingTables`/`stitchingLines` company scoping** — confirmed correctly scoped by factory→company; not a live issue.

---

## 9. CURRENT LIMITATIONS / KNOWN GAPS

- `src/integrations/supabase/types.ts` is missing `companies.base_currency` (see §4) — due for regeneration.
- No UI currently lets a user write `invoice_number`/`invoice_amount`/`payment_status` onto a `purchase_orders` row — those fields are read-only display fields on the PO/Bill Tracking reports today.
- Single-document challan/PO/GRN/dispatch printing is not built (see §7).
