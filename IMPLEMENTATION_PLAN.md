# FabriOS — Implementation Plan (Owner's Perspective)

**Status as of 2026-08-06:** 6 of 10 features below are built and live. Kept as a
historical spec for the shipped ones and a live roadmap for the rest — see the
per-feature status line.

## Priority Order (build order)

| # | Feature | Effort | New Tables | Business Value | Status |
|---|---------|--------|------------|----------------|--------|
| 1 | Dashboard Factory Filter | 1 day | 0 | ★★★ | ✅ Built |
| 2 | Attendance & Worker Master | 2 days | 2 | ★★★★ | ✅ Built |
| 3 | Rejection / QC Tracking | 2 days | 1 | ★★★★★ | 🔲 Not built |
| 4 | Material Consumption Tracking | 2 days | 1 | ★★★★★ | ✅ Built |
| 5 | Quotation Module → Order | 3 days | 2 | ★★★★ | ✅ Built |
| 6 | Invoicing & AR from Dispatch | 3 days | 2 | ★★★★★ | ✅ Built |
| 7 | Subcontracting | 2 days | 1 | ★★★ | ✅ Built |
| 8 | Period-over-Period Reports | 1 day | 0 | ★★★ | 🔲 Not built |
| 9 | True P&L by Order | 1 day | 0 | ★★★★★ | ⚠️ Partially — revenue/labour cost correct, material cost has a known-N/A edge case, no QC-cost term (depends on #3) |
| 10 | Multi-Factory Comparison | 1 day | 0 | ★★★ | 🔲 Not built |

**Total: ~18 days planned. ~11 days' worth shipped (Features 1, 2, 4, 5, 6, 7).**

---

## Feature 1: Dashboard Factory Filter

**✅ Built.** `DashboardPage.tsx` uses `currentFactoryId` from `DataContext` to scope KPIs.

**Business problem:** Owner with multiple factories sees all orders/entries combined. Can't tell which factory is performing how.

**Changes:** UI-only — no new DB tables.

**Implementation:**
- `DashboardPage.tsx` already has `currentFactoryId` from DataContext but ignores it
- Add factory selector dropdown at top of dashboard (already exists in header, pipe it through)
- When a factory is selected, filter all KPIs: orders, entries, dispatches by that factory's resource IDs (tables/lines)
- Add factory name next to KPI values
- On the "In Production" list, show which factory each order belongs to

**Filtering approach:**
```typescript
// Map factory → resources (printing_tables / stitching_lines)
const factoryResourceIds = useMemo(() => {
  const tables = data.printingTables.filter(t => t.factoryId === factoryId).map(t => t.id);
  const lines = data.stitchingLines.filter(l => l.factoryId === factoryId).map(l => l.id);
  return { tables, lines };
}, [factoryId, data.printingTables, data.stitchingLines]);

// Filter entries that used a resource belonging to this factory
const factoryEntries = data.entries.filter(e => 
  factoryResourceIds.tables.includes(e.resourceId) || 
  factoryResourceIds.lines.includes(e.resourceId)
);
```

**Test scenarios:**
1. Select different factories → KPIs change
2. "All factories" option → shows combined data
3. Factory with no data → shows zeroes

---

## Feature 2: Attendance & Worker Master

**✅ Built.** `workers`/`attendance` tables, `AttendancePage.tsx`, `WorkersPage.tsx` (under Settings) all shipped.

**Business problem:** Current system tracks "persons used" as a number but doesn't know WHO worked. Can't track individual productivity, overtime, or attendance patterns.

### 2a. Worker Master (`workers` table)

**SQL Migration:**
```sql
CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  factory_id UUID REFERENCES public.factories(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL,
  name TEXT NOT NULL,
  worker_type_id UUID REFERENCES public.worker_types(id) ON DELETE SET NULL,
  phone TEXT,
  hourly_rate NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_workers_company_employee_code ON public.workers(company_id, employee_code);

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY workers_company_policy ON public.workers 
  USING (company_id = (SELECT get_user_company_id()));
```

**Frontend types** (`types/index.ts`):
```typescript
export interface Worker {
  id: string;
  companyId: string;
  factoryId: string;
  employeeCode: string;
  name: string;
  workerTypeId: string;
  phone?: string;
  hourlyRate: number;
  active: boolean;
}
```

**AppData:** add `workers: Worker[]` to AppData, `TABLE_MAP` entry `workers: 'workers'`

**UI — Workers Page** (`src/pages/masters/WorkersPage.tsx`):
- Use `<MasterCRUD>` component (same pattern as Buyers, Fabrics etc.)
- Fields: employee_code, name, factory (dropdown), worker_type (dropdown), phone, hourly_rate
- Search by employee_code or name
- Factory filter at top

### 2b. Attendance Entry

**SQL Migration:**
```sql
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  check_in TIME,
  check_out TIME,
  hours_worked NUMERIC(5,2),
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'leave')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_attendance_worker_date ON public.attendance(company_id, worker_id, date);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
```

**UI — Attendance Page** (`src/pages/AttendancePage.tsx`):
- **Entry View (default):** Date picker at top, table with columns: Employee Code, Name, Worker Type, Shift, Check In, Check Out, Hours, Overtime, Status
- Workers not yet entered for the day show with empty fields
- Bulk save: save all rows at once
- Quick buttons: "Mark all present", "Mark absent" per worker
- **Report View (tab):** Monthly summary by worker — total hours, overtime, absent days

**Integration with Production Entry:**
- When logging a production entry, optionally select workers from the attendance list for that shift
- Future: auto-calculate labour cost from actual worker hourly_rates

**Test scenarios:**
1. Create a worker
2. Mark attendance for a shift (check in/out)
3. View monthly summary — see hours worked
4. Edit a worker's details
5. Deactivate a worker

---

## Feature 3: Rejection / QC Tracking

**🔲 Not built.** No `qc_entries` table exists yet. Spec below is unchanged from the original plan — still the roadmap if this gets picked up.

**Business problem:** Every print/stitch run has rejections. Currently invisible. Owner can't calculate true yield or identify problematic tables/lines.

### Schema

**SQL Migration:**
```sql
CREATE TABLE public.qc_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL,
  colourway_id UUID REFERENCES public.order_colourways(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('printing', 'stitching')),
  factory_id UUID REFERENCES public.factories(id) ON DELETE SET NULL,
  resource_id UUID,                                 -- FK to printing_tables or stitching_lines
  checked_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
  passed_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
  rejected_qty NUMERIC(10,2) GENERATED ALWAYS AS (checked_qty - passed_qty) STORED,
  defect_type TEXT CHECK (defect_type IN (
    'colour_mismatch', 'print_defect', 'size_issue', 'fabric_defect', 
    'stitching_defect', 'shade_variation', 'misprint', 'other'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qc_entries_order  ON public.qc_entries(order_id);
CREATE INDEX idx_qc_entries_date   ON public.qc_entries(date);
CREATE INDEX idx_qc_entries_company ON public.qc_entries(company_id);

ALTER TABLE public.qc_entries ENABLE ROW LEVEL SECURITY;
```

### Frontend Types

```typescript
export interface QCEntry {
  id: string;
  companyId: string;
  orderId?: string;
  colourwayId?: string;
  date: string;
  module: 'printing' | 'stitching';
  factoryId?: string;
  resourceId?: string;
  checkedQty: number;
  passedQty: number;
  rejectedQty: number;  // computed
  defectType?: string;
  notes?: string;
}
```

**AppData:** add `qcEntries: QCEntry[]`, TABLE_MAP entry `qcEntries: 'qc_entries'`

### UI

**Entry Form** (simple, integrated into EntriesPage or standalone page):
- Date (default today)
- Module (printing/stitching) — auto-detect from selected order
- Order selector → colourway selector (same cascading pattern as SingleEntryForm)
- Factory → Resource (table/line)
- Checked Qty (how many pieces inspected)
- Passed Qty (default: same as checked)
- Defect Type dropdown (only shown if passed < checked)
- Notes
- **Cost impact display:** at bottom, show estimated rejection cost = rejected_qty × (avg production cost per unit from recent entries)

**Active QC summary panel** on Order Detail Page:
- Per-colourway: Showed Qty, Checked Qty, Passed %, Rejected
- \+ button to quick-add QC entry for this colourway

**Dashboard KPI:** QC pass rate — add a card showing overall pass % with color coding (green >95%, amber >90%, red <90%)

**Reports** (new QC tab in ReportsPage):
- Pass rate by order, by buyer, by table/line
- Defect type distribution (pie chart or table)
- Yield trend over time (pass% by week)
- Rework cost estimate

### Test scenarios
1. Create QC entry for an order — passed qty = checked qty → 0% rejection
2. Create QC entry with defects → rejection calculated
3. View QC summary on Order Detail Page
4. Run QC report — see pass rate by table
5. Dashboard shows pass rate

---

## Feature 4: Material Consumption Tracking

**✅ Built.** `material_issues` table, `MaterialIssuesPage.tsx`, and the "Consumption vs BOM" report tab all shipped.

**Business problem:** BOM says "need 100m fabric", but actual usage differs. Wastage invisible. Owner can't control material cost.

### Schema

**SQL Migration:**
```sql
CREATE TABLE public.material_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL,
  row_id UUID REFERENCES public.order_rows(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  uom TEXT NOT NULL DEFAULT 'meters',
  qty_issued NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_consumed NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_wasted NUMERIC(10,2) GENERATED ALWAYS AS (qty_issued - qty_consumed) STORED,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_material_issues_order   ON public.material_issues(order_id);
CREATE INDEX idx_material_issues_company ON public.material_issues(company_id);

ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;
```

### Frontend Types

```typescript
export interface MaterialIssue {
  id: string;
  companyId: string;
  orderId?: string;
  rowId?: string;
  itemName: string;
  itemId?: string;
  uom: string;
  qtyIssued: number;
  qtyConsumed: number;
  qtyWasted: number;  // computed
  date: string;
  notes?: string;
}
```

### UI

**Entry Form** (new panel on Order Detail Page, or standalone page):
- Order selector (pre-filled if entering from Order Detail)
- Row selector (which product row within the order)
- Item: dropdown of inventory items (filtered by relevant category), or free-text
- Qty Issued
- Qty Consumed (default: same as issued — owner just enters what was taken, consumed is what actually got used)
- If consumed < issued → wastage shown automatically
- Date
- Notes

**BOM vs Actual Report** (new tab in Reports):
- Compare BOM line (item, qty needed) vs actual material_issues per order
- Show wastage % per item
- Total material cost per order

**Dashboard KPI:** Material Wastage Rate — overall % by month

### Test scenarios
1. Issue material to an order with no waste → consumed = issued
2. Issue material where consumed < issued → wastage shown
3. View BOM vs Actual report for an order
4. Dashboard shows wastage rate

---

## Feature 5: Quotation Module → Order

**✅ Built.** `quotations` table, `QuotationsPage.tsx`, convert-to-order flow all shipped.

**Business problem:** Sales process starts before orders. Currently the system has no way to quote a buyer, track whether they accepted, or convert to order. Owner loses quote history.

### Schema

**SQL:**
```sql
CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  quotation_number TEXT NOT NULL,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal * COALESCE(tax_percent,0) / 100, 2)) STORED,
  total NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + ROUND(subtotal * COALESCE(tax_percent,0) / 100, 2)) STORED,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_quotations_company_number ON public.quotations(company_id, quotation_number);

CREATE TABLE public.quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
  product_id UUID,          -- nullable, FK to printing_products or stitching_products (context-dependent)
  description TEXT NOT NULL,
  qty NUMERIC(10,2) NOT NULL DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'pcs',
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) GENERATED ALWAYS AS (qty * rate) STORED,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_quotation_lines_quote ON public.quotation_lines(quotation_id);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_lines ENABLE ROW LEVEL SECURITY;
```

### Frontend Types

```typescript
export interface Quotation {
  id: string;
  companyId: string;
  quotationNumber: string;
  buyerId?: string;
  date: string;
  validUntil?: string;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  subtotal: number;
  taxPercent: number;
  taxAmount: number;     // computed
  total: number;         // computed
  remarks?: string;
}

export interface QuotationLine {
  id: string;
  quotationId: string;
  productId?: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;        // computed
  sortOrder: number;
}
```

### UI

**Quotations List Page** (`src/pages/QuotationsPage.tsx`):
- Similar pattern to PurchaseOrdersPage
- Table: Quote#, Buyer, Date, Valid Until, Status, Total
- Filters: buyer, status, date range
- Monthly grouping by date
- Bulk actions: change status, delete
- CSV export

**Quotation Editor Dialog:**
- Quote number (auto-generated: `Q-{sequence}`)
- Buyer, Date, Valid Until, Currency, Remarks
- Product lines table: Product selector → description, qty, uom, rate
- Subtotal, Tax %, Total shown at bottom

**"Convert to Order" Action:**
- When quotation status is changed to "accepted"
- Button "Create Order" appears
- Click opens order creation dialog pre-filled with quotation data
- Creates order_headers + order_rows from quotation_lines
- Links quotation to order

**Reports:** Quotation acceptance rate, average quote value by buyer

### Test scenarios
1. Create quotation with product lines → totals calculated
2. Change status to sent
3. Mark as accepted → "Create Order" button appears
4. Convert to order → order created with same data
5. View quotation list with filters

---

## Feature 6: Invoicing & AR from Dispatch

**✅ Built.** `invoices` table, `InvoicesPage.tsx`, AR tracking all shipped.

**Business problem:** When goods ship, no invoice is generated. Owner has no record of what was billed, what's paid, and what's overdue.

### Schema

**SQL:**
```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL,
  dispatch_id UUID REFERENCES public.dispatch_records(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal * COALESCE(tax_percent,0) / 100, 2)) STORED,
  grand_total NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + ROUND(subtotal * COALESCE(tax_percent,0) / 100, 2)) STORED,
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  payment_date DATE,
  payment_mode TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_invoices_company_number ON public.invoices(company_id, invoice_number);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
```

**No separate invoice_lines table** — invoice lines are derived from dispatch records (one invoice per dispatch, or consolidated). One invoice = one dispatch + manual adjustment.

### Frontend Types

```typescript
export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  buyerId?: string;
  orderId?: string;
  dispatchId?: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;     // computed
  grandTotal: number;    // computed
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paymentDate?: string;
  paymentMode?: string;
  notes?: string;
}
```

### UI

**Invoices List Page** (`src/pages/InvoicesPage.tsx`):
- Same pattern as PurchaseOrdersPage
- Table: Invoice#, Buyer, Date, Due Date, Status, Total
- Status badges with color coding: draft (gray), sent (blue), paid (green), overdue (red), cancelled (gray)
- Filters: buyer, status, date range
- AR Aging summary at top: Current (0-30d), 31-60d, 61-90d, 90+ days overdue with totals

**Generate Invoice from Dispatch:**
- On Dispatch Page, add "Generate Invoice" button per dispatch row
- Opens dialog: invoice# (auto), due date (30 days from dispatch), tax % (configurable)
- Pre-fills subtotal from dispatch qty × order rate_per_item
- On save → creates invoice record

**Invoice Detail Page** (`/invoices/:id`):
- Header: invoice #, buyer, dates, status
- Lines: description (from dispatch/product), qty, rate, amount
- Summary: subtotal, tax, grand total
- Payment section: mark as paid with date and mode (cash/cheque/bank transfer)
- Action buttons: Send (change status), Mark Paid, Print (PDF)

**Dashboard KPI:** 
- AR Aging: overdue total, current total
- Recent invoices: last 5 with status

**Reports** (add Invoice tab in ReportsPage):
- Invoice aging report (AR aging schedule)
- Revenue by buyer, by month
- Payment cycle analysis (avg days to payment)

### Test scenarios
1. Generate invoice from a dispatch → auto-fills buyer, amounts
2. Invoice shows in list with "draft" status
3. Mark invoice as "sent"
4. Mark invoice as "paid" with payment details
5. View AR aging — overdue invoices highlighted
6. Dashboard shows AR totals

---

## Feature 7: Subcontracting

**✅ Built.** `subcontract_jobs` table, `SubcontractJobsPage.tsx` all shipped.

**Business problem:** Sometimes printing/stitching is sent to a subcontractor. Need to track what was sent, when, and what came back.

### Schema

**SQL:**
```sql
CREATE TABLE public.subcontract_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  job_number TEXT NOT NULL,
  order_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL,
  subcontractor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  process TEXT NOT NULL CHECK (process IN ('printing', 'stitching', 'both')),
  product_description TEXT,
  qty_sent NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_received NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_balance NUMERIC(10,2) GENERATED ALWAYS AS (qty_sent - qty_received) STORED,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) GENERATED ALWAYS AS (qty_sent * rate) STORED,
  send_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  received_date DATE,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partial', 'received', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_subcontract_company_job ON public.subcontract_jobs(company_id, job_number);

ALTER TABLE public.subcontract_jobs ENABLE ROW LEVEL SECURITY;
```

### Frontend Types

```typescript
export interface SubcontractJob {
  id: string;
  companyId: string;
  jobNumber: string;
  orderId?: string;
  subcontractorId?: string;
  process: 'printing' | 'stitching' | 'both';
  productDescription?: string;
  qtySent: number;
  qtyReceived: number;
  qtyBalance: number;     // computed
  rate: number;
  amount: number;          // computed
  sendDate: string;
  expectedReturnDate?: string;
  receivedDate?: string;
  status: 'sent' | 'partial' | 'received' | 'cancelled';
  notes?: string;
}
```

### UI

**Subcontract Jobs Page** (`src/pages/SubcontractJobsPage.tsx`):
- List view similar to StockJobs
- Create: order (optional), subcontractor (from vendors with type check), process, qty_sent, rate, dates
- Table: Job#, Order#, Subcontractor, Process, Sent, Received, Balance, Status
- Status badges: sent (blue), partial (yellow), received (green), cancelled (gray)
- "Receive" action: opens dialog to enter qty_received, received_date
  - If qty_received >= qty_sent → status = "received"
  - If qty_received < qty_sent → status = "partial"

**Integration with Orders:**
- On Order Detail, show subcontract jobs linked to this order
- Production entries for subcontracted orders can reference subcontract_job_id

**Reports** (add Subcontract tab in ReportsPage):
- Subcontract cost by order
- Subcontractor performance (avg return time, % on-time)
- Total subcontract spend by period

### Test scenarios
1. Create subcontract job → status "sent"
2. Partial receive → status changes to "partial", balance shown
3. Full receive → status "received"
4. View subcontract jobs linked to an order on Order Detail

---

## Feature 8: Period-over-Period Reports

**🔲 Not built.** Still the roadmap if this gets picked up.

**Business problem:** Current reports only show current period. Owner can't see month-over-month or year-over-year trends.

**Changes:** UI-only — no new DB tables.

**Implementation:**
- Add "Compare with" selector to report filters: "Previous Period", "Same Period Last Year", "None"
- When selected, each report table gets additional columns showing:
  - Current period value
  - Previous period value  
  - Change (% and absolute)
- Summary cards show trend arrows (↑ ↓ →)

**Affected reports:**
- Production summary: output comparison, cost comparison
- Order status: orders created/completed comparison
- Dispatch: qty dispatched comparison
- Profit/Loss: revenue/cost/profit comparison

**Implementation pattern:**
```typescript
// In ReportsPage, compute two datasets
const currentData = computeData(filters.dateFrom, filters.dateTo);
const previousData = computeData(prevDateFrom, prevDateTo);

// Compare function
function compare(curr: number, prev: number) {
  const change = curr - prev;
  const pct = prev !== 0 ? (change / prev) * 100 : 0;
  return { curr, prev, change, pct };
}
```

**Dashboard:** Show trend arrows on KPI cards (↑ = better than last period)

### Test scenarios
1. Select "Compare with Previous Period" → see additional columns
2. Data matches expectations (e.g., if this week had 100 units and last week had 80, shows +20, +25%)
3. No data in previous period → shows "N/A"

---

## Feature 9: True P&L by Order

**⚠️ Partially built.** The Profit/Loss report tab correctly sums revenue from `order_rows.rate_per_item * order_qty` and labour cost from `production_entries`. Material cost falls back to an honest "N/A" (`materialCostUnknown` flag) when no BOM rate is found, rather than the placeholder this spec originally proposed. No QC-cost term, since Feature 3 isn't built.

**Business problem:** Current P&L uses `ratePerItem × orderQty` as "revenue" — this is order value, NOT actual revenue. Material cost is never tracked.

**Changes:** Report-only — no new tables needed. Uses material_issues (Feature 4) + production_entries + dispatch + invoices.

**Implementation:**

**P&L Calculation per order:**
```
Revenue = sum of invoice amounts for this order (if invoiced)
       OR dispatched_qty × rate_per_item (if not yet invoiced)
Material Cost = sum of material_issues.qty_consumed × average rate from PO/BOM
Labour Cost  = sum of production_entries.costAmount for this order
QC Cost      = sum of qc_entries.rejected_qty × (avg production cost per unit)
Gross Profit = Revenue - Material Cost - Labour Cost - QC Cost
Gross Margin = Gross Profit / Revenue × 100 (if Revenue > 0)
```

**Enhanced P&L Report** (replace current profit-loss tab):
- **Summary cards:** Total Revenue, Total Cost (material + labour), Gross Profit, Gross Margin %
- **Table:** Order, Buyer, Revenue, Material Cost, Labour Cost, QC Cost, Total Cost, Profit, Margin %
- **Breakdown per order:** Expandable row showing material cost breakdown and labour cost breakdown
- **Comparison:** with "Compare with" selector (Feature 8)

**Data integration:**
```sql
-- For material cost, need average rate. Query material_issues + purchase_order_lines or use BOM rate.
-- For simplicity, use the rate from the BOM line that matches the item.
```

### Test scenarios
1. P&L report shows revenue from invoiced orders
2. Material cost appears for orders with material_issues
3. Labour cost from production entries
4. Margin calculation correct
5. Sorting by margin, revenue, cost works

---

## Feature 10: Multi-Factory Comparison

**🔲 Not built.** Still the roadmap if this gets picked up.

**Business problem:** Owner with 3 factories needs to compare their performance side-by-side.

**Changes:** UI-only — no new DB tables.

**Implementation:**

**Dashboard:**
- If currentFactoryId is "all" (or no filter), show factory-by-factory comparison row:
  ```
  | Factory | Orders | Output | Cost | Revenue | Profit | Pass % |
  |---------|--------|--------|------|---------|--------|--------|
  | Factory A | 12   | 5000   | ₹2L  | ₹5L    | ₹3L    | 95%    |
  | Factory B | 8    | 3200   | ₹1.5L| ₹3.2L  | ₹1.7L  | 92%    |
  | Total     | 20   | 8200   | ₹3.5L| ₹8.2L  | ₹4.7L  | 94%    |
  ```

**Reports Tab** (new "Factory Comparison" tab):
- Side-by-side columns: Factory A | Factory B | Factory C | Total
- Metrics: Orders, Output, Labour Cost, Material Cost, Revenue, Profit, Margin %, Pass Rate, Wastage %
- Bar chart visualization using recharts

**Implementation approach:**
```typescript
// Get factories that belong to the current module
const factories = data.factories.filter(f => 
  f.active && (f.type === currentModule || f.type === 'mixed')
);

// For each factory, compute KPIs
const factoryStats = factories.map(f => {
  const resourceIds = getResourceIds(f.id);
  const entries = data.entries.filter(e => resourceIds.includes(e.resourceId));
  const orders = getOrdersForFactory(f, data);
  return {
    factory: f.name,
    orders: orders.length,
    output: entries.reduce((s, e) => s + e.outputQty, 0),
    cost: entries.reduce((s, e) => s + e.costAmount, 0),
    // ... more KPIs
  };
});
```

### Test scenarios
1. Two factories with data → comparison table shows correct numbers
2. Factory with no data → shows zeroes
3. Factory filter changes → comparison updates

---

## Build Order Strategy

```
Week 1: Features 1-4 (foundation + entry types)
  Day 1: Dashboard Factory Filter
  Day 2: Worker master page + DB migration
  Day 3: Attendance entry page
  Day 4: QC entry page + DB migration + Order Detail integration
  Day 5: Material consumption entry + DB migration

Week 2: Features 5-7 (modules)
  Day 6-7: Quotation module (list + editor + convert to order)
  Day 8-9: Invoicing module (list + generate from dispatch + AR aging)
  Day 10: Subcontracting module (list + receive)

Week 3: Features 8-10 (reports) + deploy
  Day 11: Period-over-period comparison
  Day 12: True P&L by order
  Day 13: Multi-factory comparison
  Day 14: Playwright tests + fixes + deploy
```

---

## Testing Strategy (Playwright)

Each feature gets:
1. **Data setup** — create prerequisite data (buyer, order, etc.)
2. **Entry flow** — fill form, save, verify success toast
3. **List view** — verify new record appears in list
4. **Edit flow** — edit record, save, verify changes persisted
5. **Report/Dashboard** — verify KPIs update
6. **Edge cases** — empty fields, invalid data, boundary values

Existing test infrastructure:
- `tests/auth.setup.ts` — creates test user
- `tests/helpers.ts` — admin Supabase client + UI helpers (selectOption, fillInput, clickButton)
- Pattern: `test.describe.serial` for sequential flows
