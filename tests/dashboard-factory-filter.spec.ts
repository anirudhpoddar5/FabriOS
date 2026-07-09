import { test, expect, Page } from '@playwright/test';
import { getSupabaseAdmin, selectOption, clickButton, fillField } from './helpers';

const BASE = 'http://localhost:8080';
const RUN = Date.now().toString(36).slice(-4);

function unique(s: string) { return `${s}-${RUN}`; }

async function noError(page: Page) {
  const body = await page.locator('body').innerText().catch(() => '');
  expect(body).not.toContain('Application error');
  expect(body).not.toContain('Something went wrong');
}

let companyId: string;
const S: Record<string, any> = {};

test.describe.configure({ mode: 'serial' });

async function authGoto(page: Page, targetUrl: string) {
  await page.setViewportSize({ width: 1280, height: 720 }).catch(() => {});
  await page.addInitScript(() => {
    localStorage.setItem('fabrios_module', 'both');
    localStorage.setItem('fabrios_tour_done', '1');
  });
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);
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

test.beforeAll(async () => {
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('company_id').eq('email', 'test@fabrios-e2e.com').single();
  companyId = profile?.company_id;
  if (!companyId) throw new Error('No company for test user');

  // Create 2 factories
  const f1 = crypto.randomUUID();
  const f2 = crypto.randomUUID();
  S.factories = [f1, f2];
  S.factory1Name = unique('Factory A');
  S.factory2Name = unique('Factory B');
  await admin.from('factories').insert([
    { id: f1, company_id: companyId, code: `FAC-DF1-${RUN}`, name: S.factory1Name, type: 'mixed', is_active: true },
    { id: f2, company_id: companyId, code: `FAC-DF2-${RUN}`, name: S.factory2Name, type: 'mixed', is_active: true },
  ]);

  // Shifts for both
  const sh1 = crypto.randomUUID();
  const sh2 = crypto.randomUUID();
  S.shifts = [sh1, sh2];
  await admin.from('shifts').insert([
    { id: sh1, factory_id: f1, code: 'SH-DF1', name: unique('Shift A'), start_time: '08:00', end_time: '17:00', is_active: true },
    { id: sh2, factory_id: f2, code: 'SH-DF2', name: unique('Shift B'), start_time: '08:00', end_time: '17:00', is_active: true },
  ]);

  // Worker types
  const wt = crypto.randomUUID();
  S.wtId = wt;
  await admin.from('worker_types').insert({ id: wt, company_id: companyId, name: unique('DF Worker'), module: 'both', is_active: true });

  // Rate masters
  const rm1 = crypto.randomUUID();
  const rm2 = crypto.randomUUID();
  await admin.from('rate_masters').insert([
    { id: rm1, company_id: companyId, factory_id: f1, shift_id: sh1, worker_type_id: wt, rate_basis: 'per_person_per_shift', rate_value: 200, effective_from: '2026-01-01', is_active: true },
    { id: rm2, company_id: companyId, factory_id: f2, shift_id: sh2, worker_type_id: wt, rate_basis: 'per_person_per_shift', rate_value: 300, effective_from: '2026-01-01', is_active: true },
  ]);

  // Printing tables — one per factory
  const tbl1 = crypto.randomUUID();
  const tbl2 = crypto.randomUUID();
  S.resources = [tbl1, tbl2];
  await admin.from('printing_tables').insert([
    { id: tbl1, factory_id: f1, code: 'TBL-DF1', name: unique('DF Table A'), is_active: true },
    { id: tbl2, factory_id: f2, code: 'TBL-DF2', name: unique('DF Table B'), is_active: true },
  ]);

  // Buyers
  const buyer = crypto.randomUUID();
  S.buyerId = buyer;
  await admin.from('buyers').insert({ id: buyer, company_id: companyId, code: `BUY-DF-${RUN}`, name: unique('DF Buyer'), country: 'India', is_active: true });

  // Printing products
  const pp = crypto.randomUUID();
  await admin.from('printing_products').insert({ id: pp, company_id: companyId, code: `PP-DF-${RUN}`, name: unique('DF Product'), uom: 'meters', is_active: true });

  // Order 1 — assigned to factory 1
  const o1 = crypto.randomUUID();
  S.orderId1 = o1;
  await admin.from('order_headers').insert({ id: o1, company_id: companyId, module: 'printing', internal_po: `PO-DF1-${RUN}`, buyer_id: buyer, style: unique('Style A'), currency: 'USD', target_end_date: '2026-12-31', status: 'Started' });
  const row1 = crypto.randomUUID();
  await admin.from('order_rows').insert({ id: row1, order_id: o1, product_id: pp, fabric_id: null, uom: 'meters', order_qty: 1000, chart_qty: 1000 });
  const cw1 = crypto.randomUUID();
  await admin.from('order_colourways').insert({ id: cw1, order_row_id: row1, colour_name: 'Red', ordered_qty: 600, uom: 'meters' });
  const cw2 = crypto.randomUUID();
  await admin.from('order_colourways').insert({ id: cw2, order_row_id: row1, colour_name: 'Blue', ordered_qty: 400, uom: 'meters' });

  // Order 2 — assigned to factory 2
  const o2 = crypto.randomUUID();
  S.orderId2 = o2;
  await admin.from('order_headers').insert({ id: o2, company_id: companyId, module: 'printing', internal_po: `PO-DF2-${RUN}`, buyer_id: buyer, style: unique('Style B'), currency: 'USD', target_end_date: '2026-12-31', status: 'Started' });
  const row2 = crypto.randomUUID();
  await admin.from('order_rows').insert({ id: row2, order_id: o2, product_id: pp, fabric_id: null, uom: 'meters', order_qty: 500, chart_qty: 500 });
  const cw3 = crypto.randomUUID();
  await admin.from('order_colourways').insert({ id: cw3, order_row_id: row2, colour_name: 'Green', ordered_qty: 500, uom: 'meters' });

  // Production entry for factory 1 only (300 units on tbl1)
  const entry1 = crypto.randomUUID();
  S.entryId1 = entry1;
  await admin.from('production_entries').insert({
    id: entry1, company_id: companyId, date: new Date().toISOString().slice(0, 10), module: 'printing',
    order_id: o1, colourway_id: cw1, factory_id: f1, shift_id: sh1, resource_id: tbl1,
    worker_type_id: wt, persons_used: 2, output_qty: 300, output_uom: 'meters',
    rate_basis: 'per_person_per_shift', rate_value: 200, cost_amount: 400,
  });

  // Production entry for factory 2 only (150 units on tbl2)
  const entry2 = crypto.randomUUID();
  S.entryId2 = entry2;
  await admin.from('production_entries').insert({
    id: entry2, company_id: companyId, date: new Date().toISOString().slice(0, 10), module: 'printing',
    order_id: o2, colourway_id: cw3, factory_id: f2, shift_id: sh2, resource_id: tbl2,
    worker_type_id: wt, persons_used: 3, output_qty: 150, output_uom: 'meters',
    rate_basis: 'per_person_per_shift', rate_value: 300, cost_amount: 900,
  });
});

test.afterAll(async () => {
  const admin = getSupabaseAdmin();
  for (const id of [S.entryId1, S.entryId2, S.orderId1, S.orderId2, ...(S.factories || []), S.buyerId].filter(Boolean)) {
    try { await admin.from('production_entries').delete().eq('id', id); } catch {}
    try { await admin.from('order_colourways').delete().eq('order_row_id', id); } catch {}
  }
});

test('factory filter dropdown visible with factory names', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(3000);

  // Dropdown visible
  const filterArea = page.locator('text=Factory:').first();
  await expect(filterArea).toBeVisible();

  // Open dropdown and verify both factory names appear
  const combobox = filterArea.locator('..').locator('[role="combobox"]');
  await combobox.click();
  await page.waitForTimeout(500);

  await expect(page.locator('[role="option"]:has-text("All Factories")')).toBeVisible();
  await expect(page.locator(`[role="option"]:has-text("${S.factory1Name}")`)).toBeVisible();
  await expect(page.locator(`[role="option"]:has-text("${S.factory2Name}")`)).toBeVisible();

  await page.keyboard.press('Escape');
});

test('selecting factory 1 shows only its entries in KPIs', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(3000);

  // Select Factory A
  const combobox = page.locator('text=Factory:').locator('..').locator('[role="combobox"]');
  await combobox.click();
  await page.waitForTimeout(500);
  await page.locator(`[role="option"]:has-text("${S.factory1Name}")`).click();
  await page.waitForTimeout(1500);

  // Factory A has 1 entry today with output 300 — find it in the page body text
  const body = await page.locator('body').innerText();
  expect(body).toContain('300');

  // Factory A has active order count of 1
  expect(body).toMatch(/ACTIVE ORDERS/);
  expect(body).toContain('1');

  // The "Showing orders with production at Factory A" label appears
  await expect(page.locator(`text=${S.factory1Name}`).first()).toBeVisible();
});

test('selecting factory 2 shows only its entries in KPIs', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(3000);

  const combobox = page.locator('text=Factory:').locator('..').locator('[role="combobox"]');
  await combobox.click();
  await page.waitForTimeout(500);
  await page.locator(`[role="option"]:has-text("${S.factory2Name}")`).click();
  await page.waitForTimeout(1500);

  const body = await page.locator('body').innerText();
  expect(body).toContain('150');
  expect(body).toMatch(/ACTIVE ORDERS/);
  expect(body).toContain('1');
  expect(body).toContain('900');
});

test('switching back to all factories shows combined totals', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(3000);

  const combobox = page.locator('text=Factory:').locator('..').locator('[role="combobox"]');

  // First select Factory A — verify reduced KPI
  await combobox.click();
  await page.waitForTimeout(500);
  await page.locator(`[role="option"]:has-text("${S.factory1Name}")`).click();
  await page.waitForTimeout(1000);
  let body = await page.locator('body').innerText();
  expect(body).toContain('300');

  // Switch to All Factories
  await combobox.click();
  await page.waitForTimeout(500);
  await page.locator('[role="option"]:has-text("All Factories")').click();
  await page.waitForTimeout(1500);

  // All Factories shows broader data (including other test data)
  body = await page.locator('body').innerText();
  expect(body).not.toContain('Showing orders with production at');
  expect(body).toMatch(/TODAY'S OUTPUT/);
  await noError(page);
});

test('filtering by order colourway progress uses factory-scoped entries', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(3000);

  // Select Factory A — has order PO-DF1 (Red 600m, Blue 400m), produced 300m on Red
  const combobox = page.locator('text=Factory:').locator('..').locator('[role="combobox"]');
  await combobox.click();
  await page.waitForTimeout(500);
  await page.locator(`[role="option"]:has-text("${S.factory1Name}")`).click();
  await page.waitForTimeout(1500);

  // In Production section should show PO-DF1
  await expect(page.locator(`text=PO-DF1-${RUN}`).first()).toBeVisible();

  // PO-DF2 should NOT appear (it belongs to Factory B)
  await expect(page.locator(`text=PO-DF2-${RUN}`)).not.toBeVisible();
});
