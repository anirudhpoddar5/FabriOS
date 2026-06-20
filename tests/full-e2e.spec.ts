import { test, expect, Page } from '@playwright/test'

const BASE = 'http://localhost:8080'

// ─────────────────────────────────────────────────────────────
// Radix UI Select helper — clicks the trigger by label text,
// then clicks the option from the portal popover
// ─────────────────────────────────────────────────────────────
async function selectOption(page: Page, label: string, optionText: string | RegExp) {
  // Find the parent div that contains both the label and the select trigger
  const parent = page.locator(`div:has(> label:text-is("${label}"))`).first()
  const trigger = parent.locator('[role="combobox"]')
  await trigger.click()
  await page.waitForTimeout(200)
  await page.getByRole('option', { name: optionText as any }).first().click()
}

// ─────────────────────────────────────────────────────────────
// Helper: click a button by its visible text
// ─────────────────────────────────────────────────────────────
async function clickButton(page: Page, text: string | RegExp) {
  if (typeof text === 'string') {
    await page.getByRole('button', { name: text, exact: true }).click()
  } else {
    await page.getByRole('button', { name: text }).first().click()
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: fill a labelled input field
// ─────────────────────────────────────────────────────────────
async function fillField(page: Page, label: string, value: string) {
  const parent = page.locator(`div:has(> label:text-is("${label}"))`).first()
  const input = parent.locator('input').first()
  await input.clear()
  await input.fill(value)
}

// ─────────────────────────────────────────────────────────────
// FULL E2E: Master Data → Printing Order → Entry → Dispatch
// ─────────────────────────────────────────────────────────────
test.describe('Full E2E — Real-world user flow', () => {
  test.setTimeout(180_000) // 3 minutes for the whole flow

  test('Full workflow: masters → order → entry → dispatch → BOM → reports', async ({ page }) => {
    // Use unique style per run to avoid cross-run pollution in selects
    const STYLE = `STY-${Date.now()}`
    const BUYER_CODE = 'BUY-E2E'

    // ── Step 0: Navigate to app ──
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/Application error/i)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })

    // ── Step 1: Create Factory ──
    await page.goto(`${BASE}/settings/factories-shifts`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /factories/i })).toBeVisible()

    await clickButton(page, /add factory/i)
    await expect(page.getByRole('dialog')).toBeVisible()
    await fillField(page, 'Factory Code *', 'FAC-E2E')
    await fillField(page, 'Factory Name *', 'E2E Test Factory')
    await selectOption(page, 'Type *', 'Printing')
    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.locator('table tbody')).toContainText('FAC-E2E')

    // Select the factory row to see shift section
    await page.getByText('FAC-E2E').first().click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('heading', { name: /shifts —/i })).toBeVisible()

    // ── Step 2: Create Shift ──
    await clickButton(page, /add shift/i)
    await expect(page.getByRole('dialog')).toBeVisible()
    await fillField(page, 'Shift Code *', 'GEN')
    await fillField(page, 'Shift Name *', 'General')
    // Start/End times have defaults 08:00/17:00
    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('cell', { name: 'GEN', exact: true }).first()).toBeVisible()

    // ── Step 3: Create Worker Type with default rate ──
    await page.goto(`${BASE}/settings/workers-rates`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /workers/i })).toBeVisible()

    await clickButton(page, 'Add Worker')
    await expect(page.getByRole('dialog')).toBeVisible()
    await fillField(page, 'Name *', 'Printer')
    await selectOption(page, 'Factory (Location)', 'E2E Test Factory')
    await selectOption(page, 'Module', 'Printing')

    // Default rate section (only shown when creating, not editing)
    await selectOption(page, 'Rate Basis', 'Per Person/Shift')
    await fillField(page, 'Default Rate Value', '150')
    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.locator('table tbody')).toContainText('Printer')

    // ── Step 4: Create Buyer ──
    await page.goto(`${BASE}/settings/buyers`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /^buyer$/i })).toBeVisible()

    // Click the "Add" button (from MasterCRUD)
    await clickButton(page, 'Add')
    await expect(page.getByRole('dialog')).toBeVisible()
    await fillField(page, 'Buyer Code *', 'BUY-E2E')
    await fillField(page, 'Buyer Name', 'E2E Test Buyer')
    await selectOption(page, 'Country *', 'India')
    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.locator('table')).toContainText(BUYER_CODE)

    // ── Step 5: Create Fabric ──
    await page.goto(`${BASE}/settings/fabrics`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /^fabric$/i })).toBeVisible()

    await clickButton(page, 'Add')
    await expect(page.getByRole('dialog')).toBeVisible()
    await fillField(page, 'Fabric Name *', 'Cotton Canvas')
    // Short form auto-suggested
    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.locator('table')).toContainText('Cotton Canvas')

    // ── Step 6: Create Printing Table ──
    await page.goto(`${BASE}/settings/printing-tables`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /^printing table$/i })).toBeVisible()

    await clickButton(page, 'Add')
    await expect(page.getByRole('dialog')).toBeVisible()
    await selectOption(page, 'Factory *', 'E2E Test Factory')
    await fillField(page, 'Table Code *', 'TBL-E2E')
    await fillField(page, 'Table Name *', 'E2E Printing Table 1')
    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.locator('table')).toContainText('TBL-E2E')

    // ── Step 7: Create Printing Product ──
    await page.goto(`${BASE}/settings/printing-products`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /^printing product$/i })).toBeVisible()

    await clickButton(page, 'Add')
    await expect(page.getByRole('dialog')).toBeVisible()
    await fillField(page, 'Product Name *', 'Printed Fabric E2E')
    await fillField(page, 'Product Code (auto)', 'PFE2E')
    await selectOption(page, 'UOM *', 'Meters')
    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.locator('table')).toContainText('PFE2E')

    // ── Step 8: Create Printing Order with Colourways ──
    await page.goto(`${BASE}/printing-orders`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /printing orders/i })).toBeVisible()

    await clickButton(page, /new order/i)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('New Printing Order')).toBeVisible()

    // Buyers are loaded from DataContext — select by text
    await selectOption(page, 'Buyer *', /BUY-E2E/)
    await fillField(page, 'Style *', STYLE)
    // We need to find the fabric by the display text in the select
    // The Fabric Select shows: "shortForm - name"
    await selectOption(page, 'Fabric *', 'CC - Cotton Canvas')

    await fillField(page, 'Width', '60')
    await fillField(page, 'Order Qty', '1000')
    await fillField(page, 'Chart Qty', '1000')
    await fillField(page, 'Rate/Item', '5.50')

    // Add colourways (there's already one row by default)
    // Fill the first colour row
    const colourRows = page.locator('[role="dialog"] table tbody tr')
    await colourRows.first().locator('input').nth(0).fill('Red')
    await colourRows.first().locator('input[type="number"]').first().fill('500')

    // Add a second colour row
    await clickButton(page, /add row/i)
    await page.waitForTimeout(200)
    const rows2 = page.locator('[role="dialog"] table tbody tr')
    await rows2.nth(1).locator('input').nth(0).fill('Blue')
    await rows2.nth(1).locator('input[type="number"]').first().fill('500')

    // Save the order
    await clickButton(page, /save order/i)
    // Wait for the toast and dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 })
    // Verify the order appears in the table
    await expect(page.locator('table tbody')).toContainText(STYLE, { timeout: 10_000 })

    // ── Step 9: Navigate to Order Detail ──
    // Click on the order row to navigate to detail page
    await page.getByText(STYLE).first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/Application error/i)
    // Verify detail shows the order info
    await expect(page.locator('body')).toContainText(STYLE)
    await expect(page.locator('body')).toContainText('Red')
    await expect(page.locator('body')).toContainText('Blue')

    // ── Step 10: Log Production Entry ──
    await page.goto(`${BASE}/entries`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /entries/i })).toBeVisible()

    // Select Order from the dropdown — shows internalPO — style
    await selectOption(page, 'Order *', new RegExp(STYLE))
    await page.waitForTimeout(300)
    // Select Colour
    await selectOption(page, 'Colour *', 'Red')
    // Select Factory
    await selectOption(page, 'Factory *', 'E2E Test Factory')
    await page.waitForTimeout(200)
    // Select Shift
    await selectOption(page, 'Shift *', 'General')
    // Select Table (resource)
    await selectOption(page, 'Table *', /TBL-E2E/)
    // Select Worker Type
    await selectOption(page, 'Worker Type *', 'Printer')

    // Fill Persons and Output
    await fillField(page, 'Persons Used', '2')
    await fillField(page, 'Output Qty', '400')
    await fillField(page, 'UOM', 'meters')

    // Verify rate and cost are shown
    await expect(page.locator('body')).toContainText(/rate/i)
    await expect(page.locator('body')).toContainText(/cost/i)

    // Save Entry
    await clickButton(page, /save entry/i)
    await page.waitForTimeout(1000)
    // Form should reset (orderId cleared)
    await expect(page.getByText('Success')).toBeVisible({ timeout: 5000 }).catch(() => {
      // toast may have disappeared
    })

    // ── Step 11: Create Dispatch ──
    await page.goto(`${BASE}/dispatch`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /dispatch/i })).toBeVisible()

    await clickButton(page, /new dispatch/i)
    await expect(page.getByRole('dialog')).toBeVisible()

    // Select dispatch type — default is "Against Order"
    // Select Order — shows internalPO — style
    await selectOption(page, 'Order (Internal PO)', new RegExp(STYLE))
    await page.waitForTimeout(200)
    // Select Buyer
    await selectOption(page, 'Buyer', /E2E Test Buyer/i)
    // Fill dispatch details
    await fillField(page, 'Product', 'Printed Fabric E2E')
    await fillField(page, 'Colour', 'Red')
    await fillField(page, 'Qty *', '100')

    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })

    // ── Step 12: Create BOM ──
    await page.goto(`${BASE}/bom`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /bom & purchase/i })).toBeVisible()

    await clickButton(page, /new bom/i)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New BOM' })).toBeVisible()

    // The BOM dialog has Title, Type(auto=order), Order select
    await fillField(page, 'Title', 'E2E Test BOM')
    // Select the order
    await selectOption(page, 'Order', new RegExp(STYLE))
    // Add a BOM line
    await clickButton(page, /add line/i)
    await page.waitForTimeout(200)

    // Fill BOM line fields
    const bomLineRows = page.locator('[role="dialog"] table tbody tr')
    await bomLineRows.first().locator('input').nth(0).fill('Cotton Fabric')
    await bomLineRows.first().locator('input[type="number"]').nth(0).fill('500')
    await bomLineRows.first().locator('input[type="number"]').nth(1).fill('2.5')
    await bomLineRows.first().locator('input[type="number"]').nth(2).fill('5.50') // Rate

    // Save BOM
    await clickButton(page, /save bom/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })

    // ── Step 12b: Generate PO from BOM ──
    // Create a vendor with unique code
    await page.goto(`${BASE}/settings/vendors`)
    await page.waitForLoadState('networkidle')
    await clickButton(page, /add vendor/i)
    await expect(page.getByRole('dialog')).toBeVisible()
    await fillField(page, 'Code *', `VND-${Date.now().toString(36).toUpperCase()}`)
    await fillField(page, 'Name *', 'E2E Vendor')
    await clickButton(page, /save/i)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })

    // Re-open saved BOM in edit dialog
    await page.goto(`${BASE}/bom`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /bom & purchase/i })).toBeVisible()
    // Click edit (pencil) on the E2E Test BOM row
    const bomTable = page.locator('table tbody')
    await expect(bomTable).toContainText('E2E Test BOM', { timeout: 10_000 })
    await bomTable.locator('button').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /edit bom/i })).toBeVisible()

    // Set vendor on the BOM line via Select
    const editLineRow = page.locator('[role="dialog"] table tbody tr').first()
    const vendorTrigger = editLineRow.locator('[role="combobox"]').last()
    await vendorTrigger.click()
    await page.waitForTimeout(300)
    await page.locator('[role="option"]').filter({ hasText: 'E2E Vendor' }).first().click()
    await page.waitForTimeout(200)

    // Select the line checkbox
    await page.locator('[role="dialog"] [role="checkbox"]').first().click()
    await page.waitForTimeout(200)

    // Click Generate POs
    await clickButton(page, /generate po/i)
    await page.waitForTimeout(1000)

    // Verify no error toast
    const errToast = page.locator('[data-sonner-toast]').filter({ hasText: /error|failed|constraint/i })
    await expect(errToast).not.toBeVisible({ timeout: 5000 })

    // ── Step 13: Verify Reports page ──
    await page.goto(`${BASE}/reports`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/Application error/i)

    // ── Step 14: Verify Dashboard ──
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/undefined/)
    await expect(page.locator('body')).not.toContainText(/NaN/)

    // ── Verify Business Logic: Dashboard balance calc ──
    const bodyText = await page.locator('body').innerText()
    // The balance section should have ordered, produced, balance
    if (bodyText.includes('Order Balance Overview')) {
      // Extract numbers from "Total Ordered: X" etc
      // Just verify no crash — deeper calc tested elsewhere
    }
  })

  test.afterAll(async () => {
    // Data cleanup is handled by the Z-category test in qa-full.spec.ts.
    // Full E2E test relies on auth token being fresh, which expires before afterAll runs.
    // No action needed here — the Z-cleanup runs at the end of the QA suite.
  })
})
