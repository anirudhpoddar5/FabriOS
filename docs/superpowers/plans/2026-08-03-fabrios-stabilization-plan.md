# FabriOS Stabilization & Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop an active regression, fix the concrete bugs the owner hit in real usage, fix a real business-logic defect (currency conflation), and restore/complete functionality that used to exist or was never finished — without re-breaking anything currently working.

**Architecture:** No new libraries, no new architecture. Keep the codebase's own established pattern: multi-table writes go through atomic Postgres RPCs (`security invoker`, `payload jsonb`, single transaction), single-table CRUD goes through `DataContext`. Currency gets a second dimension (`base_currency` on `companies`) instead of overloading `order.currency` for both buyer pricing and internal costing.

**Tech Stack:** React 18 + TS, Supabase (Postgres + PostgREST + RPC), react-query, shadcn/ui. See `CLAUDE.md` §2 for full stack (note: that file is stale — Phase 6 fixes it).

## Global Constraints

- All multi-table writes (order+rows+colourways, PO+lines, BOM+lines, GRN+lines) MUST go through an atomic `SECURITY INVOKER` RPC, never sequential client-side inserts. This is the established, already-proven pattern (see `supabase/migrations/20260710*.sql`) — don't reinvent it.
- Every DB change is a new file in `supabase/migrations/`, timestamp-prefixed, never edit an already-applied migration in place.
- The live app targets `.env`'s `VITE_SUPABASE_PROJECT_ID=ejebukxlwgwebjgdicyb`. Before writing any migration, confirm `supabase/config.toml` `project_id` matches this and that `supabase db push` / CLI commands target it — do not assume the CLI project matches the app project without checking.
- Don't touch modules on the CLAUDE.md §8 "working" list except where a task below explicitly names them.
- No secrets, tokens, or real passwords committed. Test credentials come from env vars or a local `.env.test` (gitignored), never hardcoded in a `.ts` file.
- Every task ends with a manual verification step (this app has Vitest + Playwright but both are unreliable right now per Phase 6 — don't trust an existing spec's green result without also eyeballing it).

---

## Phase 0 — Stop the bleeding (do this before anything else)

The current **uncommitted working tree** contains a regression: it reverts two modules from atomic RPC saves back to non-atomic sequential inserts, and adds dead/incorrect duplicate save logic. Fix this first so Phase 1+ work happens on a sound base.

### Task 0.1: Revert the BOM→PO generation regression

**Files:**
- Modify: `src/pages/BomPage.tsx:176-211` (the `generatePOMutation` block)

**Problem:** Current uncommitted code does `insert` into `purchase_orders`, then `insert` into `purchase_order_lines`, with a manual `.delete()` "rollback" on line-insert failure whose own error is never checked. This bypasses the atomic RPC added in commit `9853689`.

- [ ] **Step 1:** Run `git diff HEAD -- src/pages/BomPage.tsx` and confirm the `generatePOMutation` section is the one shown in the review above (raw `supabase.from('purchase_orders').insert(...)` followed by `supabase.from('purchase_order_lines').insert(...)`).
- [ ] **Step 2:** Replace that block with a call to the existing RPC, matching the shape `save_po_with_lines` expects (see `supabase/migrations/20260710030000_po_transactional_save.sql:8-30` for the exact `payload.header` / `payload.lines` field names):

```typescript
const payload: any = {
  header: {
    po_number: poNumber,
    vendor_id: vendor.id,
    po_date: new Date().toISOString().slice(0, 10),
    status: 'draft',
    source_type: form.bom_type === 'manual' ? 'manual' : 'bom',
    currency: companyBaseCurrency, // see Task 2.2 — do NOT hardcode 'USD'
    total_amount: poTotal,
    order_id: sourceRef,
    remarks: `From BOM: ${form.title || editingId?.slice(0, 8)}`,
  },
  lines: poLineRows.map((l, idx) => ({
    item_name: l.item_name,
    item_id: l.item_id,
    uom: l.uom,
    qty_ordered: l.qty_ordered,
    rate: l.rate,
    amount: l.amount,
    sort_order: idx,
  })),
};

const { error } = await supabase.rpc('save_po_with_lines', { payload });
if (error) throw error;
```

- [ ] **Step 3:** If `companyBaseCurrency` doesn't exist yet (Task 2.1/2.2 not done yet), temporarily keep `currency: 'USD'` here with a `// TODO(Phase 2): use company base currency` comment — don't block this revert on Phase 2.
- [ ] **Step 4:** Manually verify: open the app, go to BOM, save a BOM, generate a PO from it. Confirm one PO with lines appears in Purchase Orders, and confirm in the Supabase SQL editor that `purchase_order_lines.po_id` all point at the new PO.
- [ ] **Step 5: Commit**

```bash
git add src/pages/BomPage.tsx
git commit -m "fix(bom): restore atomic save_po_with_lines RPC for PO generation"
```

### Task 0.2: Revert the standalone Purchase Order save regression

**Files:**
- Modify: `src/pages/PurchaseOrdersPage.tsx:81-113` (`savePO` mutation)

Same problem, same fix pattern as Task 0.1 — restore the `supabase.rpc('save_po_with_lines', { payload })` call with `payload.header` / `payload.lines` shaped exactly as the RPC expects (see migration file cited above). Reference the pre-regression code via:

```bash
git show HEAD:src/pages/PurchaseOrdersPage.tsx | sed -n '80,120p'
```

- [ ] **Step 1:** Restore the RPC-based `savePO.mutationFn` from `git show HEAD:src/pages/PurchaseOrdersPage.tsx`.
- [ ] **Step 2:** Manually verify: create a standalone PO (not from BOM) with 2+ lines, save, confirm it appears with correct total and all lines in the PO detail view.
- [ ] **Step 3: Commit**

```bash
git add src/pages/PurchaseOrdersPage.tsx
git commit -m "fix(po): restore atomic save_po_with_lines RPC for manual PO save"
```

### Task 0.3: Remove dead/incorrect order-save logic from DataContext

**Files:**
- Modify: `src/context/DataContext.tsx:203-232` (in `addItem`) and `src/context/DataContext.tsx:277-305` (in `updateItem`)

**Problem:** This uncommitted code teaches `addItem`/`updateItem` to split `printingOrders`/`stitchingOrders` into `order_headers` + `order_rows` with two non-atomic inserts. Nothing calls it today — `PrintingOrdersPage.handleSave` and `StitchingOrdersPage.handleSave` both call `supabase.rpc('save_order_with_rows_and_colourways', ...)` directly. If left in place, it's a trap: whoever later "simplifies" an order page to use `addItem`/`updateItem` instead of the RPC will silently lose all colourways (this code path never touches `order_colourways`).

- [ ] **Step 1:** Confirm no caller exists: `grep -rn "addItem('printingOrders'\|addItem(\"printingOrders\"\|updateItem('printingOrders'\|updateItem(\"printingOrders\"" src/` should return nothing outside `DataContext.tsx` itself.
- [ ] **Step 2:** Delete the two blocks (the `if (key === 'printingOrders' || key === 'stitchingOrders') { ... }` branches) from both `addItem` and `updateItem`, restoring the plain single-table insert/update path for those keys — i.e. orders fall through to the same generic `supabase.from(tableName).insert(dbRow)` / `.update(dbUpdates)` every other key uses. Since nothing calls `addItem`/`updateItem` with these keys, this is a pure deletion, not a behavior change for any real user flow.
- [ ] **Step 3:** Run `npx tsc --noEmit` to confirm nothing else referenced `ORDER_HEADER_COLS`/`ORDER_ROW_COLS` in a way that now breaks (they're still legitimately used elsewhere if so — only remove the two dead branches, not the exported constants themselves unless nothing else uses them: `grep -rn "ORDER_HEADER_COLS\|ORDER_ROW_COLS" src/`).
- [ ] **Step 4: Commit**

```bash
git add src/context/DataContext.tsx
git commit -m "fix(data-context): remove dead non-atomic order-save branch (orders always go through save_order_with_rows_and_colourways RPC)"
```

### Task 0.4: Stop leaking Supabase session tokens via git

**Files:**
- Modify: repo git index (untrack `playwright/.auth/user.json`)
- Modify: `tests/auth.setup.ts` (remove hardcoded password)

**Problem:** `playwright/.auth/user.json` is tracked in git (commits `79edfca`, `de429be`) and contains a live Supabase JWT. `.gitignore` already lists `playwright/.auth/` but that doesn't untrack an already-tracked file. `tests/auth.setup.ts` (uncommitted) also hardcodes a real demo password.

- [ ] **Step 1:** Untrack the auth file (keeps it on disk, just stops git from tracking it):

```bash
git rm --cached playwright/.auth/user.json
```

- [ ] **Step 2:** In the Supabase dashboard for project `ejebukxlwgwebjgdicyb`, revoke/rotate the session for whichever user this token belongs to (Auth → Users → the `steelman@fabrios-demo.com` / test user → "Sign out user" or reset password), since the token has been sitting in git history and may still be valid.
- [ ] **Step 3:** In `tests/auth.setup.ts`, replace the hardcoded credentials with env vars:

```typescript
const TEST_EMAIL = process.env.FABRIOS_TEST_EMAIL ?? 'steelman@fabrios-demo.com';
const TEST_PASSWORD = process.env.FABRIOS_TEST_PASSWORD;
if (!TEST_PASSWORD) throw new Error('Set FABRIOS_TEST_PASSWORD before running auth.setup.ts');
```

- [ ] **Step 4:** Add a `.env.test.example` (no real values) documenting `FABRIOS_TEST_EMAIL` / `FABRIOS_TEST_PASSWORD`, and add `.env.test` to `.gitignore` if not already covered by the existing `.env.*` rule (it already is — just confirm: `git check-ignore -v .env.test`).
- [ ] **Step 5: Commit**

```bash
git add .gitignore tests/auth.setup.ts .env.test.example
git commit -m "security: stop tracking playwright auth token, remove hardcoded test password"
```

### Task 0.5: Confirm `supabase/config.toml` targets the real project

**Files:** `supabase/config.toml`

- [ ] **Step 1:** Confirm the uncommitted fix (`project_id = "ejebukxlwgwebjgdicyb"`) matches `.env`'s `VITE_SUPABASE_PROJECT_ID`. It does — commit it.
- [ ] **Step 2:** Run `supabase migration list` (or `npx supabase migration list`) against this project and confirm every file in `supabase/migrations/` shows as applied. If any are missing (especially `20260710010000_order_transactional_save.sql`, `20260710030000_po_transactional_save.sql`, `20260710050000_grn_transactional_save.sql`, and whatever added `save_bom_with_lines`), apply them now — this may explain why some "already fixed" bugs still reproduce live (the app talks to `ejebukxlwgwebjgdicyb`; if migrations were only ever run against the old `kpcgwampumhfcmgpubtw` while `config.toml` pointed there, the RPCs the frontend calls may not exist on the live DB at all).
- [ ] **Step 3: Commit**

```bash
git add supabase/config.toml
git commit -m "fix(supabase): point CLI config at the actual project used by the app"
```

---

## Phase 1 — Fix the bugs from the screenshots

### Task 1.1: Fix `internal_po` not-null violation on order save

**Files:** `src/pages/PrintingOrdersPage.tsx`, `src/pages/StitchingOrdersPage.tsx`

The screenshot shows: *"Order was not saved: null value in column 'internal_po' of relation 'order_headers' violates not-null constraint"*. Current code sends `internal_po: form.internalPO` — meaning `form.internalPO` is empty/undefined at save time for a **new** order (it's presumably meant to be auto-generated, e.g. `PO-P-0001` per `CLAUDE.md`).

- [ ] **Step 1:** Find where `form.internalPO` is supposed to get set. Search: `grep -n "internalPO" src/pages/PrintingOrdersPage.tsx`. Confirm whether there's any auto-generation logic (e.g. based on existing order count) or whether the field is just a plain text input the user is expected to fill in.
- [ ] **Step 2:** If it's meant to be auto-generated (matches `CLAUDE.md`'s documented format `PO-P-0001`), add generation on dialog-open for new orders:

```typescript
const nextInternalPO = () => {
  const existing = appData.printingOrders
    .map((o: any) => o.internalPO)
    .filter((v: string) => /^PO-P-\d+$/.test(v || ''))
    .map((v: string) => parseInt(v.split('-')[2], 10));
  const next = (existing.length ? Math.max(...existing) : 0) + 1;
  return `PO-P-${String(next).padStart(4, '0')}`;
};
```
Call this when opening the "New Order" dialog and seed `form.internalPO` with it, while still letting the user override it (it's shown as an editable field, if it is one).

- [ ] **Step 3:** Regardless of the auto-generation fix, add a client-side guard so this never reaches the RPC as null: in `handleSave`, before building `header`, do:

```typescript
if (!form.internalPO?.trim()) { toast.error('Internal PO is required'); setSaving(false); return; }
```

- [ ] **Step 4:** Repeat for `StitchingOrdersPage.tsx` (format `PO-S-0001` per existing convention — check `internal_po` values already in the DB via the Supabase table editor to confirm the real prefix convention in use, don't assume).
- [ ] **Step 5:** Manually verify: create a new printing order and a new stitching order end to end, confirm both save without the constraint error and get sensible auto-generated PO numbers.
- [ ] **Step 6: Commit**

```bash
git add src/pages/PrintingOrdersPage.tsx src/pages/StitchingOrdersPage.tsx
git commit -m "fix(orders): auto-generate internal PO number, guard against null on save"
```

### Task 1.2: Fix quotation number uniqueness violation

**Files:** `src/pages/QuotationsPage.tsx`

Screenshot: *"Quotation was not saved: duplicate key value violates unique constraint 'idx_quotations_company_number'"*. Same family of bug as 1.1 — number generation logic isn't producing a unique value (likely computing "next number" from stale in-memory `data.quotations` instead of querying the DB, so two quick saves — or a save after a prior failed save — reuse the same number).

- [ ] **Step 1:** Find the number-generation logic: `grep -n "quotation_number\|quotationNumber\|Q-" src/pages/QuotationsPage.tsx`.
- [ ] **Step 2:** Replace client-side "max of what's in local state + 1" logic (if that's what it's doing) with a DB-backed sequence check right before save, or catch the `23505` unique-violation error code specifically and retry once with an incremented number:

```typescript
async function nextQuotationNumber(companyId: string): Promise<string> {
  const { data } = await supabase
    .from('quotations')
    .select('quotation_number')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1);
  const last = data?.[0]?.quotation_number;
  const n = last ? parseInt(last.split('-')[1] || '0', 10) + 1 : 1;
  return `Q-${String(n).padStart(4, '0')}`;
}
```

Call this immediately before insert (not on dialog-open, to minimize the race window), and if the insert still 23505s, regenerate once and retry — two quick saves from the same browser tab shouldn't be able to collide, but don't assume no other tab/user is creating a quotation concurrently.
- [ ] **Step 3:** Manually verify: create two quotations back to back, confirm both save with sequential numbers.
- [ ] **Step 4: Commit**

```bash
git add src/pages/QuotationsPage.tsx
git commit -m "fix(quotations): generate quotation number from DB state, retry on collision"
```

### Task 1.3: Investigate Office Grid cost-before-output display

**Files:** `src/components/entries/BulkEntryGrid.tsx` (the "Office Grid" tab)

Screenshot shows a row with `Persons: 2`, `Output: (blank)`, `Cost: ₹1600` already computed, and the saved record later shows `Output: 0, Cost: ₹1600`.

- [ ] **Step 1:** Find the rate-basis lookup for this row (Shift=Regular, Resource=FT1, Worker Type=Printing). Check `rate_masters` for that combination's `rate_basis` — if it's `per_person` (cost = persons × rate), then `Output: 0, Cost: ₹1600` is **correct behavior**, not a bug (per-person cost doesn't depend on output). If `rate_basis` is `per_piece`/`per_meter`, then cost should be `output_qty × rate` and showing ₹1600 with output 0 is a real bug.
- [ ] **Step 2:** If it's the `per_person` case: this is a UX clarity issue, not a data bug — add a hint next to the Output column when `rate_basis === 'per_person'` (e.g. grey placeholder text "not applicable for per-person rate") so the owner doesn't misread it as broken.
- [ ] **Step 3:** If it's the `per_piece`/`per_meter` case: find where `BulkEntryGrid` computes `costAmount` per row and confirm it's reading `output_qty` at the time of calculation, not a stale/default value.
- [ ] **Step 4:** Manually verify against the actual rate master for Factory "22 Godown" / Shift "Regular" / Resource "FT1" / Worker Type "Printing" (from the screenshot) in the Supabase table editor.
- [ ] **Step 5: Commit** (message depends on what Step 1 found — either a UX label fix or a real calc fix).

### Task 1.4: Investigate and fix number-input and date-picker display bugs

**Files:** unknown until investigated — likely `src/components/entries/BulkEntryGrid.tsx`, `src/pages/masters/WorkersPage.tsx`, `src/pages/masters/WorkersRatesPage.tsx`, `src/pages/AttendancePage.tsx`, `src/components/DatePickerField.tsx`, or wherever else the owner encounters this.

**Owner's report (verbatim):** "basic housekeeping like where u enter number of workers etc, numbers dont show. date doesnt move well. many such minor issues there."

Static reading of the obvious candidate files (`WorkersPage.tsx`'s Hourly Rate input, `WorkersRatesPage.tsx`'s Rate Value inputs, `AttendancePage.tsx`'s Overtime Hours input) did not turn up an obvious bug — all use the `value={x || 0}` / `value={x || ''}` controlled-input pattern correctly. This needs live reproduction, not more guessing from source.

- [ ] **Step 1:** Start the dev server (`npm run dev`, port 8080) and open it in a browser. Sign in with the test account — email `steelman@fabrios-demo.com`, password from `FABRIOS_TEST_PASSWORD` env var (see `tests/auth.setup.ts` / `.env.test.example` for the convention; ask the controller for the actual value if not available in your environment).
- [ ] **Step 2:** Walk through every page with a numeric input — Workers master, Rate Masters, Attendance, Single Entry, Bulk Entry/Office Grid, order rows (Order Qty/Chart Qty/Rate/No. of Colours), BOM lines, PO lines. For each, open the edit dialog for an EXISTING record (not a blank new one — the bug is specifically about existing values "not showing", which points at edit/load, not create) and check whether numeric fields populate correctly. Screenshot the first one that reproduces.
- [ ] **Step 3:** For date fields, check every `DatePickerField`/native `<input type="date">` usage — try changing the date via typing, via the picker widget, and via keyboard arrows. Note exactly what "doesn't move well" means once reproduced (doesn't open, doesn't accept clicks, resets after selection, wrong format, etc.) — the owner's phrase is vague, don't assume.
- [ ] **Step 4:** Once reproduced, trace to root cause in the relevant component's state initialization / `value` binding — likely candidates: a field missing from an edit-mode "load existing record into form state" mapping (present in create defaults but dropped when populating from an existing row), or a controlled-input value receiving `undefined`/`NaN` instead of a fallback.
- [ ] **Step 5:** Fix the root cause where it lives (if it's a copy-pasted pattern across multiple pages, fix all affected pages, not just the first one found — grep for the same buggy pattern elsewhere before considering this done).
- [ ] **Step 6:** Manually verify the fix for each page/field found broken in Step 2-3.
- [ ] **Step 7: Commit** (one commit per root cause if there turn out to be multiple unrelated causes — don't force a single commit across unrelated fixes).

If Step 2/3 cannot reproduce anything after a genuinely thorough pass, report back what was checked and ask the owner for a screenshot or more specific repro steps rather than closing this as "couldn't reproduce, assumed fine."

**Added after Task 1.1:** two independent implementer sessions (one on this task's controller side testing `PurchaseOrdersPage`'s vendor `<Select>`, one on Task 1.1 testing `PrintingOrdersPage`/`StitchingOrdersPage`'s Buyer/Product/Fabric `<Select>`s) both hit the same class of flakiness — a `<Select>` rendered inside a `<Dialog>` sometimes doesn't register a click/keyboard selection. Task 1.1's implementer traced a plausible cause: the Select's portal renders outside the Dialog's DOM subtree, and the Dialog's `onPointerDownOutside`/`onFocusOutside` handlers may be interfering. This could be a real production interaction bug (not just a browser-automation quirk) and may be part of what the owner meant by "many such minor issues." Add to Step 2 of this task: click-test every Select-inside-Dialog in the app (order Buyer/Product/Fabric, PO Vendor, BOM/Quotation product pickers, etc.) with real mouse clicks (not just keyboard), across a few repeated open/close cycles of the same dialog, and determine whether this reproduces for a human/real click or only under synthetic automation events. If it's real, root-cause and fix it (likely a Radix Dialog/Select composition issue — check the shadcn/ui version and whether this is a known upstream interaction, or whether a custom `Dialog`/`Select` wrapper in this codebase is doing something nonstandard with focus/pointer event handling).

---

## Phase 2 — Currency: separate buyer pricing from local costing

**Business problem (from the owner):** Order currency (e.g. USD for an export buyer) is currently the only currency concept in the app, and it leaks into BOM/PO/labour cost tracking, which should always be in the company's local operating currency (materials and workers are paid locally regardless of what currency the buyer is invoiced in). Today `BomPage.tsx:186` hardcodes PO currency to `'USD'` unconditionally, and `ReportsPage.tsx`'s Profit/Loss tab hardcodes `$` on every value including cost lines — neither actually derives from the order at all, but the fix is the same either way: a company has one local currency for internal costs, orders/buyers can be priced in a different currency, and the two must never be conflated.

### Task 2.1: Add `base_currency` to companies

**Files:**
- Create: `supabase/migrations/<timestamp>_company_base_currency.sql`
- Modify: `src/pages/masters/CompaniesPage.tsx`
- Modify: `src/types/index.ts` (add `baseCurrency` to the `Company` interface)

- [ ] **Step 1:** Create the migration:

```sql
-- Migration: add company base (local operating) currency
-- Purpose: separate a company's local costing currency from buyer/order currency.
ALTER TABLE public.companies
  ADD COLUMN base_currency text NOT NULL DEFAULT 'INR';
```

- [ ] **Step 2:** Add the field to `CompaniesPage.tsx`'s `MasterCRUD` columns/form (same pattern as `legalName`/`address`):

```typescript
{ key: 'baseCurrency', header: 'Base Currency' },
```
and in the form:
```tsx
<div className="space-y-1"><Label className="text-xs">Base Currency (for costs)</Label>
  <Input value={formData.baseCurrency || 'INR'} onChange={e => onChange('baseCurrency', e.target.value.toUpperCase())} placeholder="INR" maxLength={3} />
</div>
```

- [ ] **Step 3:** Manually verify: apply the migration, open Company settings, confirm the field shows and saves.
- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_company_base_currency.sql src/pages/masters/CompaniesPage.tsx src/types/index.ts
git commit -m "feat(companies): add base_currency for local cost tracking, separate from order/buyer currency"
```

### Task 2.2: Use company base currency for BOM/PO costs

**Files:** `src/pages/BomPage.tsx`, `src/pages/PurchaseOrdersPage.tsx`

- [ ] **Step 1:** Wherever `currency: 'USD'` is currently hardcoded (Task 0.1's PO-generation payload, and `PurchaseOrdersPage.tsx`'s default form state), replace with the current company's `baseCurrency` from `DataContext`:

```typescript
const { data: appData } = useData();
const companyBaseCurrency = appData.companies?.[0]?.baseCurrency || 'INR';
```

- [ ] **Step 2:** Anywhere a PO/BOM line's rate or amount is displayed with a currency symbol, use `companyBaseCurrency`, never `order.currency`.
- [ ] **Step 3:** Manually verify: set a company's base currency to INR, create an order priced in USD, generate a BOM/PO from it, confirm the PO shows INR (not USD).
- [ ] **Step 4: Commit**

```bash
git add src/pages/BomPage.tsx src/pages/PurchaseOrdersPage.tsx
git commit -m "fix(bom,po): cost/procurement currency follows company base_currency, not buyer order currency"
```

### Task 2.3: Fix Profit/Loss report currency

**Files:** `src/pages/ReportsPage.tsx:393-419` (profit-loss `TabsContent`)

- [ ] **Step 1:** Replace every hardcoded `$` in the summary cards and table with `companyBaseCurrency` for **cost** columns (Labour Cost, Material Cost, Total Cost), and the relevant order's own `currency` for **Revenue** — these are genuinely two different currencies and mixing them into one "Profit" subtraction without conversion is itself financially meaningless. For this first pass, don't attempt FX conversion (that's a bigger feature) — instead:
  - Label Revenue column explicitly per-row with the order's currency code (e.g. `USD 1,200`) instead of assuming `$`.
  - Label cost columns with `companyBaseCurrency`.
  - Compute Profit/Margin only for orders where `order.currency === companyBaseCurrency`, and show `—` (with a tooltip: "revenue and cost in different currencies") for orders priced in a foreign currency, rather than silently subtracting mismatched-currency numbers.
- [ ] **Step 2:** Manually verify against at least one local-currency order and one foreign-currency order, confirm the foreign one shows `—` for profit instead of a wrong number.
- [ ] **Step 3: Commit**

```bash
git add src/pages/ReportsPage.tsx
git commit -m "fix(reports): stop subtracting cost and revenue in different currencies without conversion"
```

---

## Phase 3 — Missing "number of colours" field

**Files:** `src/pages/PrintingOrdersPage.tsx`, `src/pages/StitchingOrdersPage.tsx`

The data field (`noOfColours` / `no_of_colours`) already exists end-to-end (state, payload, DB column per `order_rows.no_of_colours`) — it's simply never rendered as an input, so it's always saved as `0`.

- [ ] **Step 1:** In `PrintingOrdersPage.tsx`, in the row form's qty/rate grid (currently `grid-cols-4`: Order Qty, Chart Qty, Rate/Item, Value — around line 576), change to `grid-cols-5` and add:

```tsx
<div className="space-y-1"><Label className="text-[10px]">No. of Colours</Label><Input className="h-8 text-xs" type="number" min={0} value={row.noOfColours || ''} onChange={e => updateRow(row.id, 'noOfColours', parseInt(e.target.value, 10) || 0)} /></div>
```

- [ ] **Step 2:** Repeat the same change in `StitchingOrdersPage.tsx` at its equivalent row-form location (check `grep -n "Rate/Item\|ratePerItem" src/pages/StitchingOrdersPage.tsx` for the exact spot).
- [ ] **Step 3:** Decide (ask the owner if unclear) whether "No. of Colours" should auto-derive from the count of colourway rows already entered below, rather than being a separately-typed number that can disagree with the actual colourway list. If auto-derive is wanted, replace the `Input` with a read-only computed value: `{(row.colours || []).filter((c:any) => c.colourName).length}`.
- [ ] **Step 4:** Manually verify: create/edit an order, set a colour count, save, reopen, confirm it persisted.
- [ ] **Step 5: Commit**

```bash
git add src/pages/PrintingOrdersPage.tsx src/pages/StitchingOrdersPage.tsx
git commit -m "fix(orders): expose No. of Colours input on order rows (field existed, was never rendered)"
```

---

## Phase 4 — Restore the reports that vanished

**Root cause (confirmed via git archaeology):** commit `de429be` ("feat: complete features 6-10...") silently reduced `ReportsPage.tsx` from 20 tabs to 7. The 13 missing tabs — Daily Detail, Factory Output, Pending Purchase, GRN Pending, Bill Tracking, Capacity vs Demand, Vendor Performance, Shortage, Inward/Outward, Consumption vs BOM, Monthly Trend, By Buyer, Operator Productivity — still exist in full working form in commit `5f51b7c`. This is not a "rebuild from scratch" job — it's "recover and re-verify against current schema."

**This phase should be split into one sub-task per report tab and executed/reviewed independently** (per the Scope Check in the writing-plans skill — 13 semi-independent report panels shouldn't be one giant task). Common recipe for each:

- [ ] **Step 1:** Pull the old implementation: `git show 5f51b7c:src/pages/ReportsPage.tsx > /tmp/old-reports.tsx`, locate the tab's `TabsContent` block and any data-fetching it depended on (some may live in a `useQuery` above the return, some inline).
- [ ] **Step 2:** Diff the tables/columns that panel queries against the *current* `src/integrations/supabase/types.ts` — several tables changed shape since `5f51b7c` (e.g. the order header/row split happened after this commit per `git log`). Adjust column references accordingly; don't paste it back verbatim without checking.
- [ ] **Step 3:** Re-add the tab to the current `tabs` array (`src/pages/ReportsPage.tsx:203-209`) and paste the adapted `TabsContent` block back in before the closing `</Tabs>`.
- [ ] **Step 4:** Manually verify the tab renders with real data and no console errors, for at least one non-empty case.
- [ ] **Step 5: Commit** — one commit per restored tab (or a small logical group, e.g. "GRN Pending" + "Pending Purchase" together since both read `purchase_orders`/`grn_headers`), message: `feat(reports): restore "<Tab Name>" report (lost in de429be)`.

**Suggested restoration order** (owner's "Inward/Outward" complaint first, then by likely business value):
1. Inward/Outward
2. Pending Purchase
3. GRN Pending
4. Consumption vs BOM
5. Vendor Performance
6. By Buyer
7. Bill Tracking
8. Shortage
9. Monthly Trend
10. Factory Output
11. Daily Detail
12. Capacity vs Demand
13. Operator Productivity

If any of these turn out to depend on tables/fields that no longer exist at all (not just renamed), stop and flag it back to the owner rather than guessing at a redesign — that's a product decision, not an engineering one.

---

## Phase 5 — Finish the half-baked BOM/Quotation/PO modules: challans & inward/outward documents

**Business problem:** `PurchaseOrdersPage`, `GRNPage`, and `DispatchPage` only have a "print filtered list" button (`printDetailPage` from `src/lib/pdf-export.ts`, which prints a table of many records). None of them can print a single formatted document — a GRN inward challan, a dispatch outward challan/delivery note, or a vendor-facing PO — which is what's actually needed to hand to a driver or vendor. `BomPage` has no print at all. `SubcontractJobsPage` has no print at all.

This phase needs one product decision before coding: **what fields does a physical challan need to carry** (company letterhead/address, consignor/consignee, vehicle number, item lines, signatures)? Don't invent this — ask the owner for a sample of the paper challan/PO format they currently use (or currently hand-write), since getting this wrong means it's still unusable in the field even though it "prints."

### Task 5.1: Add a single-document print primitive

**Files:**
- Modify: `src/lib/pdf-export.ts` — add a new export, e.g. `printChallan(doc: { title: string; company: Company; counterparty: { name: string; address?: string }; meta: Record<string,string>; lines: {label:string; qty:string; uom:string; remarks?:string}[]; footer?: string })`, structured as a single-page letterhead document (not a filtered-list table like `printDetailPage`).

- [ ] **Step 1:** Read the existing `printDetailPage` implementation (`src/lib/pdf-export.ts:43`) to reuse its window-print/HTML-generation approach rather than introducing a new PDF library — this stays consistent with the existing zero-dependency print pattern.
- [ ] **Step 2:** Build `printChallan` as described, with company name/address/legal name pulled from `DataContext`'s current company record.
- [ ] **Step 3:** Manually verify with a throwaway call from the browser console or a temp button, confirm it opens a sane print preview.
- [ ] **Step 4: Commit**

### Task 5.2: GRN inward challan

**Files:** `src/pages/GRNPage.tsx` or `src/pages/GRNDetailPage.tsx`

- [ ] Add a "Print Challan" button on a single GRN record (not the filtered-list print) that calls `printChallan` with vendor as counterparty, GRN lines as line items, tagged "Inward / Goods Received Note".
- [ ] Manually verify against a real GRN record.
- [ ] Commit: `feat(grn): add single-document inward challan print`

### Task 5.3: Dispatch outward challan

**Files:** `src/pages/DispatchPage.tsx`

- [ ] Add "Print Challan" on a single dispatch record, buyer as counterparty, tagged "Outward / Delivery Challan", including vehicle number / challan number fields already in `dispatch_records`.
- [ ] Manually verify.
- [ ] Commit: `feat(dispatch): add single-document outward challan print`

### Task 5.4: PO and BOM single-document print

**Files:** `src/pages/PurchaseOrdersPage.tsx`, `src/pages/BomPage.tsx`

- [ ] Add "Print PO" on a single purchase order (vendor-facing, not the internal filtered list).
- [ ] Add "Print BOM" on a single BOM.
- [ ] Manually verify both.
- [ ] Commit per page.

### Task 5.5: Subcontract job print

**Files:** `src/pages/SubcontractJobsPage.tsx`

- [ ] Add "Print Challan" for goods sent to a subcontractor (subcontractor as counterparty, process + qty_sent as line item).
- [ ] Manually verify.
- [ ] Commit: `feat(subcontract): add job send/receive challan print`

---

## Phase 6 — Docs and repo hygiene (do last, so it reflects the real end state)

### Task 6.1: Rewrite CLAUDE.md / AGENTS.md

- [ ] Remove the "Known Bugs — do not fix yet" section entirely (all three are fixed as of this plan's Phase 0/1).
- [ ] Update §2 env vars to the real project ID (`ejebukxlwgwebjgdicyb`).
- [ ] Update §6 DB schema table to reflect `companies.base_currency` (Phase 2) and any new tables added since (`quotations`, `invoices`, `subcontract_jobs`, `workers`, `attendance`, `material_issues` — these exist per `de429be` but aren't documented anywhere in the current file).
- [ ] Update §9 "Open Questions" — most are now answered (e.g. shifts/tables RLS is confirmed correctly scoped by factory→company; orders always go through the atomic RPC).
- [ ] Regenerate `AGENTS.md` as a copy of the corrected `CLAUDE.md` (confirm they're still meant to be identical, or diverge them if Codex needs different content).
- [ ] Commit: `docs: refresh CLAUDE.md/AGENTS.md to match current codebase state`

### Task 6.2: Repo cleanup

- [ ] Delete `src/pages/DevSmokePage.tsx` (unrouted, or re-add its route to `App.tsx` if it's still wanted as a dev tool — ask the owner which).
- [ ] Delete the 11 `debug-*.png` files in the repo root.
- [ ] Review the 33 files in `tests/` for duplicates (`bug-fix-verify.spec.ts` vs `bug-verify.spec.ts`, the four `*steelman*` files, `full-e2e.spec.ts` vs `full-lifecycle-e2e.spec.ts` vs `zero-to-production-pipeline.spec.ts`, `ui-based-e2e.spec.ts`) — consolidate into one maintained suite per feature area, delete the rest. This needs a human skim of each file's actual coverage before deleting; don't delete blind.
- [ ] Confirm `test-results/` is gitignored and not re-added.
- [ ] Commit: `chore: remove debug artifacts, orphaned page, consolidate duplicate test specs`

---

## Self-Review Notes

- **Spec coverage:** Phase 0 covers the regression I found independently. Phase 1 covers all 4 screenshot bugs (internal_po, quotation number, Office Grid — investigated not assumed). Phase 2 covers the currency complaint with a real architectural fix (base_currency), not a band-aid. Phase 3 covers the missing colours field (found it already exists in state, just unrendered). Phase 4 covers "reports vanished" with a confirmed root-cause commit and a concrete recovery method. Phase 5 covers "half-baked, can't print challans/inward-outward."
- **No placeholders:** Every task names exact files/line ranges from the actual current codebase, not invented ones. Phase 4 and 5 are intentionally scoped as "investigate + adapt" rather than fully-coded because they depend on schema drift (Phase 4) and an undelivered paper-format spec (Phase 5) that no amount of guessing fixes — flagged explicitly rather than faked.
- **Ordering matters:** Phase 0 must land before anything else, since Phases 1-5 all build on top of the atomic-RPC pattern Phase 0 restores.
