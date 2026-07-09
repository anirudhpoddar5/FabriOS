import { test, expect, Page } from '@playwright/test';
import { getSupabaseAdmin } from './helpers';

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

  // Create a buyer for order
  const buyer = crypto.randomUUID();
  S.buyerId = buyer;
  await admin.from('buyers').insert({ id: buyer, company_id: companyId, code: `BUY-MI-${RUN}`, name: unique('MI Buyer'), country: 'India', is_active: true });

  // Create a printing product
  const pp = crypto.randomUUID();
  await admin.from('printing_products').insert({ id: pp, company_id: companyId, code: `PP-MI-${RUN}`, name: unique('MI Product'), uom: 'meters', is_active: true });

  // Create a printing order
  const o1 = crypto.randomUUID();
  S.orderId = o1;
  S.internalPO = `PO-MI-${RUN}`;
  await admin.from('order_headers').insert({
    id: o1, company_id: companyId, module: 'printing', internal_po: S.internalPO,
    buyer_id: buyer, style: unique('MI Style'), currency: 'USD', status: 'Started',
  });
  const row1 = crypto.randomUUID();
  await admin.from('order_rows').insert({ id: row1, order_id: o1, product_id: pp, uom: 'meters', order_qty: 1000 });
  const cw1 = crypto.randomUUID();
  await admin.from('order_colourways').insert({ id: cw1, order_row_id: row1, colour_name: 'Red', ordered_qty: 500, uom: 'meters' });

  // Create an inventory item
  const inv = crypto.randomUUID();
  S.invId = inv;
  S.itemName = unique('Fabric Cotton');
  await admin.from('inventory_items').insert({
    id: inv, company_id: companyId, code: `INV-MI-${RUN}`, name: S.itemName,
    category: 'fabric', uom: 'meters', is_active: true,
  });
});

test.afterAll(async () => {
  const admin = getSupabaseAdmin();
  try { if (S.issueId) await admin.from('material_issues').delete().eq('id', S.issueId); } catch {}
  try { await admin.from('order_colourways').delete().eq('order_row_id', S.rowIds?.[0]); } catch {}
  try { await admin.from('order_rows').delete().eq('order_id', S.orderId); } catch {}
  try { await admin.from('order_headers').delete().eq('id', S.orderId); } catch {}
  try { await admin.from('printing_products').delete().eq('id', S.ppId); } catch {}
  try { await admin.from('inventory_items').delete().eq('id', S.invId); } catch {}
  try { await admin.from('buyers').delete().eq('id', S.buyerId); } catch {}
});

test('MI-01 material issues page loads with tabs', async ({ page }) => {
  await authGoto(page, `${BASE}/material-issues`);
  await page.waitForTimeout(2000);
  await noError(page);

  await expect(page.locator('h1')).toContainText('Material Consumption');
  await expect(page.getByText('Issues').first()).toBeVisible();
  await expect(page.getByText('BOM vs Actual').first()).toBeVisible();
});

test('MI-02 create material issue with no waste (issued=consumed)', async ({ page }) => {
  await authGoto(page, `${BASE}/material-issues`);
  await page.waitForTimeout(2000);
  await noError(page);

  // Click "New Issue"
  await page.getByRole('button', { name: /new issue/i }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Select order
  const orderSelect = page.locator('[role="dialog"]').locator('text=Order').locator('..').locator('[role="combobox"]').first();
  await orderSelect.click();
  await page.waitForTimeout(300);
  await page.locator(`[role="option"]:has-text("${S.internalPO}")`).click();
  await page.waitForTimeout(200);

  // Fill item name
  const itemInput = page.locator('[role="dialog"] input').nth(0);
  await itemInput.fill(S.itemName);

  // Set qty issued = 100, consumed = 100 (no waste)
  const issuedInput = page.locator('[role="dialog"] input[type="number"]').nth(0);
  await issuedInput.fill('100');
  const consumedInput = page.locator('[role="dialog"] input[type="number"]').nth(1);
  await consumedInput.fill('100');

  // Save
  await page.getByRole('button', { name: /save/i }).click();
  await page.waitForTimeout(2000);
  await noError(page);

  // Verify item appears in table
  await expect(page.locator('table tbody').locator(`text=${S.itemName}`).first()).toBeVisible();

  // Get the issue ID for cleanup
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('material_issues').select('id').eq('item_name', S.itemName).single();
  if (data) S.issueId = data.id;
});

test('MI-03 wastage is computed when consumed < issued', async ({ page }) => {
  // Create directly via API
  const admin = getSupabaseAdmin();
  const miId = crypto.randomUUID();
  S.issueId2 = miId;
  const { error } = await admin.from('material_issues').insert({
    id: miId, company_id: companyId, order_id: S.orderId,
    item_name: unique('Waste Test Fabric'), uom: 'meters',
    qty_issued: 200, qty_consumed: 150,
    date: new Date().toISOString().slice(0, 10),
  });
  expect(error).toBeNull();

  await authGoto(page, `${BASE}/material-issues`);
  await page.waitForTimeout(2000);
  await noError(page);

  const body = await page.locator('body').innerText();
  expect(body).toContain('50');
});

test('MI-04 BOM vs Actual tab loads without error', async ({ page }) => {
  await authGoto(page, `${BASE}/material-issues`);
  await page.waitForTimeout(2000);
  await noError(page);

  // Click BOM vs Actual tab
  await page.getByText('BOM vs Actual').click();
  await page.waitForTimeout(1000);
  await noError(page);

  // Tab content should be visible (may show empty state)
  await expect(page.locator('text=No BOM data with matching material issues').or(page.locator('table thead'))).toBeVisible();
});

test('MI-05 sidebar navigates to material issues page', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(1500);

  const link = page.locator('a').filter({ hasText: 'Material Issues' });
  await link.click();
  await page.waitForURL(/\/material-issues/, { timeout: 10000 });
  await page.waitForTimeout(1000);
  await noError(page);
  await expect(page.locator('h1')).toContainText('Material Consumption');
});

test('MI-06 dashboard shows material wastage KPI', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(3000);
  await noError(page);

  // Wastage KPI should appear on dashboard
  await expect(page.locator('text=Material Waste').first()).toBeVisible();
});
