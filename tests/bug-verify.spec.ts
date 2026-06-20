import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:8080'

test.describe('Bug verification', () => {
  test('Bug 3: Stock Job end-date clear persists after save', async ({ page }) => {
    await page.goto(`${BASE}/stock-jobs`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /new job/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const jobNum = `SJ-E2E-${Date.now()}`
    await page.locator('[role="dialog"] input').nth(0).fill(jobNum)
    await page.locator('[role="dialog"] input').nth(1).fill('Test Product')
    await page.locator('[role="dialog"] input[type="date"]').nth(0).fill('2026-06-01')
    await page.locator('[role="dialog"] input[type="date"]').nth(1).fill('2026-06-15')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('table tbody')).toContainText(jobNum, { timeout: 5000 })

    const row = page.locator('table tbody tr').filter({ hasText: jobNum })
    await row.locator('button').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const endDateInput = page.locator('[role="dialog"] input[type="date"]').nth(1)
    await endDateInput.clear()
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })

    await row.locator('button').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const endVal = await page.locator('[role="dialog"] input[type="date"]').nth(1).inputValue()
    expect(endVal).toBe('')
  })

  test.skip('BOM save + generate PO works (covered by full-e2e)', async ({ page }) => {
    // Create vendor first
    await page.goto(`${BASE}/vendors`)
    await page.waitForLoadState('networkidle')
    const empty = await page.getByText(/no vendors/i).isVisible().catch(() => false)
    if (empty) {
      await page.getByRole('button', { name: /^add$/i }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.locator('[role="dialog"] input').nth(0).fill('VND-E2E')
      await page.locator('[role="dialog"] input').nth(1).fill('E2E Vendor')
      await page.getByRole('button', { name: /save/i }).click()
      await page.waitForTimeout(500)
    }

    // Create BOM
    await page.goto(`${BASE}/bom`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /new bom/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Title
    await page.locator('[role="dialog"] input').first().fill('E2E BOM Manual')

    // Switch type to "General Purchase" (value=manual)
    const typeTrigger = page.locator('[role="dialog"] [role="combobox"]').first()
    await typeTrigger.click()
    await page.waitForTimeout(200)
    await page.getByRole('option', { name: /general purchase/i }).click()
    await page.waitForTimeout(200)

    // Add a material line
    await page.getByRole('button', { name: /add line/i }).click()
    await page.waitForTimeout(300)

    // Fill line: Item name, Qty, Extra %, Rate
    const lineRow = page.locator('[role="dialog"] table tbody tr').first()
    await lineRow.locator('input').nth(0).fill('Test Material')     // Item name
    await lineRow.locator('input').nth(1).fill('meters')            // UOM
    await lineRow.locator('input[type="number"]').nth(0).fill('100') // Qty
    await lineRow.locator('input[type="number"]').nth(1).fill('10')  // Extra %
    await lineRow.locator('input[type="number"]').nth(2).fill('5')   // Rate

    // Vendor is a Select component; vendors are loaded via useQuery in BOM page
    // The first combobox in the line is Category, last is Vendor
    const vendorTrigger = lineRow.locator('[role="combobox"]').last()
    await vendorTrigger.click()
    await page.waitForTimeout(300)
    // Wait for options to appear — "None" is always present
    await expect(page.getByRole('option').filter({ hasText: 'None' }).first()).toBeVisible({ timeout: 5000 })
    // Now find and select the vendor
    const vendorOpt = page.locator('[role="option"]').filter({ hasText: 'E2E Vendor' })
    if (await vendorOpt.isVisible({ timeout: 5000 }).catch(() => false)) {
      await vendorOpt.click()
    } else {
      // Vendor not in list; type it or skip
      console.warn('Vendor option not found, proceeding without vendor')
      await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(200)

    // Save BOM
    await page.getByRole('button', { name: /save bom/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15000 })

    // Switch to the "General Purchase" tab where manual BOMs appear
    await page.getByRole('tab', { name: /general purchase/i }).click()
    await page.waitForTimeout(500)

    // Re-open BOM for editing (click pencil)
    await page.waitForTimeout(1000)
    const bomRow = page.locator('table tbody tr').filter({ hasText: 'E2E BOM Manual' })
    await expect(bomRow).toBeVisible({ timeout: 10000 })
    await bomRow.locator('button').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Select the line via checkbox
    await page.locator('[role="dialog"] [role="checkbox"]').first().check()
    await page.waitForTimeout(200)

    // Click Generate POs (inside dialog)
    await page.getByRole('button', { name: /generate pos?/i }).click()
    await page.waitForTimeout(1000)

    // Verify no error toast
    const errorToast = page.locator('[data-sonner-toast]').filter({ hasText: /error|failed|constraint/i })
    const hasError = await errorToast.isVisible().catch(() => false)
    expect(hasError).toBe(false)
  })
})
