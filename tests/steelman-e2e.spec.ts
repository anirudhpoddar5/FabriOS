import { test, expect, Page } from '@playwright/test';
import { getSupabaseAdmin, selectOption, clickButton, fillField, TEST_EMAIL, TEST_PASSWORD, TEST_COMPANY, TEST_DISPLAY } from './helpers';

const BASE = 'https://fabrios.pages.dev';
const AUTH_FILE = 'test-results/steelman-auth.json';

test.describe.configure({ mode: 'serial' });

const colourNames = ['Red', 'Blue', 'Green', 'Yellow', 'Black', 'White', 'Purple', 'Orange', 'Pink', 'Grey', 'Brown', 'Navy'];

async function goto(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}
async function noError(page: Page) {
  const body = await page.locator('body').innerText().catch(() => '');
  expect(body).not.toContain('Application error');
}

// ─────────────────────────────────────────────────────────────
// TEST 1: Auth — Create user via Admin API, sign in, setup
// ─────────────────────────────────────────────────────────────
test('01 — Auth: create user, sign in, setup wizard, module select', async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = getSupabaseAdmin();

  // Step 1: Create/ensure user via Admin API (confirmed + pre-approved)
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === TEST_EMAIL);
  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log('User exists:', userId);
  } else {
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true,
      user_metadata: { display_name: TEST_DISPLAY },
    });
    if (createErr) throw new Error(`Create user failed: ${createErr.message}`);
    userId = newUser!.user.id;
    console.log('User created:', userId);
    await admin.from('profiles').upsert({
      id: userId, display_name: TEST_DISPLAY, email: TEST_EMAIL,
      approval_status: 'approved', is_active: true,
    }).eq('id', userId);
  }
  await admin.from('profiles').update({ approval_status: 'approved' }).eq('id', userId);
  console.log('✅ User ready');

  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2000);

    const emailInput = page.getByPlaceholder('you@company.com');
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(TEST_EMAIL);
      await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
      await clickButton(page, /sign in/i);
      await page.waitForTimeout(3000);
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2000);

    // Setup Wizard
    const companyInput = page.getByPlaceholder('Acme Textiles');
    if (await companyInput.isVisible({ timeout: 8000 }).catch(() => false)) {
      await companyInput.fill(TEST_COMPANY);
      const nw = page.getByPlaceholder('John Doe');
      if (await nw.isVisible().catch(() => false)) await nw.fill(TEST_DISPLAY);
      await clickButton(page, /continue/i);
      await page.waitForTimeout(3000);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      if (await page.getByRole('button', { name: /go to dashboard/i }).isVisible({ timeout: 8000 }).catch(() => false)) {
        await page.getByRole('button', { name: /go to dashboard/i }).click();
        await page.waitForTimeout(2000);
      }
    }

    // Module Selection
    await page.waitForTimeout(1000);
    if (await page.getByText('Select your workspace').isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByText('Both').first().click();
      await page.waitForTimeout(1000);
    }

    // Dashboard
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2000);
    const dashBody = await page.locator('body').innerText().catch(() => '');
    expect(dashBody).not.toContain('Application error');
    console.log('✅ Dashboard loaded');

    await page.context().storageState({ path: AUTH_FILE });
    console.log('✅ Auth state saved');
  } catch (err) {
    await page.screenshot({ path: 'test-results/auth-failure.png' }).catch(() => {});
    throw err;
  } finally {
    await page.close();
  }
});

// ─────────────────────────────────────────────────────────────
// TEST 2: Master Data
// ─────────────────────────────────────────────────────────────
test('02 — Master data (factories, shifts, workers, rates, buyers, fabrics, products, vendors)', async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await browser.newPage({ storageState: AUTH_FILE });
  const admin = getSupabaseAdmin();

  const { data: profileForMaster } = await admin.from('profiles').select('company_id').eq('email', TEST_EMAIL).single();
  const companyId = profileForMaster?.company_id;
  if (!companyId) throw new Error('No company for test user');

  await goto(page, `${BASE}/settings/factories-shifts`);
  await expect(page.getByRole('heading', { name: /factories/i })).toBeVisible();

  // Factories — UI: 1, API: 2
  await clickButton(page, /add factory/i);
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillField(page, 'Factory Code *', 'FAC-PRI');
  await fillField(page, 'Factory Name *', 'Primary Factory');
  await selectOption(page, 'Type *', 'Mixed');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  const { data: factories } = await admin.from('factories').insert([
    { company_id: companyId, code: 'FAC-STD', name: 'Stitching Unit', type: 'stitching', is_active: true },
    { company_id: companyId, code: 'FAC-PRN', name: 'Printing Unit', type: 'printing', is_active: true },
  ]).select();
  const allFactoryIds = (factories || []).map((f: any) => f.id);
  const { data: priFac } = await admin.from('factories').select('id').eq('code', 'FAC-PRI').single();
  if (priFac) allFactoryIds.unshift(priFac.id);

  // Shifts — UI: 1, API: 3 per factory
  await page.getByText('FAC-PRI').first().click();
  await page.waitForTimeout(300);
  await clickButton(page, /add shift/i);
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillField(page, 'Shift Code *', 'GEN');
  await fillField(page, 'Shift Name *', 'General');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  const shiftData: any[] = [];
  for (const fid of allFactoryIds) {
    for (const s of [
      { code: 'A', name: 'Morning', start: '06:00', end: '14:00' },
      { code: 'B', name: 'Afternoon', start: '14:00', end: '22:00' },
      { code: 'C', name: 'Night', start: '22:00', end: '06:00' },
    ]) {
      shiftData.push({ factory_id: fid, code: s.code, name: s.name, start_time: s.start, end_time: s.end, is_active: true });
    }
  }
  const { data: shifts } = await admin.from('shifts').insert(shiftData).select();
  const shiftIds = (shifts || []).map((s: any) => s.id);

  // Worker Types — UI: 1, API: 6
  await goto(page, `${BASE}/settings/workers-rates`);
  await clickButton(page, 'Add Worker');
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillField(page, 'Name *', 'Printer Operator');
  await selectOption(page, 'Factory (Location)', 'Primary Factory');
  await selectOption(page, 'Module', 'Printing');
  await selectOption(page, 'Rate Basis', 'Per Person/Shift');
  await fillField(page, 'Default Rate Value', '200');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  const { data: wt } = await admin.from('worker_types').insert([
    { company_id: companyId, name: 'Screen Maker', module: 'printing', is_active: true },
    { company_id: companyId, name: 'Color Matcher', module: 'printing', is_active: true },
    { company_id: companyId, name: 'Print Supervisor', module: 'printing', is_active: true },
    { company_id: companyId, name: 'Tailor', module: 'stitching', is_active: true },
    { company_id: companyId, name: 'Stitching Supervisor', module: 'stitching', is_active: true },
    { company_id: companyId, name: 'QC Inspector', module: 'stitching', is_active: true },
  ]).select();
  const wtIds = (wt || []).map((w: any) => w.id);

  // Rate Masters — API: bulk
  const rates: any[] = [];
  for (const wtId of wtIds.slice(0, 4)) {
    for (const shId of shiftIds.slice(0, 2)) {
      rates.push({
        company_id: companyId, factory_id: allFactoryIds[0],
        shift_id: shId, worker_type_id: wtId,
        rate_basis: 'per_person_per_shift', rate_value: 150 + Math.random() * 100,
        effective_from: '2026-01-01', is_active: true,
      });
    }
  }
  await admin.from('rate_masters').insert(rates);
  console.log(`Rate masters: ${rates.length}`);

  // Buyers — UI: 1, API: 7
  await goto(page, `${BASE}/settings/buyers`);
  await clickButton(page, 'Add');
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillField(page, 'Buyer Code *', 'BUY-ALPHA');
  await fillField(page, 'Buyer Name', 'Alpha Garments');
  await selectOption(page, 'Country *', 'India');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  const { data: buyers } = await admin.from('buyers').insert([
    { company_id: companyId, code: 'BUY-BETA', name: 'Beta Exports', country: 'India', is_active: true },
    { company_id: companyId, code: 'BUY-GAMMA', name: 'Gamma Fashion', country: 'Bangladesh', is_active: true },
    { company_id: companyId, code: 'BUY-DELTA', name: 'Delta Tex', country: 'Vietnam', is_active: true },
    { company_id: companyId, code: 'BUY-ZETA', name: 'Zeta Apparel', country: 'China', is_active: true },
    { company_id: companyId, code: 'BUY-OMEGA', name: 'Omega Clothing', country: 'India', is_active: true },
    { company_id: companyId, code: 'BUY-SIGMA', name: 'Sigma Mills', country: 'India', is_active: true },
    { company_id: companyId, code: 'BUY-THETA', name: 'Theta Garments', country: 'Bangladesh', is_active: true },
  ]).select();
  const buyerIds = (buyers || []).map((b: any) => b.id);

  // Fabrics — UI: 1, API: 7
  await goto(page, `${BASE}/settings/fabrics`);
  await clickButton(page, 'Add');
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillField(page, 'Fabric Name *', 'Cotton Canvas');
  await page.waitForTimeout(200);
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  const { data: fabrics } = await admin.from('fabrics').insert([
    { company_id: companyId, name: 'Polyester Silk', short_form: 'POLY', is_active: true },
    { company_id: companyId, name: 'Linen Blend', short_form: 'LINN', is_active: true },
    { company_id: companyId, name: 'Denim', short_form: 'DENM', is_active: true },
    { company_id: companyId, name: 'Jersey Knit', short_form: 'JERS', is_active: true },
    { company_id: companyId, name: 'Georgette', short_form: 'GEOR', is_active: true },
    { company_id: companyId, name: 'Satin', short_form: 'SATN', is_active: true },
    { company_id: companyId, name: 'Chiffon', short_form: 'CHIF', is_active: true },
  ]).select();
  const fabricIds = (fabrics || []).map((f: any) => f.id);

  // Printing Products — UI: 1, API: 5
  await goto(page, `${BASE}/settings/printing-products`);
  await clickButton(page, 'Add');
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillField(page, 'Product Name *', 'Premium Print Fabric');
  await fillField(page, 'Product Code (auto)', 'PPF001');
  await selectOption(page, 'UOM *', 'Meters');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  const { data: printProds } = await admin.from('printing_products').insert([
    { company_id: companyId, code: 'STD001', name: 'Standard Print', uom: 'meters', is_active: true },
    { company_id: companyId, code: 'ECO001', name: 'Eco-Friendly Print', uom: 'meters', is_active: true },
    { company_id: companyId, code: 'DGT001', name: 'Digital Print', uom: 'meters', is_active: true },
    { company_id: companyId, code: 'SCR001', name: 'Screen Print', uom: 'meters', is_active: true },
    { company_id: companyId, code: 'ROT001', name: 'Rotary Print', uom: 'meters', is_active: true },
  ]).select();
  const printProdIds = (printProds || []).map((p: any) => p.id);

  // Stitching Products — UI: 1, API: 5
  await goto(page, `${BASE}/settings/stitching-products`);
  await clickButton(page, 'Add');
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillField(page, 'Product Name *', 'Premium T-Shirt');
  await fillField(page, 'Short Form / Code (auto-suggested)', 'PTS001');
  await selectOption(page, 'UOM *', 'Pieces');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  const { data: stitchProds } = await admin.from('stitching_products').insert([
    { company_id: companyId, code: 'PLP001', name: 'Polo Shirt', uom: 'pieces', is_active: true },
    { company_id: companyId, code: 'FML001', name: 'Formal Shirt', uom: 'pieces', is_active: true },
    { company_id: companyId, code: 'JNS001', name: 'Jeans', uom: 'pieces', is_active: true },
    { company_id: companyId, code: 'JKT001', name: 'Jacket', uom: 'pieces', is_active: true },
    { company_id: companyId, code: 'TRS001', name: 'Trousers', uom: 'pieces', is_active: true },
  ]).select();
  const stitchProdIds = (stitchProds || []).map((p: any) => p.id);

  // Printing Tables — UI: 1, API: 2 per factory
  await goto(page, `${BASE}/settings/printing-tables`);
  await clickButton(page, 'Add');
  await expect(page.getByRole('dialog')).toBeVisible();
  await selectOption(page, 'Factory *', 'Primary Factory');
  await fillField(page, 'Table Code *', 'TBL-A');
  await fillField(page, 'Table Name *', 'Print Table Alpha');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  for (const fid of allFactoryIds.slice(0, 2)) {
    await admin.from('printing_tables').insert([
      { factory_id: fid, code: 'TBL-B', name: 'Print Table Beta', size: '60 inch', is_active: true },
      { factory_id: fid, code: 'TBL-C', name: 'Print Table Gamma', size: '72 inch', is_active: true },
    ]);
  }

  // Stitching Lines — UI: 1, API: 2 per factory
  await goto(page, `${BASE}/settings/stitching-lines`);
  await clickButton(page, 'Add');
  await expect(page.getByRole('dialog')).toBeVisible();
  await selectOption(page, 'Factory *', 'Primary Factory');
  await fillField(page, 'Line Code *', 'LINE-A');
  await fillField(page, 'Line Name *', 'Stitching Line Alpha');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  for (const fid of allFactoryIds.slice(0, 2)) {
    await admin.from('stitching_lines').insert([
      { factory_id: fid, code: 'LINE-B', name: 'Stitching Line Beta', machines: 15, is_active: true },
      { factory_id: fid, code: 'LINE-C', name: 'Stitching Line Gamma', machines: 20, is_active: true },
    ]);
  }

  // Vendors — UI: 1, API: 4
  await goto(page, `${BASE}/settings/vendors`);
  await clickButton(page, /add vendor/i);
  await expect(page.getByRole('dialog')).toBeVisible();
  await fillField(page, 'Code *', 'VND-GLOB');
  await fillField(page, 'Name *', 'Global Textile Supplies');
  await clickButton(page, /save/i);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  const { data: vendors } = await admin.from('vendors').insert([
    { company_id: companyId, code: 'VND-FAB', name: 'Fabric World', is_active: true },
    { company_id: companyId, code: 'VND-CHEM', name: 'Chemical Corp', is_active: true },
    { company_id: companyId, code: 'VND-THREAD', name: 'Thread Masters', is_active: true },
    { company_id: companyId, code: 'VND-PACK', name: 'Packaging Plus', is_active: true },
  ]).select();
  const vendorIds = (vendors || []).map((v: any) => v.id);

  console.log(`✅ Master data: ${allFactoryIds.length} factories, ${shiftIds.length} shifts, ${wtIds.length} worker types, ${buyerIds.length} buyers, ${fabricIds.length} fabrics, ${printProdIds.length + stitchProdIds.length} products, ${vendorIds.length} vendors`);

  await goto(page, `${BASE}/settings/buyers`);
  await page.waitForTimeout(2000);
  await expect(page.locator('table')).toContainText('BUY-ALPHA');
  console.log('✅ Master data verified on UI');
  await page.close();
});

// ─────────────────────────────────────────────────────────────
// TEST 3: Orders (printing + stitching)
// ─────────────────────────────────────────────────────────────
test('03 — Printing & Stitching orders with colourways', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ storageState: AUTH_FILE });
  const admin = getSupabaseAdmin();

  const { data: profileForOrders } = await admin.from('profiles').select('company_id').eq('email', TEST_EMAIL).single();
  const companyId = profileForOrders?.company_id;
  if (!companyId) throw new Error('No company for test user');
  const { data: buyers } = await admin.from('buyers').select('id').eq('company_id', companyId);
  const { data: fabrics } = await admin.from('fabrics').select('id').eq('company_id', companyId);
  const { data: printProds } = await admin.from('printing_products').select('id').eq('company_id', companyId);
  const { data: stitchProds } = await admin.from('stitching_products').select('id').eq('company_id', companyId);
  if (!buyers?.length || !fabrics?.length) throw new Error('Missing ref data');

  // ── UI: 2 printing orders ──
  for (let run = 0; run < 2; run++) {
    await goto(page, `${BASE}/printing-orders`);
    await expect(page.getByRole('heading', { name: /printing orders/i })).toBeVisible();
    await clickButton(page, /new order/i);
    await expect(page.getByRole('dialog')).toBeVisible();

    const style = `STY-UI-${Date.now()}-${run}`;
    await selectOption(page, 'Buyer *', new RegExp(buyers[0].code));
    await fillField(page, 'Style *', style);
    await selectOption(page, 'Fabric *', new RegExp(fabrics[0].name || 'Canvas'));
    await fillField(page, 'Order Qty', '1000');
    await fillField(page, 'Chart Qty', '950');
    await fillField(page, 'Rate/Item', '5.50');

    const cRows = page.locator('[role="dialog"] table tbody tr');
    await cRows.first().locator('input').nth(0).fill('Red');
    await cRows.first().locator('input[type="number"]').first().fill('500');
    await clickButton(page, /add row/i); await page.waitForTimeout(200);
    const r2 = page.locator('[role="dialog"] table tbody tr');
    await r2.nth(1).locator('input').nth(0).fill('Blue');
    await r2.nth(1).locator('input[type="number"]').first().fill('300');
    await clickButton(page, /add row/i); await page.waitForTimeout(200);
    await r2.nth(2).locator('input').nth(0).fill('Green');
    await r2.nth(2).locator('input[type="number"]').first().fill('200');
    await clickButton(page, /save order/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
  }

  // ── API: 15 printing orders ──
  const poHeaders: any[] = []; const poRows: any[] = []; const poCws: any[] = [];
  for (let i = 0; i < 15; i++) {
    const oId = crypto.randomUUID(); const rId = crypto.randomUUID();
    const b = buyers[i % buyers.length]; const f = fabrics[i % fabrics.length];
    const p = printProds?.[i % (printProds.length || 1)];
    const qty = 500 + Math.floor(Math.random() * 2000);
    poHeaders.push({ id: oId, company_id: companyId, module: 'printing', internal_po: `PO-P-${String(201 + i).padStart(4, '0')}`, buyer_id: b.id, style: `STY-BULK-P-${String(i + 1).padStart(3, '0')}`, currency: 'USD', status: 'Started', target_end_date: '2026-07-15' });
    poRows.push({ id: rId, order_id: oId, product_id: p?.id || null, fabric_id: f.id, uom: 'meters', order_qty: qty, chart_qty: qty, rate_per_item: Math.round((3 + Math.random() * 8) * 100) / 100, no_of_colours: 3 });
    for (let c = 0; c < 3; c++) poCws.push({ id: crypto.randomUUID(), order_row_id: rId, colour_name: colourNames[c], ordered_qty: Math.round(qty / 3), uom: 'meters', sort_order: c });
  }
  await admin.from('order_headers').insert(poHeaders);
  await admin.from('order_rows').insert(poRows);
  await admin.from('order_colourways').insert(poCws);
  console.log(`✅ ${poHeaders.length} printing orders + ${poCws.length} colourways`);

  // ── API: 12 stitching orders ──
  const soHeaders: any[] = []; const soRows: any[] = []; const soCws: any[] = [];
  const sizes = ['S', 'M', 'L', 'XL'];
  for (let i = 0; i < 12; i++) {
    const oId = crypto.randomUUID(); const rId = crypto.randomUUID();
    const b = buyers[i % buyers.length]; const p = stitchProds?.[i % (stitchProds.length || 1)];
    const qty = 200 + Math.floor(Math.random() * 1500);
    soHeaders.push({ id: oId, company_id: companyId, module: 'stitching', internal_po: `PO-S-${String(201 + i).padStart(4, '0')}`, buyer_id: b.id, style: `STY-BULK-S-${String(i + 1).padStart(3, '0')}`, currency: 'USD', status: 'Started', target_end_date: '2026-08-01' });
    soRows.push({ id: rId, order_id: oId, product_id: p?.id || null, uom: 'pieces', order_qty: qty, chart_qty: qty, rate_per_item: Math.round((2 + Math.random() * 5) * 100) / 100, no_of_colours: 0 });
    for (let s = 0; s < 3; s++) soCws.push({ id: crypto.randomUUID(), order_row_id: rId, colour_name: 'Standard', size: sizes[s], ordered_qty: Math.round(qty / 3), uom: 'pieces', sort_order: s });
  }
  await admin.from('order_headers').insert(soHeaders);
  await admin.from('order_rows').insert(soRows);
  await admin.from('order_colourways').insert(soCws);
  console.log(`✅ ${soHeaders.length} stitching orders + ${soCws.length} colourways`);

  await goto(page, `${BASE}/printing-orders`);
  await page.waitForTimeout(1000); await noError(page);
  const body = await page.locator('body').innerText();
  expect(body).toContain('STY-UI-');
  console.log('✅ Orders verified on UI');
  await page.close();
});

// ─────────────────────────────────────────────────────────────
// TEST 4: Production data + Inventory + Stock Jobs + BOMs + POs + GRN + Dispatch
// ─────────────────────────────────────────────────────────────
test('04 — Entries, Inventory, Stock Jobs, BOMs, POs, GRN, Dispatch', async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await browser.newPage({ storageState: AUTH_FILE });
  const admin = getSupabaseAdmin();

  const { data: profile } = await admin.from('profiles').select('company_id').eq('email', TEST_EMAIL).single();
  const companyId = profile?.company_id;
  if (!companyId) throw new Error('No company for test user');

  const { data: allOrders } = await admin.from('order_headers').select('id,module,internal_po').eq('company_id', companyId);
  const orderIds = (allOrders || []).map((o: any) => o.id);
  const { data: allRows } = orderIds.length ? await admin.from('order_rows').select('id,order_id').in('order_id', orderIds) : { data: [] };
  const rowIds = (allRows || []).map((r: any) => r.id);
  const { data: allCws } = rowIds.length ? await admin.from('order_colourways').select('id,order_row_id,colour_name').in('order_row_id', rowIds) : { data: [] };
  const { data: factories } = await admin.from('factories').select('id,name').eq('company_id', companyId).limit(5);
  const factoryIds = (factories || []).map((f: any) => f.id);
  const { data: shifts } = factoryIds.length ? await admin.from('shifts').select('id,code').in('factory_id', factoryIds).limit(5) : { data: [] };
  const { data: tables } = factoryIds.length ? await admin.from('printing_tables').select('id,code').in('factory_id', factoryIds).limit(1) : { data: [] };
  const { data: wt } = await admin.from('worker_types').select('id,name').eq('company_id', companyId);
  if (!allOrders?.length || !factories?.length || !shifts?.length || !wt?.length) throw new Error('Missing refs');

  // ── UI: 1 production entry ──
  await goto(page, `${BASE}/entries`);
  await expect(page.getByRole('heading', { name: /entries/i })).toBeVisible();
  const firstOrder = allOrders.find(o => o.module === 'printing');
  if (firstOrder) {
    const row = allRows?.find(r => r.order_id === firstOrder.id);
    const cw = row ? allCws?.find(c => c.order_row_id === row.id) : null;
    if (cw) {
      await selectOption(page, 'Order *', new RegExp(firstOrder.internal_po));
      await page.waitForTimeout(500);
      await selectOption(page, 'Colour *', cw.colour_name);
      await selectOption(page, 'Factory *', factories[0].name);
      await page.waitForTimeout(200);
      await selectOption(page, 'Shift *', shifts[0].code);
      if (tables?.length) await selectOption(page, 'Table *', new RegExp(tables[0].code));
      await selectOption(page, 'Worker Type *', wt[0].name);
      await fillField(page, 'Persons Used', '3');
      await fillField(page, 'Output Qty', '500');
      await fillField(page, 'UOM', 'meters');
      await clickButton(page, /save entry/i);
      await page.waitForTimeout(1500); await noError(page);
    }
  }

  // ── API: 15 entries ──
  const entries: any[] = [];
  for (let i = 0; i < 15; i++) {
    const order = allOrders[i % allOrders.length];
    const row = allRows?.find(r => r.order_id === order.id);
    const cw = row ? allCws?.find(c => c.order_row_id === row.id) : null;
    if (!row || !cw) continue;
    const qty = 100 + Math.floor(Math.random() * 900);
    const p = 1 + Math.floor(Math.random() * 5);
    entries.push({ company_id: companyId, date: '2026-06-20', module: order.module, order_id: order.id, colourway_id: cw.id, factory_id: factories[i % factories.length].id, shift_id: shifts[i % shifts.length].id, resource_id: tables?.length ? tables[0].id : null, worker_type_id: wt[i % wt.length].id, persons_used: p, output_qty: qty, output_uom: 'meters', rate_basis: 'per_person_per_shift', rate_value: 150, cost_amount: p * 150 });
  }
  for (let i = 0; i < entries.length; i += 5) await admin.from('production_entries').insert(entries.slice(i, i + 5));
  console.log(`✅ ${entries.length} entries`);

  // ── INVENTORY ──
  const invItems = [
    ['INV-FAB-001', 'Cotton Fabric Roll', 'fabric', 'meters', 100, 5000],
    ['INV-FAB-002', 'Polyester Fabric Roll', 'fabric', 'meters', 100, 3000],
    ['INV-INK-001', 'Screen Ink - Red', 'ink', 'kg', 10, 50],
    ['INV-INK-002', 'Screen Ink - Blue', 'ink', 'kg', 10, 45],
    ['INV-INK-003', 'Screen Ink - Black', 'ink', 'kg', 10, 60],
    ['INV-CHEM-001', 'Fixer Chemical', 'chemical', 'liter', 20, 100],
    ['INV-THR-001', 'Thread - White', 'trim', 'spool', 50, 200],
    ['INV-THR-002', 'Thread - Black', 'trim', 'spool', 50, 180],
    ['INV-PACK-001', 'Poly Bags - Small', 'packaging', 'pcs', 500, 2000],
    ['INV-PACK-002', 'Carton Boxes', 'packaging', 'pcs', 100, 500],
    ['INV-LAB-001', 'Care Labels', 'trim', 'pcs', 1000, 5000],
    ['INV-ELAS-001', 'Elastic Band 1"', 'trim', 'meters', 200, 1000],
  ].map(([code, name, cat, uom, reorder, stock]) => ({ company_id: companyId, code, name, category: cat, uom, reorder_level: reorder, opening_stock: stock, is_active: true }));
  const { data: invSeeded } = await admin.from('inventory_items').insert(invItems).select();
  const invIds = (invSeeded || []).map((i: any) => i.id);
  console.log(`✅ ${invIds.length} inventory items`);

  // ── STOCK JOBS ──
  const jobNames = ['Premium T-Shirt', 'Canvas Bag', 'Table Runner', 'Cushion Cover', 'Apron', 'Tote Bag', 'Face Mask', 'Scarf'];
  const jobs = jobNames.map((name, i) => {
    const target = 200 + Math.floor(Math.random() * 1800);
    return { company_id: companyId, job_number: `SJ-${String(101 + i).padStart(4, '0')}`, product_name: name, module: i < 4 ? 'printing' : 'stitching', target_qty: target, produced_qty: Math.floor(target * Math.random()), uom: i < 4 ? 'meters' : 'pieces', status: ['planned', 'in_progress', 'completed'][i % 3], start_date: '2026-06-01', remarks: `Stock run ${i + 1}` };
  });
  await admin.from('stock_jobs').insert(jobs);
  console.log(`✅ ${jobs.length} stock jobs`);

  // ── BOMs ──
  if (allOrders?.length) {
    const boms: any[] = []; const bomsLines: any[] = [];
    for (let i = 0; i < 6; i++) {
      const bId = crypto.randomUUID(); const o = allOrders[i % allOrders.length];
      boms.push({ id: bId, company_id: companyId, title: `BOM-${String(101 + i).padStart(4, '0')}`, bom_type: 'order', order_id: o.id, status: 'confirmed' });
      const qty = 300 + Math.floor(Math.random() * 2000);
      bomsLines.push({ bom_id: bId, category: 'fabric', item_name: 'Cotton Fabric', quantity: qty, uom: 'meters', avg_consumption: 1.1, extra_pct: 5, rate: 3.5, total_amount: Math.round(qty * 1.1 * 1.05 * 3.5 * 100) / 100, sort_order: 0 });
      bomsLines.push({ bom_id: bId, category: 'trim', item_name: 'Thread', quantity: qty, uom: 'spool', avg_consumption: 0.05, extra_pct: 10, rate: 0.5, total_amount: Math.round(qty * 0.05 * 1.1 * 0.5 * 100) / 100, sort_order: 1 });
      bomsLines.push({ bom_id: bId, category: 'accessory', item_name: 'Labels', quantity: qty, uom: 'pcs', avg_consumption: 1, extra_pct: 0, rate: 0.1, total_amount: Math.round(qty * 0.1 * 100) / 100, sort_order: 2 });
    }
    await admin.from('bom_headers').insert(boms);
    await admin.from('bom_lines').insert(bomsLines);
    console.log(`✅ ${boms.length} BOMs, ${bomsLines.length} BOM lines`);
  }

  // ── PURCHASE ORDERS + GRN ──
  const { data: vendors } = await admin.from('vendors').select('id').eq('company_id', companyId);
  if (vendors?.length) {
    const poHeaders: any[] = []; const poLines: any[] = [];
    for (let i = 0; i < 5; i++) {
      const poId = crypto.randomUUID(); const v = vendors[i % vendors.length];
      poHeaders.push({ id: poId, company_id: companyId, po_number: `PO-BUY-${String(101 + i).padStart(4, '0')}`, vendor_id: v.id, po_date: '2026-06-15', status: 'draft', currency: 'USD', total_amount: 15000 + i * 5000, source_type: 'manual' });
      poLines.push({ po_id: poId, item_name: 'Cotton Fabric', uom: 'meters', qty_ordered: 2000, rate: 3.5, amount: 7000 });
      poLines.push({ po_id: poId, item_name: 'Thread Spools', uom: 'spool', qty_ordered: 500, rate: 0.5, amount: 250 });
    }
    await admin.from('purchase_orders').insert(poHeaders);
    await admin.from('purchase_order_lines').insert(poLines);
    console.log(`✅ ${poHeaders.length} purchase orders`);

    // GRN
    const { data: poIds } = await admin.from('purchase_orders').select('id').eq('company_id', companyId);
    if (poIds?.length && invIds.length) {
      const grns: any[] = []; const grnLines: any[] = [];
      for (let i = 0; i < 4; i++) {
        const gId = crypto.randomUUID();
        grns.push({ id: gId, company_id: companyId, grn_number: `GRN-${String(101 + i).padStart(4, '0')}`, vendor_id: vendors[i % vendors.length].id, grn_date: '2026-06-18', status: 'completed' });
        grnLines.push({ grn_id: gId, item_id: invIds[i % invIds.length], qty_received: 500 });
        grnLines.push({ grn_id: gId, item_id: invIds[(i + 1) % invIds.length], qty_received: 200 });
      }
      await admin.from('grn_headers').insert(grns);
      await admin.from('grn_lines').insert(grnLines);
      console.log(`✅ ${grns.length} GRNs`);
    }
  }

  // ── DISPATCH ──
  const { data: buyers } = await admin.from('buyers').select('id').eq('company_id', companyId);
  if (allOrders?.length && buyers?.length) {
    const dispatches: any[] = [];
    for (let i = 0; i < 5; i++) {
      dispatches.push({ company_id: companyId, dispatch_date: '2026-06-19', order_id: allOrders[i % allOrders.length].id, buyer_id: buyers[i % buyers.length].id, qty: 100 + Math.floor(Math.random() * 900), product_name: 'Printed Fabric', size: '60 inch', colour: colourNames[i % colourNames.length], challan_number: `CH-${String(201 + i).padStart(4, '0')}`, vehicle_number: `HR-26-${String(1000 + i)}`, dispatch_type: 'against_order', uom: 'meters' });
    }
    await admin.from('dispatch_records').insert(dispatches);
    console.log(`✅ ${dispatches.length} dispatch records`);
  }

  await goto(page, `${BASE}/entries`); await noError(page);
  console.log('✅ Entries page verified');
  await page.close();
});

// ─────────────────────────────────────────────────────────────
// TEST 5: Page-by-page verification
// ─────────────────────────────────────────────────────────────
test('05 — Verify every page renders without errors', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ storageState: AUTH_FILE });

  const pages = [
    `${BASE}/`, `${BASE}/printing-orders`, `${BASE}/stitching-orders`,
    `${BASE}/entries`, `${BASE}/bom`, `${BASE}/purchase-orders`,
    `${BASE}/grn`, `${BASE}/dispatch`, `${BASE}/stock-jobs`,
    `${BASE}/inventory`, `${BASE}/production-control`, `${BASE}/reports`,
    `${BASE}/settings/factories-shifts`, `${BASE}/settings/workers-rates`,
    `${BASE}/settings/buyers`, `${BASE}/settings/fabrics`,
    `${BASE}/settings/printing-products`, `${BASE}/settings/stitching-products`,
    `${BASE}/settings/printing-tables`, `${BASE}/settings/stitching-lines`,
    `${BASE}/settings/vendors`, `${BASE}/settings/companies`,
  ];

  const results: { page: string; status: string }[] = [];
  for (const url of pages) {
    const name = url.replace(BASE, '') || '/';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText().catch(() => '');
    const hasError = /Application error|Cannot read/i.test(body);
    results.push({ page: name, status: hasError ? '❌ ERROR' : '✅ OK' });
    console.log(`  ${hasError ? '❌' : '✅'}  ${name}`);
  }

  const failed = results.filter(r => r.status.includes('❌'));
  if (failed.length) console.log(`\n⚠️  ${failed.length} page(s) had errors`);
  console.log(`\n✅ ${results.filter(r => r.status.includes('✅')).length}/${results.length} pages OK`);

  await page.close();
});
