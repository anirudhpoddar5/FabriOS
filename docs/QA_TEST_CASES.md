# FabriOS — QA Test Cases

**Version:** Post Bug-Fix Round 1  
**App URL:** http://localhost:8080 (run `npm run dev`)  
**Prepared for:** QA Team  

---

## How to Use This Document

- **Priority:** P0 = must pass before any release · P1 = important · P2 = nice to have
- **Status column:** Fill in PASS / FAIL / BLOCKED / SKIP during your run
- Each test lists exact steps and the expected result
- For FAIL — note the actual result and a screenshot path

---

## Prerequisites — Do This First

Before running any tests, complete these setup steps once:

1. Run `npm run dev` in the project folder
2. Open http://localhost:8080
3. Register a new account (any email/password)
4. Complete the Setup Wizard:
   - Company name: **Test Co**
   - Factory name: **Factory 1**
   - Module: **Both**
5. You are now on the Dashboard — proceed with tests

---

## Module 1 — Authentication

| ID | Title | Priority |
|----|-------|----------|
| AUTH-01 | Register with valid email and password | P0 |
| AUTH-02 | Login with correct credentials | P0 |
| AUTH-03 | Login with wrong password shows error | P0 |
| AUTH-04 | Forgot password sends reset email | P1 |
| AUTH-05 | Unauthenticated user cannot access /printing-orders | P0 |

### AUTH-01 — Register with valid email and password
**Steps:**
1. Open http://localhost:8080
2. Click **Register** (or navigate to /register)
3. Enter a valid email address and a password (min 6 characters)
4. Click **Register**

**Expected:** Account is created, user is redirected to the Setup Wizard

**Status:** ___

---

### AUTH-02 — Login with correct credentials
**Steps:**
1. Log out if already logged in
2. Navigate to http://localhost:8080
3. Enter valid email and password
4. Click **Login**

**Expected:** User is redirected to the Dashboard

**Status:** ___

---

### AUTH-03 — Login with wrong password
**Steps:**
1. Navigate to http://localhost:8080
2. Enter valid email but wrong password
3. Click **Login**

**Expected:** An error message appears (e.g. "Invalid credentials"). The user stays on the login page.

**Status:** ___

---

### AUTH-04 — Forgot password
**Steps:**
1. Navigate to http://localhost:8080
2. Click **Forgot password**
3. Enter a registered email address
4. Click **Send reset email**

**Expected:** A confirmation message is shown. No crash or blank screen.

**Status:** ___

---

### AUTH-05 — Unauthenticated access is blocked
**Steps:**
1. Log out
2. Manually navigate to http://localhost:8080/printing-orders

**Expected:** Redirected to the Login page. The printing orders page is NOT shown.

**Status:** ___

---

## Module 2 — Setup Wizard (Onboarding)

| ID | Title | Priority |
|----|-------|----------|
| SETUP-01 | New user sees wizard on first login | P0 |
| SETUP-02 | Wizard completes and lands on dashboard | P0 |
| SETUP-03 | User who skips wizard is redirected back | P1 |

### SETUP-01 — New user sees wizard on first login
**Steps:**
1. Register a brand new account
2. Confirm the email if required

**Expected:** After login, the Setup Wizard is displayed — not the dashboard

**Status:** ___

---

### SETUP-02 — Wizard completes successfully
**Steps:**
1. Start from the Setup Wizard
2. Enter company name → click Next
3. Enter factory name → click Next
4. Choose module (Printing / Stitching / Both) → click Next
5. Click **Finish** or equivalent final step

**Expected:** User lands on the Dashboard. Sidebar navigation is visible.

**Status:** ___

---

### SETUP-03 — Attempting to skip wizard redirects back
**Steps:**
1. While on the Setup Wizard, manually navigate to http://localhost:8080/printing-orders

**Expected:** Redirected back to the Setup Wizard

**Status:** ___

---

## Module 3 — Masters

### 3A — Buyers

| ID | Title | Priority |
|----|-------|----------|
| BUYER-01 | Add a new buyer | P0 |
| BUYER-02 | Edit an existing buyer | P1 |
| BUYER-03 | Buyer appears in order creation dropdown | P0 |

### BUYER-01 — Add a new buyer
**Steps:**
1. Navigate to **Settings → Buyers**
2. Click **Add Buyer**
3. Enter: Name = **Test Buyer**, Code = **TB001**
4. Click **Save**

**Expected:** Buyer appears in the list. Toast says "Saved" or similar.

**Status:** ___

---

### BUYER-02 — Edit an existing buyer
**Steps:**
1. Navigate to **Settings → Buyers**
2. Click edit on an existing buyer
3. Change the name
4. Click **Save**

**Expected:** The updated name is shown in the list immediately

**Status:** ___

---

### BUYER-03 — Buyer appears in order form
**Steps:**
1. Navigate to **Printing Orders**
2. Click **New Order**
3. Open the Buyer dropdown

**Expected:** The buyer created in BUYER-01 appears in the list

**Status:** ___

---

### 3B — Fabrics

| ID | Title | Priority |
|----|-------|----------|
| FABRIC-01 | Add a fabric | P0 |
| FABRIC-02 | Fabric appears in order form | P1 |

### FABRIC-01 — Add a fabric
**Steps:**
1. Navigate to **Settings → Fabrics**
2. Click **Add Fabric**
3. Enter: Name = **Cotton 180gsm**, Short Form = **CTN**
4. Click **Save**

**Expected:** Fabric appears in the list

**Status:** ___

---

### 3C — Products

| ID | Title | Priority |
|----|-------|----------|
| PROD-01 | Add a printing product | P0 |
| PROD-02 | Add a stitching product | P0 |

### PROD-01 — Add a printing product
**Steps:**
1. Navigate to **Settings → Printing Products**
2. Click **Add**
3. Enter: Name = **Screen Print**, Code = **SP01**, UOM = **meters**
4. Click **Save**

**Expected:** Product appears in the list

**Status:** ___

---

### PROD-02 — Add a stitching product
**Steps:**
1. Navigate to **Settings → Stitching Products**
2. Click **Add**
3. Enter: Name = **Basic Stitch**, Code = **BS01**, UOM = **pcs**
4. Click **Save**

**Expected:** Product appears in the list

**Status:** ___

---

### 3D — Vendors

| ID | Title | Priority |
|----|-------|----------|
| VENDOR-01 | Add a vendor | P0 |
| VENDOR-02 | Vendor appears in Purchase Order form | P1 |

### VENDOR-01 — Add a vendor
**Steps:**
1. Navigate to **Settings → Vendors**
2. Click **Add Vendor**
3. Enter: Name = **Fabric Supplier Co**, Code = **FSC01**
4. Click **Save**

**Expected:** Vendor appears in the list

**Status:** ___

---

## Module 4 — Printing Orders

| ID | Title | Priority |
|----|-------|----------|
| PO-01 | Create a new printing order with colourways | P0 |
| PO-02 | Edit an existing printing order | P1 |
| PO-03 | Order appears in the list after creation | P0 |
| PO-04 | Order detail page shows correct data | P1 |

### PO-01 — Create a printing order
**Pre-condition:** BUYER-01 and PROD-01 completed

**Steps:**
1. Navigate to **Printing Orders**
2. Click **New Order**
3. Fill in:
   - Internal PO: **PO-001**
   - Buyer: **Test Buyer**
   - Style: **Style A**
   - Target End Date: any future date
4. Add a product row:
   - Product: **Screen Print**
   - Fabric: **Cotton 180gsm**
   - Order Qty: **1000**
   - Chart Qty: **1000**
5. Add colourways:
   - Colour: **Red**, Ordered Qty: **500**
   - Colour: **Blue**, Ordered Qty: **500**
6. Click **Save Order**

**Expected:**
- Toast shows "Order saved" or similar
- Order appears in the Printing Orders list
- No errors in the browser console

**Status:** ___

---

### PO-02 — Edit an existing order
**Pre-condition:** PO-01 completed

**Steps:**
1. Navigate to **Printing Orders**
2. Click the edit button on PO-001
3. Change the Style to **Style B**
4. Click **Save Order**

**Expected:** The updated style is reflected in the list

**Status:** ___

---

### PO-03 — Order appears in list immediately
**Pre-condition:** PO-01 completed

**Steps:**
1. Navigate to **Printing Orders**

**Expected:** PO-001 is visible in the table without needing a page refresh

**Status:** ___

---

### PO-04 — Order detail page
**Pre-condition:** PO-01 completed

**Steps:**
1. Navigate to **Printing Orders**
2. Click on PO-001 to open the detail page

**Expected:**
- Internal PO number, buyer, style, colourways all shown correctly
- Red (500) and Blue (500) colourways are listed

**Status:** ___

---

## Module 5 — Stitching Orders

| ID | Title | Priority |
|----|-------|----------|
| SO-01 | Create a new stitching order | P0 |
| SO-02 | Stitching order does not appear in Printing Orders list | P1 |

### SO-01 — Create a stitching order
**Pre-condition:** BUYER-01 and PROD-02 completed

**Steps:**
1. Navigate to **Stitching Orders**
2. Click **New Order**
3. Fill in:
   - Internal PO: **SO-001**
   - Buyer: **Test Buyer**
   - Product: **Basic Stitch**
   - Order Qty: **500**, Chart Qty: **500**
4. Add a colourway: Colour = **White**, Qty = **500**
5. Click **Save Order**

**Expected:** Order appears in the Stitching Orders list

**Status:** ___

---

### SO-02 — Module separation
**Pre-condition:** PO-01 and SO-01 completed

**Steps:**
1. Navigate to **Printing Orders**

**Expected:** SO-001 does NOT appear here — it is a stitching order only

**Status:** ___

---

## Module 6 — Stock Jobs *(Bug-fix module — test all cases)*

| ID | Title | Priority |
|----|-------|----------|
| SJ-01 | Create a stock job | P0 |
| SJ-02 | Duplicate job number is blocked | P0 |
| SJ-03 | Duplicate check is case-insensitive | P0 |
| SJ-04 | Edit does not flag its own number as duplicate | P0 |
| SJ-05 | End date before start date is blocked | P0 |
| SJ-06 | Export CSV downloads correctly | P0 |
| SJ-07 | Export button shows spinner during export | P1 |
| SJ-08 | Module filter — Printing workspace shows only printing jobs | P0 |
| SJ-09 | Module filter — Both workspace shows all jobs | P0 |
| SJ-10 | Status badges have distinct colours | P2 |
| SJ-11 | Empty state message changes when search has no results | P2 |
| SJ-12 | New job pre-selects current workspace module | P1 |

### SJ-01 — Create a stock job
**Steps:**
1. Navigate to **Stock Jobs**
2. Click **+ New Job**
3. Fill in:
   - Job Number: **SJ-001**
   - Product Name: **Cotton Fabric Roll**
   - Module: **Printing**
   - Target Qty: **500**
   - UOM: **meters**
   - Start Date: today
   - Status: **Planned**
4. Click **Save**

**Expected:**
- Job appears in the table
- Toast: "Job created"
- Progress bar shows 0%

**Status:** ___

---

### SJ-02 — Duplicate job number is blocked
**Pre-condition:** SJ-01 completed (SJ-001 exists)

**Steps:**
1. Click **+ New Job**
2. Enter Job Number: **SJ-001** (same as existing)
3. Enter Product Name: **Another Product**
4. Click **Save**

**Expected:**
- Save is blocked
- Red error text appears under the Job Number field: "Job number already exists. Please use a unique job number."
- No toast error (the error is inline)

**Status:** ___

---

### SJ-03 — Duplicate check is case-insensitive
**Pre-condition:** SJ-001 exists

**Steps:**
1. Click **+ New Job**
2. Enter Job Number: **sj-001** (lowercase)
3. Enter Product Name: **Another Product**
4. Click **Save**

**Expected:** Blocked with the same "Job number already exists" error

**Status:** ___

---

### SJ-04 — Edit does not flag its own number as duplicate
**Pre-condition:** SJ-001 exists

**Steps:**
1. Click the edit (pencil) icon on SJ-001
2. Do not change the Job Number — leave it as **SJ-001**
3. Change the Status to **In Progress**
4. Click **Save**

**Expected:**
- Save succeeds
- No duplicate error shown
- Status badge updates to "in progress"

**Status:** ___

---

### SJ-05 — End date before start date is blocked
**Steps:**
1. Click **+ New Job**
2. Fill in Job Number: **SJ-002**, Product: **Test**
3. Set Start Date: **2026-06-01**
4. Set End Date: **2026-05-01** (before start date)
5. Click **Save**

**Expected:**
- Save is blocked
- Red error text appears: "End date cannot be before start date."

**Status:** ___

---

### SJ-06 — Export CSV
**Pre-condition:** At least 2 stock jobs exist (SJ-001 from SJ-01)

**Steps:**
1. Navigate to **Stock Jobs**
2. Click **Export**
3. Wait for download to complete

**Expected:**
- A `.csv` file is downloaded
- Filename format: `stock-jobs-export-YYYY-MM-DD.csv`
- Open the file — it should have 12 columns: Job #, Product, Module, Target Qty, UOM, Produced, Balance, Progress (%), Start Date, End Date, Status, Remarks
- Data rows match what is shown in the table
- Toast: "Exported successfully"

**Status:** ___

---

### SJ-07 — Export button shows loading state
**Steps:**
1. Click **Export**
2. Immediately observe the button

**Expected:**
- Button shows a spinning icon and text "Exporting..." while the download is being prepared
- Button returns to normal ("Export") after completion

**Status:** ___

---

### SJ-08 — Module filter (Printing workspace)
**Pre-condition:** At least one Printing job and one Stitching job exist

**Setup:** Create a stitching job:
1. Click **+ New Job**
2. Job Number: **SJ-STITCH-001**, Module: **Stitching**, Product: **Buttons**, Target Qty: 200
3. Save

**Steps:**
1. Go to **Module Select** (click the module switcher in the header/sidebar)
2. Select **Printing** as the current workspace
3. Navigate back to **Stock Jobs**

**Expected:**
- Only Printing jobs are shown
- The stitching job (SJ-STITCH-001) is NOT visible

**Status:** ___

---

### SJ-09 — Module filter (Both workspace)
**Steps:**
1. Switch workspace to **Both**
2. Navigate to **Stock Jobs**

**Expected:**
- All jobs regardless of module are shown (both printing and stitching)

**Status:** ___

---

### SJ-10 — Status badge colours are distinct
**Pre-condition:** Jobs with different statuses exist

**Steps:**
1. Navigate to **Stock Jobs**
2. Observe the Status badge colour for each status value

**Expected:**
| Status | Badge Colour |
|--------|-------------|
| Planned | Grey |
| In Progress | Blue |
| Completed | Green |
| Cancelled | Red |

**Status:** ___

---

### SJ-11 — Empty state message
**Steps:**
1. Navigate to **Stock Jobs**
2. Type a search term that matches nothing (e.g. **zzznomatch**)

**Expected:** Message reads "No jobs match your search." (not a generic "no data" message)

**Steps (clear search):**
3. Clear the search box

**Expected:** Message reads "No stock jobs found. Click '+ New Job' to create one." (if no jobs exist)

**Status:** ___

---

### SJ-12 — New job pre-selects current module
**Steps:**
1. Switch workspace to **Printing**
2. Navigate to **Stock Jobs**
3. Click **+ New Job**
4. Observe the Module dropdown

**Expected:** Module dropdown defaults to **Printing** (matches current workspace)

**Steps:**
5. Cancel, switch workspace to **Stitching**
6. Click **+ New Job** again

**Expected:** Module dropdown defaults to **Stitching**

**Status:** ___

---

## Module 7 — Dispatch *(Bug-fix module — test all cases)*

| ID | Title | Priority |
|----|-------|----------|
| DISP-01 | Create a dispatch record | P0 |
| DISP-02 | Qty of 0 is blocked | P0 |
| DISP-03 | Negative qty is blocked | P0 |
| DISP-04 | Fractional qty is blocked | P0 |
| DISP-05 | Date is required | P0 |
| DISP-06 | Order selector appears for "Against Order" type | P0 |
| DISP-07 | Available balance is shown after selecting an order | P0 |
| DISP-08 | Dispatch qty exceeding balance is blocked | P0 |
| DISP-09 | Order selector hidden for "From Stock" type | P1 |
| DISP-10 | Dispatch record appears in list after save | P0 |
| DISP-11 | Export CSV downloads | P1 |

### DISP-01 — Create a dispatch record
**Pre-condition:** PO-01 completed (order PO-001 with 1000 chart qty exists)

**Steps:**
1. Navigate to **Dispatch & Shipping**
2. Click **New Dispatch**
3. Fill in:
   - Date: today
   - Type: **Against Order**
   - Order: **PO-001**
   - Buyer: **Test Buyer**
   - Product: **Screen Print**
   - Colour: **Red**
   - Qty: **200**
   - UOM: **pcs**
   - Challan #: **CH-001**
4. Click **Save**

**Expected:**
- Toast: "Dispatch recorded"
- Record appears in the dispatch list

**Status:** ___

---

### DISP-02 — Qty of 0 is blocked
**Steps:**
1. Click **New Dispatch**
2. Set Date = today, Type = From Stock
3. Enter Qty: **0**
4. Click **Save**

**Expected:** Error toast: "Quantity must be greater than 0". Dialog stays open.

**Status:** ___

---

### DISP-03 — Negative qty is blocked
**Steps:**
1. Click **New Dispatch**
2. Set Date = today, Type = From Stock
3. Enter Qty: **-10**
4. Click **Save**

**Expected:** Error toast: "Quantity must be greater than 0". Dialog stays open.

**Status:** ___

---

### DISP-04 — Fractional qty is blocked
**Steps:**
1. Click **New Dispatch**
2. Set Date = today, Type = From Stock
3. Enter Qty: **10.5**
4. Click **Save**

**Expected:** Error toast: "Quantity must be a whole number". Dialog stays open.

**Status:** ___

---

### DISP-05 — Date is required
**Steps:**
1. Click **New Dispatch**
2. Clear the Date field
3. Enter Qty: **100**, Type = From Stock
4. Click **Save**

**Expected:** Error toast: "Date is required". Dialog stays open.

**Status:** ___

---

### DISP-06 — Order selector appears for "Against Order" type
**Steps:**
1. Click **New Dispatch**
2. Observe the Type dropdown — it defaults to **Against Order**

**Expected:** An **Order (Internal PO)** dropdown is visible below the Type field

**Status:** ___

---

### DISP-07 — Available balance shown after selecting order
**Pre-condition:** DISP-01 completed (200 already dispatched against PO-001 which has 1000 chart qty)

**Steps:**
1. Click **New Dispatch**
2. Type: **Against Order**
3. Select Order: **PO-001**

**Expected:**
- Below the Order dropdown, text appears: "Available balance: 800 pcs"
- (1000 chart qty − 200 already dispatched = 800)

**Status:** ___

---

### DISP-08 — Dispatch qty exceeding balance is blocked
**Pre-condition:** DISP-07 — PO-001 has 800 pcs available

**Steps:**
1. Click **New Dispatch**
2. Type: **Against Order**, Order: **PO-001**
3. Enter Qty: **900** (exceeds 800 available)
4. Click **Save**

**Expected:** Error toast: "Quantity exceeds available balance (800 pcs)". Dialog stays open.

**Status:** ___

---

### DISP-09 — Order selector hidden for "From Stock"
**Steps:**
1. Click **New Dispatch**
2. Change Type to **From Stock**

**Expected:** The Order dropdown disappears. The form does not show an order selector.

**Status:** ___

---

### DISP-10 — Record appears in list
**Pre-condition:** DISP-01 completed

**Steps:**
1. Navigate to **Dispatch & Shipping**

**Expected:** The dispatch record from DISP-01 is visible in the table (Date, Buyer, Type, Product, Colour, Qty, Challan)

**Status:** ___

---

### DISP-11 — Export dispatch CSV
**Steps:**
1. Navigate to **Dispatch & Shipping**
2. Click **Export**

**Expected:**
- CSV file downloads
- Filename: `dispatches.csv`
- Contains columns: Date, Buyer, Type, Product, Colour, Qty, UOM, Vehicle, Challan

**Status:** ___

---

## Module 8 — Entries (Production Log)

| ID | Title | Priority |
|----|-------|----------|
| ENTRY-01 | Log a production entry | P0 |
| ENTRY-02 | Entry appears in entries list | P0 |

### ENTRY-01 — Log a production entry
**Pre-condition:** PO-01 completed

**Steps:**
1. Navigate to **Entries**
2. Click **New Entry** or **Log Entry**
3. Fill in:
   - Date: today
   - Module: Printing
   - Order: PO-001
   - Output Qty: **200**
4. Click **Save**

**Expected:** Entry is saved. Toast confirms.

**Status:** ___

---

### ENTRY-02 — Entry appears in list
**Steps:**
1. Navigate to **Entries**

**Expected:** The entry from ENTRY-01 is visible in the list with correct date and quantity

**Status:** ___

---

## Module 9 — Inventory

| ID | Title | Priority |
|----|-------|----------|
| INV-01 | Add an inventory item | P0 |
| INV-02 | Item appears in inventory list | P0 |

### INV-01 — Add an inventory item
**Steps:**
1. Navigate to **Inventory**
2. Click **Add Item**
3. Fill in:
   - Code: **INV-001**
   - Name: **Cotton Fabric**
   - Category: **Fabric**
   - UOM: **meters**
   - Opening Stock: **1000**
4. Click **Save**

**Expected:** Item appears in the inventory list with opening stock of 1000

**Status:** ___

---

## Module 10 — Purchase Orders

| ID | Title | Priority |
|----|-------|----------|
| PUR-01 | Create a purchase order | P0 |
| PUR-02 | PO appears in list | P0 |

### PUR-01 — Create a purchase order
**Pre-condition:** VENDOR-01 and INV-01 completed

**Steps:**
1. Navigate to **Purchase Orders**
2. Click **New PO**
3. Fill in:
   - PO Number: **PO-VND-001**
   - Vendor: **Fabric Supplier Co**
   - Date: today
4. Add a line item:
   - Item: **Cotton Fabric**
   - Qty Ordered: **500**
   - Rate: **10**
5. Click **Save**

**Expected:** PO appears in the list with status "Draft"

**Status:** ___

---

## Module 11 — GRN (Goods Received Note)

| ID | Title | Priority |
|----|-------|----------|
| GRN-01 | Create a GRN against a PO | P0 |

### GRN-01 — Create a GRN
**Pre-condition:** PUR-01 completed

**Steps:**
1. Navigate to **GRN**
2. Click **New GRN**
3. Fill in:
   - GRN Number: **GRN-001**
   - Vendor: **Fabric Supplier Co**
   - PO: **PO-VND-001**
4. Add a line: Item = Cotton Fabric, Qty Received = **500**
5. Click **Save**

**Expected:** GRN appears in the list with status "Draft" or "Completed"

**Status:** ___

---

## Module 12 — BOM (Bill of Materials)

| ID | Title | Priority |
|----|-------|----------|
| BOM-01 | Create a BOM for an order | P0 |
| BOM-02 | Add a BOM line item | P0 |

### BOM-01 — Create a BOM
**Pre-condition:** PO-01 completed

**Steps:**
1. Navigate to **BOM**
2. Click **New BOM**
3. Select:
   - Type: **Order**
   - Order: **PO-001**
   - Title: **BOM for PO-001**
4. Click **Save**

**Expected:** BOM header appears in list

**Status:** ___

---

### BOM-02 — Add a BOM line
**Pre-condition:** BOM-01 completed, INV-01 completed

**Steps:**
1. Open the BOM created in BOM-01
2. Click **Add Line**
3. Fill in:
   - Category: **Fabric**
   - Item: **Cotton Fabric**
   - Quantity: **1200**
   - Rate: **10**
4. Click **Save**

**Expected:** Line appears in the BOM with total amount = 12,000

**Status:** ___

---

## Module 13 — Reports

| ID | Title | Priority |
|----|-------|----------|
| RPT-01 | Reports page loads without error | P0 |
| RPT-02 | At least one report renders data | P1 |

### RPT-01 — Reports page loads
**Steps:**
1. Navigate to **Reports**

**Expected:** Page loads with a list of available reports. No crash or blank screen.

**Status:** ___

---

### RPT-02 — Report renders
**Steps:**
1. Navigate to **Reports**
2. Click on any available report

**Expected:** Report content is displayed (table or chart). If no data exists, a "no data" message is shown — not an error.

**Status:** ___

---

## Module 14 — Dashboard

| ID | Title | Priority |
|----|-------|----------|
| DASH-01 | Dashboard loads without error | P0 |
| DASH-02 | KPI tiles are visible | P1 |

### DASH-01 — Dashboard loads
**Steps:**
1. Navigate to **/** or click the Dashboard link

**Expected:** Dashboard page renders. No white screen, no JS error in console.

**Status:** ___

---

### DASH-02 — KPI tiles visible
**Steps:**
1. View the Dashboard

**Expected:** At least the main KPI tiles/cards are visible (even if showing 0 or no data)

**Status:** ___

---

## Regression — Cross-Module

| ID | Title | Priority |
|----|-------|----------|
| REG-01 | Printing order colourways are saved and retrievable | P0 |
| REG-02 | Stitching orders are separate from printing orders | P0 |
| REG-03 | Page refresh does not lose data | P0 |
| REG-04 | Switching modules (Printing ↔ Stitching) does not crash | P0 |

### REG-01 — Colourways persist
**Pre-condition:** PO-01 completed

**Steps:**
1. Navigate to **Printing Orders**
2. Click on PO-001
3. Verify the colourways (Red 500, Blue 500) are shown

**Expected:** Both colourways are present with correct quantities

**Status:** ___

---

### REG-02 — Module data separation
**Pre-condition:** PO-01 and SO-01 completed

**Steps:**
1. Open **Printing Orders** — count the orders
2. Open **Stitching Orders** — count the orders

**Expected:** PO-001 only appears in Printing. SO-001 only appears in Stitching. No cross-contamination.

**Status:** ___

---

### REG-03 — Data survives page refresh
**Steps:**
1. Navigate to **Stock Jobs**
2. Note the list of jobs
3. Press **F5** (or Cmd+R) to refresh the page

**Expected:** The same list of jobs is shown after refresh. No data loss.

**Status:** ___

---

### REG-04 — Module switch does not crash
**Steps:**
1. While on any page, click the module switcher
2. Switch from **Printing** to **Stitching**
3. Switch from **Stitching** to **Both**
4. Navigate to a few pages in each mode

**Expected:** No white screen, no JS error, pages load correctly in each mode

**Status:** ___

---

## Bug-Fix Verification Summary

These are the specific fixes applied in this release. All must pass before sign-off.

| Fix | Test Cases | Must All Pass |
|-----|-----------|---------------|
| Stock Jobs: export was silently failing | SJ-06, SJ-07 | ✅ |
| Stock Jobs: workspace filter not applied | SJ-08, SJ-09 | ✅ |
| Stock Jobs: duplicate job number not validated | SJ-02, SJ-03, SJ-04 | ✅ |
| Dispatch: no qty validation | DISP-02, DISP-03, DISP-04, DISP-05 | ✅ |
| Dispatch: no balance check against order | DISP-06, DISP-07, DISP-08 | ✅ |

---

## Notes for QA

- **Browser:** Test in Chrome (primary). Spot-check in Safari and Firefox.
- **Viewport:** Run all P0 tests at 1280×800 desktop. Run SJ tests on mobile viewport (375px) — the Stock Jobs page has a card view on mobile.
- **Console errors:** Keep DevTools open. Any red console error during a PASS test should be noted as a warning.
- **Data isolation:** Each tester should use a separate account/company to avoid data conflicts.
- **Smoke test page:** Developers can use http://localhost:8080/dev-smoke (DEV only) to seed test data across all tables automatically before running the above test cases.
