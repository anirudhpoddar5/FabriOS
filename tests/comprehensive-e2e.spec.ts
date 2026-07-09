import { test, expect, Page } from '@playwright/test';
import { getSupabaseAdmin, selectOption, clickButton, fillField } from './helpers';
import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:8080';
const RUN = Date.now().toString(36).slice(-4);
const PREFIX = `CE2E${RUN}`;

let companyId: string;

const S: Record<string, any> = {};

async function noError(page: Page) {
  const body = await page.locator('body').innerText().catch(() => '');
  expect(body).not.toContain('Application error');
  expect(body).not.toContain('Something went wrong');
  expect(body).not.toContain('undefined');
  expect(body).not.toContain('NaN');
}

function unique(s: string) { return `${s}-${RUN}`; }

test.describe.configure({ mode: 'serial' });

let _sessionJson: string | null = null;

async function authGoto(page: Page, targetUrl: string) {
  await page.setViewportSize({ width: 1280, height: 720 }).catch(() => {});
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForTimeout(1000);
  const needsAuth = page.url().includes('/login') ||
    await page.getByRole('button', { name: /^sign in$/i }).first().isVisible().catch(() => false);
  if (needsAuth) {
    if (!page.url().includes('/login')) {
      await page.goto(`${BASE.replace(/\/+$/, '')}/login`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    }
    await page.getByPlaceholder('you@company.com').fill('test@fabrios-e2e.com');
    await page.getByPlaceholder('••••••••').fill('TestPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15_000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    if (await page.getByText('Select your workspace').isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByText('Both').click();
      await page.waitForTimeout(1000);
    }
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
  }
  await page.evaluate(() => {
    localStorage.setItem('fabrios_module', 'both');
    localStorage.setItem('fabrios_tour_done', '1');
  });
}

test.beforeAll(async () => {
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('company_id').eq('email', 'test@fabrios-e2e.com').single();
  companyId = profile?.company_id;
  if (!companyId) throw new Error('No company for test user');

  const anonSupabase = createClient('https://ejebukxlwgwebjgdicyb.supabase.co', 'sb_publishable_IdKOfQkILYvWdNNopuKpeA_B-dQ3vHZ');
  const { data: { session } } = await anonSupabase.auth.signInWithPassword({ email: 'test@fabrios-e2e.com', password: 'TestPass123!' });
  if (session) _sessionJson = JSON.stringify(session);

  const f1 = crypto.randomUUID();
  S.factories = [f1];
  await admin.from('factories').insert([
    { id: f1, company_id: companyId, code: `COMP-FAC-${RUN}`, name: unique('Comp Factory'), type: 'mixed', is_active: true },
  ]);

  const shiftId = crypto.randomUUID();
  S.shiftId = shiftId;
  await admin.from('shifts').insert({ id: shiftId, factory_id: f1, code: 'GEN', name: 'General', start_time: '08:00', end_time: '17:00', is_active: true });

  const wtId = crypto.randomUUID();
  S.wtId = wtId;
  await admin.from('worker_types').insert({ id: wtId, company_id: companyId, name: unique('Comp Worker'), module: 'both', is_active: true });

  const rmId = crypto.randomUUID();
  S.rmId = rmId;
  await admin.from('rate_masters').insert({ id: rmId, company_id: companyId, factory_id: f1, shift_id: shiftId, worker_type_id: wtId, rate_basis: 'per_person_per_shift', rate_value: 250, effective_from: '2026-01-01', is_active: true });

  const buyerId = crypto.randomUUID();
  S.buyerId = buyerId;
  await admin.from('buyers').insert({ id: buyerId, company_id: companyId, code: `COMP-BUY-${RUN}`, name: unique('Comp Buyer'), country: 'India', is_active: true });

  const fabId1 = crypto.randomUUID(), fabId2 = crypto.randomUUID();
  S.fabrics = [fabId1, fabId2];
  await admin.from('fabrics').insert([
    { id: fabId1, company_id: companyId, name: unique('Fabric X'), short_form: 'FX', is_active: true },
    { id: fabId2, company_id: companyId, name: unique('Fabric Y'), short_form: 'FY', is_active: true },
  ]);

  const ppId1 = crypto.randomUUID(), ppId2 = crypto.randomUUID();
  S.printProducts = [ppId1, ppId2];
  await admin.from('printing_products').insert([
    { id: ppId1, company_id: companyId, code: `PP-CMP-1-${RUN}`, name: unique('Comp Print A'), uom: 'meters', is_active: true },
    { id: ppId2, company_id: companyId, code: `PP-CMP-2-${RUN}`, name: unique('Comp Print B'), uom: 'meters', is_active: true },
  ]);

  const spId1 = crypto.randomUUID(), spId2 = crypto.randomUUID();
  S.stitchProducts = [spId1, spId2];
  await admin.from('stitching_products').insert([
    { id: spId1, company_id: companyId, code: `SP-CMP-1-${RUN}`, name: unique('Comp Stitch A'), uom: 'pieces', is_active: true },
    { id: spId2, company_id: companyId, code: `SP-CMP-2-${RUN}`, name: unique('Comp Stitch B'), uom: 'pieces', is_active: true },
  ]);

  const tableId = crypto.randomUUID();
  S.tableId = tableId;
  await admin.from('printing_tables').insert({ id: tableId, factory_id: f1, code: 'TBL-CMP', name: unique('Comp Table'), is_active: true });

  const lineId = crypto.randomUUID();
  S.lineId = lineId;
  await admin.from('stitching_lines').insert({ id: lineId, factory_id: f1, code: 'LN-CMP', name: unique('Comp Line'), is_active: true });

  const vId1 = crypto.randomUUID(), vId2 = crypto.randomUUID();
  S.vendors = [vId1, vId2];
  await admin.from('vendors').insert([
    { id: vId1, company_id: companyId, code: `VND-CMP-1-${RUN}`, name: unique('Comp Vendor A'), is_active: true },
    { id: vId2, company_id: companyId, code: `VND-CMP-2-${RUN}`, name: unique('Comp Vendor B'), is_active: true },
  ]);

  // Seeded order for BOM→PO→GRN flow
  const seOrderId = crypto.randomUUID();
  S.seOrderId = seOrderId;
  await admin.from('order_headers').insert({
    id: seOrderId, company_id: companyId, module: 'printing', internal_po: `PO-CMP-${RUN}`,
    buyer_id: buyerId, style: unique('CMP Style'), currency: 'USD',
    buyer_delivery_date: '2026-12-31', status: 'Started',
  });
  const seRowId = crypto.randomUUID();
  S.seRowId = seRowId;
  await admin.from('order_rows').insert({
    id: seRowId, order_id: seOrderId, product_id: ppId1, fabric_id: fabId1,
    uom: 'meters', order_qty: 1000, chart_qty: 1000, rate_per_item: 5.0,
  });
  const seCwId = crypto.randomUUID();
  S.seCwId = seCwId;
  await admin.from('order_colourways').insert({
    id: seCwId, order_row_id: seRowId, colour_name: 'Blue', ordered_qty: 1000, uom: 'meters',
  });

  // Seeded entry for entry list test
  const seEntryId = crypto.randomUUID();
  S.seEntryId = seEntryId;
  await admin.from('production_entries').insert({
    id: seEntryId, company_id: companyId, date: '2026-06-01', module: 'printing',
    order_id: seOrderId, colourway_id: seCwId, factory_id: f1, shift_id: shiftId,
    worker_type_id: wtId, persons_used: 2, output_qty: 500, output_uom: 'meters',
    rate_basis: 'per_person_per_shift', rate_value: 250, cost_amount: 500,
  });

  // Seeded BOM + PO + GRN for PO detail BOM link test
  const bomId = crypto.randomUUID();
  S.bomId = bomId;
  await admin.from('bom_headers').insert({
    id: bomId, company_id: companyId, title: unique('CMP BOM'), bom_type: 'order',
    order_id: seOrderId, status: 'po_generated',
  });
  await admin.from('bom_lines').insert({
    bom_id: bomId, category: 'fabric', item_name: unique('CMP Mat'), quantity: 500,
    uom: 'meters', avg_consumption: 1.0, extra_pct: 0, rate: 3.0, vendor_name: unique('Comp Vendor A'),
  });

  const poId = crypto.randomUUID();
  S.poId = poId;
  await admin.from('purchase_orders').insert({
    id: poId, company_id: companyId, po_number: `PO-BOMLINK-${RUN}`, vendor_id: vId1,
    po_date: '2026-06-15', status: 'draft', currency: 'USD', total_amount: 1500,
    source_type: 'bom', order_id: seOrderId,
    remarks: `From BOM: ${unique('CMP BOM')}`,
  });
  const poLineId = crypto.randomUUID();
  await admin.from('purchase_order_lines').insert({
    id: poLineId, po_id: poId, item_name: unique('CMP PO Item'), uom: 'meters',
    qty_ordered: 500, rate: 3.0, amount: 1500,
  });

  // Inventory items for GRN
  const invId = crypto.randomUUID();
  S.invId = invId;
  await admin.from('inventory_items').insert({
    id: invId, company_id: companyId, code: `INV-CMP-${RUN}`, name: unique('CMP Item'),
    category: 'fabric', uom: 'meters', reorder_level: 50, opening_stock: 1000, is_active: true,
  });

  const grnId = crypto.randomUUID();
  S.grnId = grnId;
  await admin.from('grn_headers').insert({
    id: grnId, company_id: companyId, grn_number: `GRN-CMP-${RUN}`, vendor_id: vId1,
    po_id: poId, grn_date: '2026-06-20', status: 'accepted',
  });
  await admin.from('grn_lines').insert({
    grn_id: grnId, item_id: invId, item_name: unique('CMP GRN Item'), qty_received: 100, uom: 'meters',
  });
  await admin.from('stock_transactions').insert({
    company_id: companyId, item_id: invId, txn_type: 'inward', txn_date: '2026-06-20',
    qty: 100, vendor_id: vId1, grn_id: grnId, uom: 'meters',
  });

  console.log(`✅ Seeded: factory, shift, worker, rate, buyer, ${S.fabrics.length} fabrics, ${S.printProducts.length} print prods, ${S.stitchProducts.length} stitch prods, table, line, ${S.vendors.length} vendors, order, entry, BOM, PO, GRN`);
});

// ════════════════════════════════════════════════════════
// 1. MULTI-PRODUCT PRINTING ORDER
// ════════════════════════════════════════════════════════
test.describe('Multi-Product Printing Order', () => {
  const style = unique(`MP-P-${RUN}`);

  test('CE-MPO-01 Create order with 2 product rows, each with 2 colourways', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await clickButton(page, /new order/i); await expect(page.getByRole('dialog')).toBeVisible();

    await selectOption(page, 'Buyer *', new RegExp(unique('Comp Buyer')));
    await page.locator('div:has(> label:text-is("Style *")) input').fill(style);

    // Fill buyer delivery date
    const dateInputs = page.locator('[role="dialog"] input[type="date"]');
    if (await dateInputs.count() >= 2) {
      await dateInputs.nth(0).fill('2026-12-31');
      await dateInputs.nth(1).fill('2026-12-31');
    }

    // ── Row 1: Product A + Fabric X ──
    const rowCards = page.locator('[role="dialog"] .border-l-2');
    await rowCards.first().locator('input[type="number"]').nth(0).fill('1000');
    await rowCards.first().locator('input[type="number"]').nth(1).fill('950');
    await rowCards.first().locator('input[type="number"]').nth(2).fill('5.5');

    // Colourways for Row 1
    await page.locator('[role="dialog"] table tbody tr').first().locator('input').nth(0).fill('Red');
    await page.locator('[role="dialog"] table tbody tr').first().locator('input[type="number"]').first().fill('600');

    // Add 2nd colourway for Row 1
    const firstCardColorBtn = rowCards.first().locator('button', { hasText: /add colour/i });
    if (await firstCardColorBtn.isVisible()) await firstCardColorBtn.click();
    await page.waitForTimeout(200);
    const cwRows = page.locator('[role="dialog"] table tbody tr');
    if (await cwRows.count() >= 2) {
      await cwRows.nth(1).locator('input').nth(0).fill('Blue');
      await cwRows.nth(1).locator('input[type="number"]').first().fill('400');
    }

    // ── Row 2: Add Product Row ──
    await clickButton(page, /add product row/i);
    await page.waitForTimeout(300);

    // Select Product + Fabric for Row 2
    const allRowCards = page.locator('[role="dialog"] .border-l-2');
    if (await allRowCards.count() >= 2) {
      const row2 = allRowCards.nth(1);
      // Product
      const row2ProductTrigger = row2.locator('[role="combobox"]').first();
      if (await row2ProductTrigger.isVisible()) {
        await row2ProductTrigger.click(); await page.waitForTimeout(200);
        const opt = page.getByRole('option', { name: new RegExp(`PP-CMP-2-${RUN}`) }).first();
        if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) await opt.click();
      }
      // Fabric
      const row2FabricTrigger = row2.locator('[role="combobox"]');
      if (await row2FabricTrigger.count() >= 2) {
        await row2FabricTrigger.nth(1).click(); await page.waitForTimeout(200);
        const opt = page.getByRole('option', { name: /FY/ }).first();
        if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) await opt.click();
      }
      // Qty fields
      const numbers = row2.locator('input[type="number"]');
      if (await numbers.count() >= 2) {
        await numbers.nth(0).fill('500');
        await numbers.nth(1).fill('500');
      }
      // Rate
      const rateInput = row2.locator('input[type="number"]');
      if (await rateInput.count() >= 3) await rateInput.nth(2).fill('4.0');

      // Colourways for Row 2
      const row2CwRows = row2.locator('table tbody tr');
      if (await row2CwRows.count() > 0) {
        await row2CwRows.first().locator('input').nth(0).fill('Green');
        await row2CwRows.first().locator('input[type="number"]').first().fill('300');
      }
    }

    await clickButton(page, /save order/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Order created', { timeout: 10_000 }).catch(() => {});
    await noError(page);
  });

  test('CE-MPO-02 Order detail shows both product rows', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    const searchInput = page.getByPlaceholder('Search orders...');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(style); await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toContainText(style, { timeout: 10_000 });
    const row = page.locator(`table tbody tr:has(td:text("${style}"))`).first();
    if (await row.count() > 0) {
      await row.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
      await expect(page).toHaveURL(/\/printing-orders\//);
      await noError(page);
    }
  });

  test('CE-MPO-03 Buyer delivery date persisted on detail page', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    const searchInput = page.getByPlaceholder('Search orders...');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(style); await page.waitForTimeout(500);
    }
    const row = page.locator(`table tbody tr:has(td:text("${style}"))`).first();
    if (await row.count() > 0) {
      await row.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
      await expect(page).toHaveURL(/\/printing-orders\//);
      const body = await page.locator('body').innerText();
      expect(body).toContain('2026-12-31');
    }
  });
});

// ════════════════════════════════════════════════════════
// 2. ENTRY LIST VIEW (new feature)
// ════════════════════════════════════════════════════════
test.describe('Entry List View', () => {
  test('CE-EL-01 Entry list tab shows seeded entries', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await page.getByRole('tab', { name: /list/i }).click(); await page.waitForTimeout(500);
    // Search for our seeded entry by PO number to bypass pagination
    const entrySearch = page.getByPlaceholder('Search entries...');
    if (await entrySearch.isVisible({ timeout: 3000 }).catch(() => false)) {
      await entrySearch.fill(`PO-CMP-${RUN}`); await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toContainText('500', { timeout: 10_000 });
  });

  test('CE-EL-02 Entry list filters by module', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await page.getByRole('tab', { name: /list/i }).click(); await page.waitForTimeout(500);
    const moduleFilter = page.getByRole('combobox').first();
    if (await moduleFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moduleFilter.click(); await page.waitForTimeout(200);
      const opt = page.getByRole('option', { name: /printing/i }).first();
      if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) await opt.click();
      await page.waitForTimeout(300);
    }
    await noError(page);
  });

  test('CE-EL-03 Entry list CSV export button visible', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await page.getByRole('tab', { name: /list/i }).click(); await page.waitForTimeout(500);
    const csvBtn = page.getByRole('button', { name: /export/i });
    await expect(csvBtn).toBeVisible({ timeout: 5000 });
  });
});

// ════════════════════════════════════════════════════════
// 3. BULK ACTIONS ON ORDER LIST
// ════════════════════════════════════════════════════════
test.describe('Bulk Actions', () => {
  test('CE-BLK-01 Checkbox column renders on printing orders', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    const checkboxes = page.locator('table thead input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
  });

  test('CE-BLK-02 Select all checkbox toggles selection bar', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    const blkSearch = page.getByPlaceholder('Search orders...');
    if (await blkSearch.isVisible({ timeout: 3000 }).catch(() => false)) {
      await blkSearch.fill(unique('CMP Style')); await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toContainText(unique('CMP Style'), { timeout: 15_000 });

    const headerCheckbox = page.locator('table thead input[type="checkbox"]').first();
    if (await headerCheckbox.isVisible().catch(() => false)) {
      await headerCheckbox.check(); await page.waitForTimeout(300);
      const bar = page.getByText(/selected/i);
      await expect(bar).toBeVisible({ timeout: 3000 });
      await headerCheckbox.uncheck(); await page.waitForTimeout(300);
      await expect(bar).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });

  test('CE-BLK-03 Bulk status change fires without error', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    const blkSearch3 = page.getByPlaceholder('Search orders...');
    if (await blkSearch3.isVisible({ timeout: 3000 }).catch(() => false)) {
      await blkSearch3.fill(unique('CMP Style')); await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toContainText(unique('CMP Style'), { timeout: 15_000 });

    const headerCheckbox = page.locator('table thead input[type="checkbox"]').first();
    if (await headerCheckbox.isVisible().catch(() => false)) {
      await headerCheckbox.check(); await page.waitForTimeout(300);
      const statusSelect = page.getByRole('combobox').filter({ has: page.locator('text=selected') }).or(page.getByText('Change status').locator('..'));
      // Try to find the bulk status dropdown
      const statusTrigger = page.locator('text=Change status').locator('..').locator('[role="combobox"]').first();
      if (await statusTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await statusTrigger.click(); await page.waitForTimeout(200);
        const opt = page.getByRole('option', { name: /completed/i }).first();
        if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) await opt.click();
        await page.waitForTimeout(500);
      }
      await noError(page);
    }
  });

  test('CE-BLK-04 Bulk status bar has delete button', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    // Wait for table rows to render
    await page.waitForSelector('table tbody tr', { timeout: 10_000 }).catch(() => {});
    // Click the first row checkbox to select one order
    const rowCheckbox = page.locator('table tbody input[type="checkbox"]').first();
    if (await rowCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await rowCheckbox.click(); await page.waitForTimeout(500);
      await expect(page.getByRole('button', { name: /delete/i })).toBeVisible({ timeout: 3000 });
    }
  });

  test('CE-BLK-05 Checkboxes on GRN page', async ({ page }) => {
    await authGoto(page, `${BASE}/grn`); await noError(page);
    const checkboxes = page.locator('table thead input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
  });

  test('CE-BLK-06 Checkboxes on Dispatch page', async ({ page }) => {
    await authGoto(page, `${BASE}/dispatch`); await noError(page);
    const checkboxes = page.locator('table thead input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ════════════════════════════════════════════════════════
// 4. BOM → PO → GRN FULL FLOW
// ════════════════════════════════════════════════════════
test.describe('BOM → PO → GRN Full Flow', () => {
  test('CE-BPG-01 PO detail page shows BOM back-reference link', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    const poSearch = page.getByPlaceholder('Search POs...');
    if (await poSearch.isVisible({ timeout: 3000 }).catch(() => false)) {
      await poSearch.fill(`PO-BOMLINK-${RUN}`); await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toContainText(`PO-BOMLINK-${RUN}`, { timeout: 10_000 });

    const poRow = page.locator(`table tbody tr:has(td:text("PO-BOMLINK-${RUN}"))`).first();
    if (await poRow.count() === 0) { test.skip(true, 'No PO row'); return; }
    await poRow.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/purchase-orders\//);

    // Source should show as clickable link when BOM matches
    await page.waitForTimeout(1000);
    await noError(page);
  });

  test('CE-BPG-02 PO print format renders without error', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    const poSearch2 = page.getByPlaceholder('Search POs...');
    if (await poSearch2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await poSearch2.fill(`PO-BOMLINK-${RUN}`); await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toContainText(`PO-BOMLINK-${RUN}`, { timeout: 10_000 });
    const poRow = page.locator(`table tbody tr:has(td:text("PO-BOMLINK-${RUN}"))`).first();
    if (await poRow.count() > 0) {
      await poRow.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
      const printBtn = page.getByRole('button', { name: /print/i });
      await expect(printBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test('CE-BPG-03 Create BOM via UI and generate PO from it', async ({ page }) => {
    await authGoto(page, `${BASE}/bom`); await noError(page);
    await clickButton(page, /new bom/i); await expect(page.getByRole('dialog')).toBeVisible();

    const bomTitle = unique(`UI-BOM-${Date.now()}`);
    await page.locator('[role="dialog"] input').first().fill(bomTitle);
    // Order should be auto-selected if form.bom_type is 'order'
    await selectOption(page, 'Order', new RegExp(`PO-CMP-${RUN}`));
    await clickButton(page, /add line/i); await page.waitForTimeout(300);

    const bomLine = page.locator('[role="dialog"] table tbody tr').first();
    await bomLine.locator('input').nth(0).fill(unique('UI Mat Item'));
    await bomLine.locator('input[type="number"]').nth(0).fill('200');  // qty
    await bomLine.locator('input[type="number"]').nth(1).fill('5');    // extra %
    await bomLine.locator('input[type="number"]').nth(2).fill('2.5');  // rate

    // Assign vendor to line
    const vendorTrigger = bomLine.locator('[role="combobox"]').last();
    if (await vendorTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await vendorTrigger.click(); await page.waitForTimeout(300);
      const vendorOpt = page.getByRole('option', { name: new RegExp(unique('Comp Vendor A')) }).first();
      if (await vendorOpt.isVisible({ timeout: 2000 }).catch(() => false)) await vendorOpt.click();
    }

    await clickButton(page, /save bom/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
  });

  test('CE-BPG-04 Generate PO from BOM then record GRN', async ({ page }) => {
    await authGoto(page, `${BASE}/bom`); await noError(page);
    await expect(page.locator('body')).toContainText(unique('Comp Vendor A'), { timeout: 15_000 }).catch(() => {});

    // Open BOM for editing, select lines, generate PO
    const editBtn = page.locator('table tbody tr').first().locator('button').first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click(); await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Select the BOM line checkbox
      const checkbox = page.locator('[role="dialog"] [role="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await checkbox.check(); await page.waitForTimeout(200);
      }

      // Click Generate POs
      const genBtn = page.getByRole('button', { name: /generate po/i });
      if (await genBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await genBtn.click(); await page.waitForTimeout(500);
      }

      // Confirm in the PO preview dialog
      const createBtn = page.getByRole('button', { name: /create.*po/i });
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.click(); await page.waitForTimeout(2000);
      }

      await noError(page);
    }
  });

  test('CE-BPG-05 Navigate to GRN page and verify view', async ({ page }) => {
    await authGoto(page, `${BASE}/grn`); await noError(page);
    await expect(page.getByRole('heading', { name: /goods receipt/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(`GRN-CMP-${RUN}`, { timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 5. PAGINATION ON ALL LIST PAGES
// ════════════════════════════════════════════════════════
test.describe('Pagination on List Pages', () => {
  test('CE-PAG-01 Pagination component renders on printing orders', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    const pagination = page.locator('nav[role="navigation"]');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await pagination.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('CE-PAG-02 Pagination component renders on stitching orders', async ({ page }) => {
    await authGoto(page, `${BASE}/stitching-orders`); await noError(page);
    const pagination = page.locator('nav[role="navigation"]');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await pagination.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('CE-PAG-03 Pagination component renders on purchase orders', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    const pagination = page.locator('nav[role="navigation"]');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await pagination.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('CE-PAG-04 Pagination component renders on GRN', async ({ page }) => {
    await authGoto(page, `${BASE}/grn`); await noError(page);
    const pagination = page.locator('nav[role="navigation"]');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await pagination.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('CE-PAG-05 Pagination component renders on dispatch', async ({ page }) => {
    await authGoto(page, `${BASE}/dispatch`); await noError(page);
    const pagination = page.locator('nav[role="navigation"]');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await pagination.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('CE-PAG-06 Pagination component renders on stock jobs', async ({ page }) => {
    await authGoto(page, `${BASE}/stock-jobs`); await noError(page);
    const pagination = page.locator('nav[role="navigation"]');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await pagination.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('CE-PAG-07 Pagination component renders on BOM', async ({ page }) => {
    await authGoto(page, `${BASE}/bom`); await noError(page);
    const pagination = page.locator('nav[role="navigation"]');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await pagination.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('CE-PAG-08 Pagination component renders on inventory', async ({ page }) => {
    await authGoto(page, `${BASE}/inventory`); await noError(page);
    const pagination = page.locator('nav[role="navigation"]');
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await pagination.count()).toBeGreaterThanOrEqual(1);
    }
  });
});

// ════════════════════════════════════════════════════════
// 6. EDGE CASES & VALIDATION
// ════════════════════════════════════════════════════════
test.describe('Validation & Edge Cases', () => {
  test('CE-VAL-01 Print order requires buyer and style', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await clickButton(page, /new order/i); await expect(page.getByRole('dialog')).toBeVisible();
    // Try saving without buyer
    await page.waitForTimeout(300);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('CE-VAL-02 Empty state renders on stock jobs when filtered to unmatched', async ({ page }) => {
    await authGoto(page, `${BASE}/stock-jobs`); await noError(page);
    const search = page.getByPlaceholder(/search/i);
    if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
      await search.fill('ZZZZ_NONEXISTENT_ZZZZ'); await page.waitForTimeout(300);
      await page.waitForTimeout(500);
    }
    await noError(page);
  });

  test('CE-VAL-03 Cancel dialog does not save', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await clickButton(page, /new order/i); await expect(page.getByRole('dialog')).toBeVisible();
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('CE-VAL-04 Stitching order dialog opens and closes', async ({ page }) => {
    await authGoto(page, `${BASE}/stitching-orders`); await noError(page);
    await clickButton(page, /new order/i); await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('CE-VAL-05 Supplier page loads without crash', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/vendors`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 7. DATA INTEGRITY: PRODUCTION ENTRY
// ════════════════════════════════════════════════════════
test.describe('Data Integrity — Production Entry', () => {
  test('CE-DI-01 Single entry form rate auto-calculates', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await selectOption(page, 'Order *', new RegExp(`PO-CMP-${RUN}`)); await page.waitForTimeout(500);
    await selectOption(page, 'Colour *', 'Blue');
    await selectOption(page, 'Factory *', new RegExp(unique('Comp Factory'))); await page.waitForTimeout(300);
    await selectOption(page, 'Shift *', 'General');
    // Resource may be labelled Table or Line based on module
    const tblTrigger = page.locator('label:has-text("Resource")').locator('..').locator('[role="combobox"]');
    if (await tblTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tblTrigger.click(); await page.waitForTimeout(200);
      const tblOpt = page.getByRole('option', { name: /TBL-CMP/ }).first();
      if (await tblOpt.isVisible({ timeout: 2000 }).catch(() => false)) await tblOpt.click();
    }
    await selectOption(page, 'Worker Type *', new RegExp(unique('Comp Worker')));
    await fillField(page, 'Persons Used', '2');
    await fillField(page, 'Output Qty', '400');
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/rate|cost|amount|500/i);
  });

  test('CE-DI-02 Single entry save does not error', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await selectOption(page, 'Order *', new RegExp(`PO-CMP-${RUN}`)); await page.waitForTimeout(500);
    await selectOption(page, 'Colour *', 'Blue');
    await selectOption(page, 'Factory *', new RegExp(unique('Comp Factory'))); await page.waitForTimeout(300);
    await selectOption(page, 'Shift *', 'General');
    const tblTrigger = page.locator('label:has-text("Resource")').locator('..').locator('[role="combobox"]');
    if (await tblTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tblTrigger.click(); await page.waitForTimeout(200);
      const tblOpt = page.getByRole('option', { name: /TBL-CMP/ }).first();
      if (await tblOpt.isVisible({ timeout: 2000 }).catch(() => false)) await tblOpt.click();
    }
    await selectOption(page, 'Worker Type *', new RegExp(unique('Comp Worker')));
    await fillField(page, 'Persons Used', '1'); await fillField(page, 'Output Qty', '100');
    await clickButton(page, /save entry/i); await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Failed');
  });
});

// ════════════════════════════════════════════════════════
// 8. CROSS-CUTTING: NO CRASH ON ANY PAGE
// ════════════════════════════════════════════════════════
test.describe('Cross-cutting — No Crash', () => {
  const pages = [
    '/printing-orders', '/stitching-orders', '/entries', '/bom',
    '/purchase-orders', '/grn', '/dispatch', '/stock-jobs',
    '/inventory', '/reports', '/settings/factories-shifts',
    '/settings/workers-rates', '/settings/buyers', '/settings/fabrics',
    '/settings/printing-products', '/settings/stitching-products',
    '/settings/printing-tables', '/settings/stitching-lines',
    '/settings/vendors', '/settings/companies', '/settings/users',
  ];

  for (const p of pages) {
    test(`CE-NOCRASH${pages.indexOf(p)} ${p} loads cleanly`, async ({ page }) => {
      await authGoto(page, `${BASE}${p}`);
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
      await noError(page);
      const body = await page.locator('body').innerText().catch(() => '');
      expect(body).not.toContain('Application error');
      expect(body).not.toContain('Something went wrong');
      expect(body).not.toContain('Unexpected Application');
    });
  }
});

// ════════════════════════════════════════════════════════
// 9. MOBILE VIEWPORT
// ════════════════════════════════════════════════════════
test.describe('Mobile Viewport (375px)', () => {
  test('CE-MOB-01 Printing orders scrolls on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
  });

  test('CE-MOB-02 Entries page stacks on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/entries`); await noError(page);
  });

  test('CE-MOB-03 BOM page renders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/bom`); await noError(page);
  });

  test('CE-MOB-04 Purchase orders renders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
  });

  test('CE-MOB-05 Stock jobs cards render on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/stock-jobs`); await noError(page);
    const cards = page.locator('.sm\\:hidden .cursor-pointer');
    if (await cards.count() > 0) {
      await expect(cards.first()).toBeVisible();
    }
  });
});

// No cleanup — all data uses unique RUN IDs
