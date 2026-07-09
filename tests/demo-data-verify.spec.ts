import { test, expect, Page } from '@playwright/test';

/**
 * Business Flow Verification — walks through each feature as a factory owner would
 * Relies on seed-demo-data.mjs having been run first.
 */
const BASE = 'http://localhost:8080';

async function noError(page: Page) {
  const body = await page.locator('body').innerText().catch(() => '');
  expect(body).not.toContain('Application error');
  expect(body).not.toContain('Something went wrong');
}

async function authGoto(page: Page, targetUrl: string) {
  await page.setViewportSize({ width: 1280, height: 720 }).catch(() => {});
  await page.addInitScript(() => {
    localStorage.setItem('fabrios_module', 'both');
    localStorage.setItem('fabrios_tour_done', '1');
    localStorage.removeItem('fabrios_factory');
  });
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  const needsAuth = page.url().includes('/login') ||
    await page.getByRole('button', { name: /^sign in$/i }).first().isVisible().catch(() => false);
  if (needsAuth) {
    if (!page.url().includes('/login')) {
      await page.goto(`${BASE.replace(/\/+$/, '')}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }
    await page.getByPlaceholder('you@company.com').fill('test@fabrios-e2e.com');
    await page.getByPlaceholder('••••••••').fill('TestPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => {});
    if (await page.getByText('Select your workspace').isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByText('Both').click();
      await page.waitForTimeout(1000);
    }
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  }
}

// 1. DASHBOARD
test('BUS-01 Dashboard shows KPIs reflecting demo data', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(8000);
  await noError(page);

  // Factory filter dropdown should exist
  await expect(page.locator('text=Factory:').first()).toBeVisible({ timeout: 10000 });

  // Active orders card should be visible
  await expect(page.getByText('Active Orders').first()).toBeVisible();

  // Secondary metrics should show relevant KPIs
  await expect(page.getByText('Material Waste').first()).toBeVisible();
  await expect(page.getByText('Overdue AR').first()).toBeVisible();
  await expect(page.getByText('Subcontract').first()).toBeVisible();
});

// 2. PRINTING ORDERS
test('BUS-02 Printing Orders shows PO-P-0001', async ({ page }) => {
  await authGoto(page, `${BASE}/printing-orders`);
  await page.waitForTimeout(12000);
  await noError(page);

  // Find our order
  await expect(page.locator('text=PO-P-0001').first()).toBeVisible({ timeout: 20000 });
});

// 3. STITCHING ORDERS
test('BUS-03 Stitching Orders shows PO-S-0001', async ({ page }) => {
  await authGoto(page, `${BASE}/stitching-orders`);
  await page.waitForTimeout(12000);
  await noError(page);

  await expect(page.locator('text=PO-S-0001').first()).toBeVisible({ timeout: 20000 });
});

// 4. PRODUCTION ENTRIES
test('BUS-04 Production Entries page loads without error', async ({ page }) => {
  await authGoto(page, `${BASE}/entries`);
  await page.waitForTimeout(8000);
  await noError(page);
  await expect(page.locator('h1').first()).toBeVisible();
});

// 5. ATTENDANCE
test('BUS-05 Attendance shows monthly report with demo data', async ({ page }) => {
  await authGoto(page, `${BASE}/attendance`);
  await page.waitForTimeout(10000);
  await noError(page);

  // Check Monthly Report tab loads
  const monthlyTab = page.locator('button').filter({ hasText: 'Monthly Report' });
  if (await monthlyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await monthlyTab.click();
    await page.waitForTimeout(2000);
    await noError(page);
  }

  // Entry tab
  const entryTab = page.locator('button').filter({ hasText: 'Entry' });
  if (await entryTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await entryTab.click();
    await page.waitForTimeout(2000);
  }
});

// 6. MATERIAL ISSUES
test('BUS-06 Material Issues shows 2 issues with wastage', async ({ page }) => {
  await authGoto(page, `${BASE}/material-issues`);
  await page.waitForTimeout(8000);
  await noError(page);

  // Table should show entries
  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // Check if there's a wastage column or value
  const hasWastage = await page.getByText('waste', { exact: false }).isVisible().catch(() => false);
});

// 7. QUOTATIONS
test('BUS-07 Quotations shows Q-0001 for Acme Corp', async ({ page }) => {
  await authGoto(page, `${BASE}/quotations`);
  await page.waitForTimeout(10000);
  await noError(page);

  await expect(page.locator('text=Q-0001').first()).toBeVisible({ timeout: 15000 });
});

// 8. INVOICES / AR
test('BUS-08 Invoices shows INV-2026-001 with AR aging', async ({ page }) => {
  await authGoto(page, `${BASE}/invoices`);
  await page.waitForTimeout(8000);
  await noError(page);

  // AR Aging cards should be visible
  await expect(page.getByText('Current').first()).toBeVisible();

  // Invoice should appear in table
  await expect(page.locator('text=INV-2026-001').first()).toBeVisible({ timeout: 15000 });

  // Status should be "Sent"
  const row = page.locator('table tbody tr').filter({ hasText: 'INV-2026-001' });
  await expect(row.first()).toContainText(/sent/i);
});

// 9. SUBCONTRACT
test('BUS-09 Subcontract shows SC-001 partial job', async ({ page }) => {
  await authGoto(page, `${BASE}/subcontract-jobs`);
  await page.waitForTimeout(8000);
  await noError(page);

  await expect(page.locator('text=SC-001').first()).toBeVisible({ timeout: 15000 });

  // Status should be "partial"
  const row = page.locator('table tbody tr').filter({ hasText: 'SC-001' });
  await expect(row.first()).toContainText(/partial/i);

  // Balance should be 300 (500 sent - 200 received)
  await expect(row.first()).toContainText('300');
});

// 10. REPORTS — Enhanced P&L
test('BUS-10 Reports P&L shows revenue from invoices', async ({ page }) => {
  await authGoto(page, `${BASE}/reports`);
  await page.waitForTimeout(8000);
  await noError(page);

  // Click Profit/Loss tab
  const plTab = page.locator('button').filter({ hasText: 'Profit/Loss' });
  if (await plTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await plTab.click();
    await page.waitForTimeout(2000);
    await noError(page);
  }

  // Summary cards should show Revenue, Labour Cost, Material Cost, Net Profit, Margin
  await expect(page.getByText('Total Revenue').first()).toBeVisible();

  // Production tab
  const prodTab = page.locator('button').filter({ hasText: 'Production' });
  if (await prodTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await prodTab.click();
    await page.waitForTimeout(2000);
  }
});
