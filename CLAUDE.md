# FabriOS — Claude Code Notes

## 1. PROJECT OVERVIEW

**FabriOS** is a production OS for print and stitch manufacturing businesses. It lets users:

- Create and track printing and stitching orders with colourways
- Log daily production entries (date + resource + worker + qty + cost)
- Manage BOMs and generate purchase orders from material requirements
- Track goods receipt (GRN), inventory stock levels, and dispatches
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
VITE_SUPABASE_URL=https://kpcgwampumhfcmgpubtw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<JWT>
VITE_SUPABASE_PROJECT_ID=kpcgwampumhfcmgpubtw
```

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
│   │   ├── DashboardPage.tsx       # KPI cards, WIP progress, active/delayed counts
│   │   ├── PrintingOrdersPage.tsx  # Order list + create/edit dialog with colourways
│   │   ├── StitchingOrdersPage.tsx # Same structure as printing orders
│   │   ├── OrderDetailPage.tsx     # Order detail: colourway list + entry sub-table
│   │   ├── EntriesPage.tsx         # Tabs: SingleEntryForm + BulkEntryGrid
│   │   ├── ReportsPage.tsx         # 8-tab report viewer with CSV export
│   │   ├── BomPage.tsx             # BOM headers + lines; generate POs from BOM
│   │   ├── PurchaseOrdersPage.tsx  # PO list + create/edit
│   │   ├── GRNPage.tsx             # Goods receipt notes
│   │   ├── DispatchPage.tsx        # Dispatch records
│   │   ├── StockJobsPage.tsx       # Stock production jobs (not linked to customer orders)
│   │   ├── ProductionControlPage.tsx # Production dashboard view
│   │   ├── InventoryPage.tsx       # Inventory items + stock transactions
│   │   ├── VendorsPage.tsx         # Vendor master
│   │   ├── DevSmokePage.tsx        # Dev smoke-test page (no auth required)
│   │   ├── NotFound.tsx            # 404
│   │   └── masters/
│   │       ├── CompaniesPage.tsx         # Company settings
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
- Maintains a single `AppData` object in React state covering 17 data keys (factories, buyers, orders, entries, etc.)
- Maps frontend camelCase keys to Supabase snake_case table names via `TABLE_MAP`
- Auto-converts camelCase ↔ snake_case with `objectToSnake()` / `objectToCamel()` / `dbToFrontend()` / `frontendToDb()`
- Exposes `addItem`, `updateItem`, `deleteItem`, `addItems`, `getItems`, `refreshData`
- On insert: adds `company_id` for company-scoped tables; handles `module` for orders; maps colourway `orderId` → `order_row_id`
- **Known issue**: `toSnake()` converts single uppercase letters only — it does NOT handle acronyms (see Bug 1 in §7)

### `src/context/AuthContext.tsx` — Auth and module selection

Stores `session`, `user`, `profile` (from `profiles` table). Profile shape: `{ id, display_name, email, approval_status, company_id, is_active }`. Module selection persisted in localStorage key `fabrios_module`. Factory selection persisted in `fabrios_factory`.

### `src/types/index.ts` — Frontend TypeScript interfaces

Defines `PrintingOrder`, `StitchingOrder`, `PrintingColourway`, `ProductionEntry`, etc. These are the camelCase shapes used throughout the frontend. Note: `PrintingOrder` contains fields (`fabricId`, `orderQty`, `chartQty`, etc.) that belong to `order_rows` in the DB, not to `order_headers` — see Bug 1.

### `src/integrations/supabase/types.ts` — Auto-generated DB types

Source of truth for actual DB column names. Check this file when any column name is in doubt. Regenerate with Supabase CLI when schema changes.

### `src/components/MasterCRUD.tsx` — Generic CRUD component

All settings/master pages use this. Props: `title`, `dataKey` (key in `AppData`), `columns`, `renderForm`, `defaultValues`, `validate`. Features: search, active/inactive toggle (soft deactivate only — no hard delete). No delete button is shown.

### `src/components/entries/SingleEntryForm.tsx`

Production entry: order → colourway → shift → resource → worker type → persons + output qty. Auto-looks up active rate master for (factory, shift, worker type, date). Cost = `persons * rate_value` (per-person) or `output_qty * rate_value` (per-piece/meter).

---

## 5. DATA FLOW

### Reading data (on app load)

```
AuthContext detects session → profile.company_id available
    ↓
DataContext.fetchAllData() — fires once via useEffect + loadedRef guard
    ↓
15 parallel Supabase queries (factories, shifts, buyers, order_headers, ...)
    ↓
Results mapped through dbToFrontend() (snake_case → camelCase, is_active → active alias)
    ↓
order_headers split by module field → printingOrders / stitchingOrders
order_colourways mapped: orderRowId → orderId (backward compat shim — see §9)
    ↓
setData(AppData) — single React state update
    ↓
All page components read from useData().data (no per-page fetches for master data)
```

Pages that need data NOT in AppData (BOM, POs, GRN, Inventory, StockJobs) use `useQuery` directly with the Supabase client.

### Writing data (CRUD)

```
User fills form in a dialog
    ↓
handleSave() calls addItem(key, item) or updateItem(key, id, updates)
    ↓
DataContext.addItem():
  1. frontendToDb(item) — camelCase → snake_case, strips active/createdAt
  2. Injects company_id, module (for orders), maps orderId → order_row_id (colourways)
  3. Strips undefined keys + created_at / updated_at
  4. supabase.from(TABLE_MAP[key]).insert(dbRow)
  5. Optimistically updates local state (no re-fetch)
    ↓
Error → return { error: error.message } → page shows toast.error()
Success → return { error: null } → page shows toast.success(), closes dialog
```

**Important:** There is NO automatic re-fetch after writes. Local state is updated optimistically. Call `refreshData()` if you need to sync with DB.

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

All tables are in the Supabase `public` schema with `company_id`-based row filtering (RLS assumed). The canonical column names are in `src/integrations/supabase/types.ts`.

### order_headers — every column referenced in code

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `module` | text | `'printing'` or `'stitching'` |
| `internal_po` | text | NOT NULL — auto-generated (e.g., `PO-P-0001`) |
| `buyer_po` | text \| null | Buyer's PO reference |
| `buyer_p_o` | text \| null | Duplicate/legacy column — also present in schema |
| `buyer_id` | uuid \| null | FK → buyers |
| `style` | text \| null | Style code string |
| `currency` | text | e.g., `'USD'`, `'INR'` |
| `target_end_date` | text \| null | ISO date string |
| `buyer_delivery_date` | text \| null | ISO date string |
| `remarks` | text \| null | |
| `status` | text | `'Started'` \| `'Completed'` \| `'Shipped'` \| `'Cancelled'` |
| `created_at` | timestamptz | DB-managed |
| `updated_at` | timestamptz | DB-managed |

**Note:** `fabric_id`, `order_qty`, `chart_qty`, `uom`, `rate_per_item`, `no_of_colours`, `fabric_width`, `printing_product_id` are **NOT** columns in `order_headers`. They belong to `order_rows`. The frontend `PrintingOrder` TypeScript type conflates both tables — this is the root cause of Bug 1.

### Other tables

| Table | Key columns |
|---|---|
| `order_rows` | `id, order_id, product_id, fabric_id, fabric_width, order_qty, chart_qty, uom, no_of_colours, rate_per_item, sort_order` |
| `order_colourways` | `id, order_row_id, colour_name, ordered_qty, uom, size, notes, sort_order` |
| `production_entries` | `id, company_id, date, module, order_id, colourway_id, factory_id, shift_id, resource_id, worker_type_id, persons_used, output_qty, output_uom, rate_master_id, rate_basis, rate_value, cost_amount, notes` |
| `rate_masters` | `id, company_id, factory_id, shift_id, worker_type_id, rate_basis, rate_value, effective_from, effective_to, is_active` |
| `companies` | `id, name, legal_name, address, is_active, created_by` |
| `factories` | `id, company_id, code, name, type ('printing'\|'stitching'\|'mixed'), is_active` |
| `shifts` | `id, factory_id, code, name, start_time, end_time, is_active` |
| `worker_types` | `id, company_id, name, module, is_active` |
| `printing_tables` | `id, factory_id, code, name, size, supervisor_name, is_active` |
| `stitching_lines` | `id, factory_id, code, name, machines, supervisor_name, is_active` |
| `buyers` | `id, company_id, code, name, contact_person, country, phone, email, address, is_active` |
| `fabrics` | `id, company_id, name, short_form, gsm, width, width_unit, is_active` |
| `printing_products` | `id, company_id, code, name, size, uom, is_active` |
| `stitching_products` | `id, company_id, code, name, size_spec, uom, is_active` |
| `profiles` | `id (= auth.users.id), display_name, email, approval_status, company_id, is_active` |
| `bom_headers` | `id, company_id, title, bom_type ('order'\|'stock'\|'manual'), order_id, status, remarks` |
| `bom_lines` | `id, bom_id, category, item_name, item_id, quantity, uom, avg_consumption, extra_pct, rate, total_amount (nullable), vendor_name, sort_order` |
| `purchase_orders` | `id, company_id, po_number, vendor_id, po_date, status, currency, total_amount, source_type, order_id, remarks` |
| `purchase_order_lines` | `id, po_id, item_name, item_id, uom, qty_ordered, rate, amount` |
| `grn_headers` | `id, company_id, grn_number, vendor_id, grn_date, status` |
| `grn_lines` | `id, grn_id, item_id, qty_received, remarks` |
| `inventory_items` | `id, company_id, code, name, category, uom, reorder_level, opening_stock, is_active` |
| `stock_transactions` | `id, company_id, item_id, txn_date, txn_type, qty` |
| `stock_jobs` | `id, company_id, job_number, product_name, module, target_qty, produced_qty, uom, status, start_date, end_date, remarks` |
| `dispatch_records` | `id, company_id, dispatch_date, order_id, buyer_id, qty, product_name, size, colour, challan_number, vehicle_number, dispatch_type, remarks, uom` |
| `vendors` | `id, company_id, code, name, contact_person, phone, email, address, payment_terms, is_active` |
| `onboarding_progress` | `id, company_id, company_done, factories_done, buyers_done, fabrics_done, printing_products_done, printing_tables_done, stitching_lines_done, stitching_products_done, wizard_completed` |

---

## 7. KNOWN BUGS

### Bug 1 — Order saves fail with schema cache error

**File:** `src/context/DataContext.tsx` `toSnake()` + `src/pages/PrintingOrdersPage.tsx` `handleSave()`

**Root cause:** `toSnake()` converts each uppercase letter individually with `_` prefix:
```typescript
function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
}
```
This means `internalPO` → `internal_p_o`, but the actual DB column is `internal_po`. Supabase rejects the insert because `internal_p_o` is not a column in `order_headers`, and `internal_po` (required, NOT NULL) is missing from the payload.

**Secondary issue:** The `PrintingOrder` TypeScript interface includes fields (`fabricId`, `orderQty`, `chartQty`, `uom`, `ratePerItem`, `noOfColours`, `fabricWidth`, `printingProductId`) that belong to `order_rows` in the DB, not `order_headers`. These unknown columns are sent in the insert payload, compounding the error. Additionally, `addItem('printingOrders', ...)` never creates a corresponding `order_rows` record.

**Affected fields:** `internalPO` → `internal_p_o` (should be `internal_po`)

**Do not fix yet.**

---

### Bug 2 — BOM save fails with total_amount constraint

**File:** `src/pages/BomPage.tsx` `saveMutation` / `generatePOMutation`

**Observed:** Saving a BOM with lines, or generating POs from a BOM, may fail with a constraint-related error on `total_amount`.

**Suspected causes (in order of likelihood):**
1. When generating POs (`generatePOMutation`), `purchase_orders.total_amount` is set to `totalAmount` which could be `0` if no valid line amounts exist. If `purchase_orders` has a `CHECK(total_amount > 0)` constraint, this fails.
2. `bom_lines.total_amount` is `nullable` in the TypeScript-generated types, but a later DB migration may have added a `NOT NULL` or `CHECK` constraint not yet reflected in the regenerated types.
3. `total_amount` may have been converted to a DB-generated/computed column in a migration, causing Supabase to reject explicit writes.

The TypeScript types show `bom_lines.total_amount: number | null` (Insert: optional). If the actual DB constraint differs, the types file is stale and needs regeneration.

**Do not fix yet.**

---

### Bug 3 — Stock Job end date clear does not persist

**File:** `src/pages/StockJobsPage.tsx` `handleSave()`

**Observed:** When editing a stock job and clearing the end date field, the cleared value does not persist after saving.

**Code path:**
```typescript
// handleSave sends:
end_date: form.end_date || null   // '' || null = null ✓

// mutationFn sends to Supabase:
const { id, company_id, created_at, updated_at, ...updates } = payload;
supabase.from('stock_jobs').update(updates).eq('id', editingId)
// updates.end_date = null — should clear the column
```

**Suspected causes:**
1. `stock_jobs.end_date` may be `NOT NULL` in the DB (migration added a default), causing the null update to fail silently if the toast error is missed.
2. Supabase PostgREST may not send `null` fields in PATCH unless explicitly included (depends on client version).
3. After `qc.invalidateQueries`, the re-fetch may return a stale cached result before DB is updated, and the UI briefly shows the old value — though it should self-correct on the next render.

**Do not fix yet.**

---

## 8. WHAT IS WORKING

These modules are in a stable state and should not be touched unless fixing a specific bug:

- **Auth flow** — Login, register, forgot password, reset password, setup wizard, pending approval page
- **Master CRUD pages** — All settings pages (factories, shifts, worker types, rate masters, buyers, fabrics, printing/stitching products, tables/lines, users). All use `MasterCRUD` component and `DataContext.updateItem/addItem`.
- **Production entry** — `SingleEntryForm` and `BulkEntryGrid` both work. Rate lookup and cost calculation are correct.
- **Dashboard** — KPI cards, WIP summary, progress bars all read from DataContext correctly.
- **Reports** — 8-tab report page with CSV export works.
- **Dispatch, GRN, Inventory** — Direct Supabase queries, independent of the order data model.
- **BOM display** — Listing and viewing existing BOMs works. The failure is on save/generate-PO.
- **Stock Jobs** — Create and status updates work. Only the end-date clear is broken.

---

## 9. OPEN QUESTIONS

### 1. Colourway `orderId` backward-compatibility shim
`DataContext.tsx` lines 174–181 remap `colourway.orderRowId → orderId` when loading from DB. This means frontend code treats colourways as referencing the order header, but the DB has `order_colourways.order_row_id → order_rows.id`. When saving colourways, `addItem('printingColourways', { orderId })` maps `orderId` back to `order_row_id` (DataContext line 247). But no `order_rows` record is ever created by the order save flow, so these FKs may point to the order header UUID (which would fail the FK constraint unless `order_rows` has matching IDs). **Verify whether the production DB has `order_rows` rows at all.**

### 2. `order_rows` never created by the frontend
`PrintingOrdersPage.handleSave()` calls `addItem('printingOrders', ...)` (→ inserts to `order_headers`) and `addItem('printingColourways', ...)` (→ inserts to `order_colourways`), but never calls anything that inserts to `order_rows`. Yet `order_colourways.order_row_id` is a NOT NULL FK to `order_rows`. This would cause every new colourway insert to fail with a FK violation, unless colourway FKs are somehow being satisfied. **Is `order_rows` populated by some other mechanism (trigger, function)?**

### 3. Two `buyer_po` columns in `order_headers`
The generated types show both `buyer_po: string | null` and `buyer_p_o: string | null` as separate columns. `toSnake('buyerPO')` produces `buyer_p_o`, which is a real column. But there's also a `buyer_po` column that may never get written. **Clarify which column is canonical and whether `buyer_p_o` is a migration artifact to be dropped.**

### 4. `order_headers` missing expected columns
The TypeScript `PrintingOrder` type has ~15 fields, but `order_headers` only has ~10 columns. Fields like `orderQty`, `chartQty`, `fabricId`, `uom`, `ratePerItem`, `noOfColours`, `fabricWidth`, `printingProductId` are not in `order_headers`. The split between header and row tables was added to the DB but the TypeScript types and page forms were never updated to match. **The entire order save/load path needs to be reconciled against the current DB schema.**

### 5. Optimistic updates without re-fetch
`addItem` and `updateItem` update local React state immediately without re-fetching from Supabase. If the DB insert fails but the error is not surfaced to the user (e.g., toast is missed), the UI will show stale data. **Consider adding a `refreshData()` call after writes to safety-net this.**

### 6. Hard deletes on orders, soft deletes on masters
`deleteItem()` hard-deletes any row. `MasterCRUD` never shows a delete button (only toggling `is_active`). But order pages could theoretically call `deleteItem('printingOrders', id)` — there is no soft-delete path for orders. **Is hard-delete of orders intentional?**

### 7. `shifts` and `printingTables/stitchingLines` not filtered by company in DB query
`DataContext.fetchAllData()` fetches `shifts`, `printing_tables`, `stitching_lines` **without** a `company_id` filter — it relies on the in-memory `factoryIds` filter after fetch. This would return all companies' shifts/tables/lines if RLS is not enabled on those tables. **Confirm that Supabase RLS policies restrict these tables by company.**
