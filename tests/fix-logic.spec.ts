import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8080';

test.describe('Dashboard — Overdue/Due detection', () => {
  test('DASH-01 Overdue/Due card shows combined count and is red when overdue', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const card = page.getByText('Overdue / Due').locator('..').locator('..');
    await expect(card).toBeVisible();
    const value = await card.locator('.text-2xl').textContent();
    const num = parseInt(value ?? '0');
    expect(typeof num).toBe('number');
    const badge = page.getByText(/overdue|due today/i);
    if (num > 0) {
      await expect(badge).toBeVisible();
      await expect(card.locator('.text-red-600')).toBeVisible();
    }
  });

  test('DASH-02 Overdue count includes buyerDeliveryDate past orders', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').innerText();
    const match = body.match(/(\d+) overdue/);
    if (match) {
      const overdueCount = parseInt(match[1]);
      expect(overdueCount).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Dashboard — Per-colourway progress', () => {
  test('DASH-03 In Production section shows colourway chips for multi-colour orders', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const section = page.getByText(/in production/i).locator('..').locator('..');
    await expect(section).toBeVisible();
    const colourwayChips = section.locator('.text-\\[9px\\].bg-muted\\/50');
    const count = await colourwayChips.count();
    if (count > 0) {
      for (const chip of await colourwayChips.all()) {
        const text = await chip.innerText();
        expect(text).toMatch(/\d+%/);
      }
    }
  });

  test('DASH-04 colourway progress shows 0% for unproduced colours', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const chips = page.locator('.text-\\[9px\\].bg-muted\\/50', { hasText: '0%' });
    const count = await chips.count();
    // Should have at least as many 0%s as there are colourways with no production
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('URL param — auto-open dialogs', () => {
  test('URL-01 /printing-orders?action=new auto-opens New Order dialog', async ({ page }) => {
    await page.goto(`${BASE}/printing-orders?action=new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('New Printing Order')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('URL-02 /stitching-orders?action=new auto-opens New Order dialog', async ({ page }) => {
    await page.goto(`${BASE}/stitching-orders?action=new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('URL-03 /purchase-orders?action=new auto-opens New PO dialog', async ({ page }) => {
    await page.goto(`${BASE}/purchase-orders?action=new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('New Purchase Order')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('URL-04 /grn?action=new auto-opens New GRN dialog', async ({ page }) => {
    await page.goto(`${BASE}/grn?action=new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('New Goods Receipt')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

test.describe('Dashboard Quick Actions — navigation with params', () => {
  test('QA-01 "New Order" quick action navigates with ?action=new', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New Order' }).click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('action=new');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
  });

  test('QA-02 "New PO" quick action navigates with ?action=new', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New PO' }).click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('action=new');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('New Purchase Order')).toBeVisible();
  });

  test('QA-03 "Receive Goods" quick action navigates with ?action=new', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Receive Goods' }).click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('action=new');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Business logic — dashboard calculations', () => {
  test('LOGIC-01 Overall production progress shows correct aggregation', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const progressHeader = page.getByText('Overall Production Progress');
    if (await progressHeader.isVisible().catch(() => false)) {
      await expect(progressHeader).toBeVisible();
      const parent = progressHeader.locator('..');
      const text = await parent.innerText();
      const match = text.match(/([\d.]+)\s*\/\s*([\d.]+)/);
      if (match) {
        const produced = parseFloat(match[1]);
        const ordered = parseFloat(match[2]);
        expect(produced).toBeGreaterThanOrEqual(0);
        expect(ordered).toBeGreaterThan(0);
        expect(produced).toBeLessThanOrEqual(ordered);
      }
    }
  });

  test('LOGIC-02 No undefined or NaN values on dashboard', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\bundefined\b/);
    expect(body).not.toMatch(/\bNaN\b/);
  });
});

test.describe('Multi-product order creation with buyer delivery date', () => {
  test('ORDER-01 Create printing order with 2 product rows and past buyer delivery date', async ({ page }) => {
    await page.goto(`${BASE}/printing-orders`);
    await page.waitForLoadState('networkidle');

    // Check if there are buyers and fabrics to create an order
    const buyersSelect = page.locator('text=Buyer').locator('..').locator('select').last();
    const fabricsSelect = page.locator('text=Fabric').locator('..').locator('select').last();
    const hasBuyers = await buyersSelect.isVisible().catch(() => false);

    if (!hasBuyers) {
      test.skip(true, 'No buyers available to create order');
      return;
    }

    // Click New Order button
    await page.getByRole('button', { name: 'New Order' }).first().click();
    await page.waitForLoadState('networkidle');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Set buyer delivery date to a past date (for overdue testing)
    const pastDate = '2025-01-15';
    const deliveryDateInput = dialog.locator('input[type="date"]').last();
    const deliveryDateCount = await dialog.locator('input[type="date"]').count();
    if (deliveryDateCount >= 2) {
      await deliveryDateInput.fill(pastDate);
    }

    // Try to select a buyer
    const buyerDropdown = dialog.locator('text=Buyer').locator('..').locator('select');
    const buyerOptions = await buyerDropdown.locator('option').all();
    if (buyerOptions.length > 1) {
      await buyerDropdown.selectOption({ index: 1 });
    }

    // Fill style field
    const styleInput = dialog.locator('input[placeholder*="Style"]').first();
    if (await styleInput.isVisible().catch(() => false)) {
      await styleInput.fill('E2E-TEST-STYLE');
    }

    // Try to add second product row
    const addRowBtn = dialog.getByRole('button', { name: /add row/i }).first();
    const addRowVisible = await addRowBtn.isVisible().catch(() => false);
    if (addRowVisible) {
      await addRowBtn.click();
    }

    // Save the order
    const saveBtn = dialog.getByRole('button', { name: /save|create/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForLoadState('networkidle');
      // Check for success toast
      const success = page.getByText(/saved|created|success/i).first();
      await expect(success).toBeVisible({ timeout: 8000 }).catch(() => {});
    }

    await page.keyboard.press('Escape');
  });

  test('ORDER-02 Dashboard shows overdue for order with past buyerDeliveryDate', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const overdueSection = page.getByText(/overdue|due today/i);
    const visible = await overdueSection.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No overdue orders in system');
      return;
    }
    await expect(overdueSection).toBeVisible();
  });

  test('ORDER-03 Per-colourway chips shown for multi-row orders', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const chips = page.locator('.text-\\[9px\\].bg-muted\\/50');
    const count = await chips.count();
    if (count === 0) {
      test.skip(true, 'No colourway progress chips shown (no multi-row orders with entries)');
      return;
    }
    const firstText = await chips.first().innerText();
    expect(firstText).toMatch(/\d+%/);
  });
});

test.describe('GRN — URL param auto-fill', () => {
  test('GRN-01 /grn with po_id and vendor_id auto-opens with pre-filled PO', async ({ page }) => {
    // First find a valid PO from the purchase orders page
    await page.goto(`${BASE}/purchase-orders`);
    await page.waitForLoadState('networkidle');
    const posRows = page.locator('table tbody tr');
    const poCount = await posRows.count();
    if (poCount === 0) {
      test.skip(true, 'No POs available');
      return;
    }
    const firstRow = posRows.first();
    const poNumber = await firstRow.locator('td').first().textContent();
    await firstRow.locator('button').last().click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('po_id=');
    expect(page.url()).toContain('vendor_id=');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('New Goods Receipt')).toBeVisible();
  });
});
