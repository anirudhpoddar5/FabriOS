import { expect, Locator, Page, test } from '@playwright/test';
import { getSupabaseAdmin, TEST_EMAIL, TEST_PASSWORD } from './helpers';

const RUN_ID = Date.now().toString(36).toUpperCase();
const PREFIX = `AUDIT-FLOW-${RUN_ID}`;
const TODAY = new Date().toISOString().slice(0, 10);

type RuntimeWatch = {
  errors: string[];
  assertClean: () => void;
};

type Scope = Page | Locator;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function watchRuntime(page: Page): RuntimeWatch {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  return {
    errors,
    assertClean: () => {
      const relevant = errors.filter(message =>
        !/favicon|ResizeObserver loop|Download the React DevTools/i.test(message)
      );
      expect(relevant, relevant.join('\n')).toEqual([]);
    },
  };
}

async function gotoApp(page: Page, path: string) {
  await page.addInitScript(() => {
    localStorage.setItem('fabrios_module', 'both');
    localStorage.setItem('fabrios_tour_done', '1');
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);

  const needsLogin = page.url().includes('/login') ||
    await page.getByRole('button', { name: /^sign in$/i }).isVisible({ timeout: 1_500 }).catch(() => false);

  if (needsLogin) {
    await page.getByPlaceholder('you@company.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20_000 });
    await page.evaluate(() => {
      localStorage.setItem('fabrios_module', 'both');
      localStorage.setItem('fabrios_tour_done', '1');
    });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  if (await page.getByText('Select your workspace').isVisible({ timeout: 1_500 }).catch(() => false)) {
    await page.getByText('Both').click();
    await page.waitForTimeout(800);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  }
}

async function assertNoUserFacingErrors(page: Page) {
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Application error');
  expect(body).not.toContain('Something went wrong');
  expect(body).not.toContain('Failed to fetch dynamically imported module');
  expect(body).not.toContain('undefined');
  expect(body).not.toContain('NaN');
}

async function inputByLabel(scope: Scope, labelText: string) {
  const label = scope.locator('label').filter({ hasText: new RegExp(`^${escapeRegExp(labelText)}`, 'i') }).first();
  await label.waitFor({ state: 'visible', timeout: 10_000 });
  return label.locator('..').locator('input, textarea').first();
}

async function fillByLabel(scope: Scope, labelText: string, value: string) {
  const input = await inputByLabel(scope, labelText);
  await input.fill(value);
}

async function selectByLabel(page: Page, scope: Scope, labelText: string, option: string | RegExp) {
  const label = scope.locator('label').filter({ hasText: new RegExp(`^${escapeRegExp(labelText)}`, 'i') }).first();
  await label.waitFor({ state: 'visible', timeout: 10_000 });
  await label.locator('..').locator('[role="combobox"]').first().click({ force: true });
  await page.waitForTimeout(250);
  const locator = typeof option === 'string'
    ? page.getByRole('option', { name: option, exact: true }).first()
    : page.getByRole('option', { name: option }).first();
  await locator.waitFor({ state: 'visible', timeout: 10_000 });
  await locator.click();
}

async function selectFirstByLabel(page: Page, scope: Scope, labelText: string) {
  const label = scope.locator('label').filter({ hasText: new RegExp(`^${escapeRegExp(labelText)}`, 'i') }).first();
  await label.waitFor({ state: 'visible', timeout: 10_000 });
  await label.locator('..').locator('[role="combobox"]').first().click({ force: true });
  await page.waitForTimeout(250);
  const option = page.getByRole('option').filter({ hasNotText: /^(None|No |Loading|Select)/i }).first();
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

async function saveDialog(dialog: Locator, buttonName = /^save$/i) {
  await dialog.getByRole('button', { name: buttonName }).last().click();
  await expect(dialog).not.toBeVisible({ timeout: 20_000 });
}

function rowByText(page: Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text }).first();
}

async function searchAndExpect(page: Page, placeholder: string | RegExp, text: string) {
  await page.getByPlaceholder(placeholder).fill(text);
  await expect(rowByText(page, text)).toBeVisible({ timeout: 12_000 });
}

async function editFirstRowWith(page: Page, text: string) {
  const row = rowByText(page, text);
  await expect(row).toBeVisible({ timeout: 12_000 });
  await row.locator('button').last().click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

async function toggleFirstRowWith(page: Page, text: string, checked: boolean) {
  const row = rowByText(page, text);
  await expect(row).toBeVisible({ timeout: 12_000 });
  await row.locator('[role="switch"]').first().click({ force: true });
  await expect(row.locator('[role="switch"]').first()).toHaveAttribute('aria-checked', String(checked), { timeout: 10_000 });
}

async function bulkDeleteFirstRow(page: Page, text: string, deleteText = /^delete$/i) {
  const row = rowByText(page, text);
  await expect(row).toBeVisible({ timeout: 12_000 });
  page.once('dialog', dialog => dialog.accept());
  await row.locator('input[type="checkbox"]').first().check({ force: true });
  await page.getByRole('button', { name: deleteText }).click();
  await expect(rowByText(page, text)).toHaveCount(0, { timeout: 15_000 });
}

async function getCompanyId() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('company_id')
    .eq('email', TEST_EMAIL)
    .single();
  if (error || !data?.company_id) throw new Error(error?.message || 'SteelM company id not found');
  return data.company_id as string;
}

async function cleanupAuditRows() {
  const admin = getSupabaseAdmin();
  const companyId = await getCompanyId();

  const { data: auditOrders } = await admin
    .from('order_headers')
    .select('id')
    .eq('company_id', companyId)
    .ilike('style', `%${PREFIX}%`);
  const orderIds = (auditOrders || []).map((row: any) => row.id);
  if (orderIds.length > 0) {
    await admin.from('production_entries').delete().in('order_id', orderIds);
    const { data: rows } = await admin.from('order_rows').select('id').in('order_id', orderIds);
    const rowIds = (rows || []).map((row: any) => row.id);
    if (rowIds.length > 0) await admin.from('order_colourways').delete().in('order_row_id', rowIds);
    await admin.from('order_rows').delete().in('order_id', orderIds);
    await admin.from('order_headers').delete().in('id', orderIds);
  }

  const deleteLinesForHeaders = async (headerTable: string, lineTable: string, fk: string, column: string) => {
    const { data } = await admin.from(headerTable).select('id').eq('company_id', companyId).ilike(column, `%${PREFIX}%`);
    const ids = (data || []).map((row: any) => row.id);
    if (ids.length > 0) {
      await admin.from(lineTable).delete().in(fk, ids);
      await admin.from(headerTable).delete().in('id', ids);
    }
  };

  await deleteLinesForHeaders('purchase_orders', 'purchase_order_lines', 'po_id', 'po_number');
  await deleteLinesForHeaders('grn_headers', 'grn_lines', 'grn_id', 'grn_number');
  await admin.from('dispatch_records').delete().eq('company_id', companyId).ilike('challan_number', `%${PREFIX}%`);
  await admin.from('stock_transactions').delete().eq('company_id', companyId).ilike('remarks', `%${PREFIX}%`);
  await admin.from('stock_jobs').delete().eq('company_id', companyId).ilike('job_number', `%${PREFIX}%`);

  const { data: auditWorkers } = await admin.from('worker_types').select('id').eq('company_id', companyId).ilike('name', `%${PREFIX}%`);
  const workerIds = (auditWorkers || []).map((row: any) => row.id);
  if (workerIds.length > 0) await admin.from('rate_masters').delete().in('worker_type_id', workerIds);

  const { data: auditFactories } = await admin.from('factories').select('id').eq('company_id', companyId).ilike('code', `%${RUN_ID}%`);
  const factoryIds = (auditFactories || []).map((row: any) => row.id);
  if (factoryIds.length > 0) {
    await admin.from('rate_masters').delete().in('factory_id', factoryIds);
    await admin.from('printing_tables').delete().in('factory_id', factoryIds);
    await admin.from('stitching_lines').delete().in('factory_id', factoryIds);
    await admin.from('shifts').delete().in('factory_id', factoryIds);
    await admin.from('factories').delete().in('id', factoryIds);
  }

  await admin.from('worker_types').delete().eq('company_id', companyId).ilike('name', `%${PREFIX}%`);
  await admin.from('vendors').delete().eq('company_id', companyId).ilike('code', `%${RUN_ID}%`);
  await admin.from('buyers').delete().eq('company_id', companyId).ilike('code', `%${RUN_ID}%`);
  await admin.from('inventory_items').delete().eq('company_id', companyId).ilike('code', `%${RUN_ID}%`);
  await admin.from('fabrics').delete().eq('company_id', companyId).ilike('name', `%${PREFIX}%`);
  await admin.from('printing_products').delete().eq('company_id', companyId).ilike('code', `%${RUN_ID}%`);
  await admin.from('stitching_products').delete().eq('company_id', companyId).ilike('code', `%${RUN_ID}%`);
}

async function createProductionFixture() {
  const admin = getSupabaseAdmin();
  const companyId = await getCompanyId();
  const stamp = `${PREFIX}-ENTRY`;

  const insertOne = async (table: string, payload: Record<string, any>) => {
    const { data, error } = await admin.from(table).insert(payload).select('*').single();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data as any;
  };

  const buyer = await insertOne('buyers', {
    company_id: companyId, code: `BY-${RUN_ID}`, name: `${stamp} Buyer`, country: 'India', is_active: true,
  });
  const fabric = await insertOne('fabrics', {
    company_id: companyId, name: `${stamp} Cotton`, short_form: `FB-${RUN_ID}`, gsm: 160, width: 58, width_unit: 'inches', is_active: true,
  });
  const product = await insertOne('printing_products', {
    company_id: companyId, code: `PP-${RUN_ID}`, name: `${stamp} Printed Panel`, size: '58in', uom: 'pcs', is_active: true,
  });
  const factory = await insertOne('factories', {
    company_id: companyId, code: `FAC-${RUN_ID}`, name: `${stamp} Factory`, type: 'printing', is_active: true,
  });
  const shift = await insertOne('shifts', {
    factory_id: factory.id, code: `SH-${RUN_ID}`, name: `${stamp} Day Shift`, start_time: '08:00', end_time: '17:00', is_active: true,
  });
  const table = await insertOne('printing_tables', {
    factory_id: factory.id, code: `PT-${RUN_ID}`, name: `${stamp} Table`, size: '12m', supervisor_name: 'Audit Supervisor', is_active: true,
  });
  const worker = await insertOne('worker_types', {
    company_id: companyId, name: `${stamp} Operator`, module: 'printing', is_active: true,
  });
  await insertOne('rate_masters', {
    company_id: companyId, factory_id: factory.id, shift_id: shift.id, worker_type_id: worker.id,
    rate_basis: 'per_piece', rate_value: 5, effective_from: '2026-01-01', effective_to: null, is_active: true,
  });
  const order = await insertOne('order_headers', {
    company_id: companyId, module: 'printing', internal_po: `PO-${RUN_ID}`, buyer_po: `BPO-${RUN_ID}`,
    buyer_id: buyer.id, style: `${stamp} Style`, currency: 'INR', target_end_date: TODAY,
    buyer_delivery_date: TODAY, remarks: stamp, status: 'Started',
  });
  const row = await insertOne('order_rows', {
    order_id: order.id, product_id: product.id, fabric_id: fabric.id, fabric_width: '58',
    order_qty: 60, chart_qty: 60, uom: 'pcs', no_of_colours: 1, rate_per_item: 8, sort_order: 0,
  });
  await insertOne('order_colourways', {
    order_row_id: row.id, colour_name: `${stamp} White`, ordered_qty: 60, uom: 'pcs', size: '', notes: '', sort_order: 0,
  });

  return { factory, shift, table, worker, order };
}

test.describe.serial('SteelM full user lifecycle with real data', () => {
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    await cleanupAuditRows();
  });

  test.afterAll(async () => {
    await cleanupAuditRows();
  });

  test('@full-lifecycle masters create, edit, and deactivate business setup data', async ({ page }) => {
    const runtime = watchRuntime(page);
    const vendorCode = `VND-${RUN_ID}`;
    const buyerCode = `BUY-${RUN_ID}`;
    const fabricName = `${PREFIX} Cotton Twill`;
    const printProductCode = `PRD-P-${RUN_ID}`;
    const stitchProductCode = `PRD-S-${RUN_ID}`;
    const factoryCode = `FAC-${RUN_ID}`;
    const shiftCode = `DAY-${RUN_ID}`;
    const tableCode = `TAB-${RUN_ID}`;
    const lineCode = `LIN-${RUN_ID}`;
    const workerName = `${PREFIX} Quality Checker`;

    await gotoApp(page, '/settings/vendors');
    await page.getByRole('button', { name: /add vendor/i }).click();
    let dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Code', vendorCode);
    await fillByLabel(dialog, 'Name', `${PREFIX} Dye Vendor`);
    await fillByLabel(dialog, 'Contact Person', 'Ravi Mehta');
    await fillByLabel(dialog, 'Phone', '+91 90000 10001');
    await fillByLabel(dialog, 'Email', `vendor-${RUN_ID.toLowerCase()}@example.com`);
    await fillByLabel(dialog, 'Payment Terms', 'Net 30');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search vendors...', vendorCode);
    dialog = await editFirstRowWith(page, vendorCode);
    await fillByLabel(dialog, 'Phone', '+91 90000 10002');
    await saveDialog(dialog);
    await expect(rowByText(page, vendorCode)).toContainText('10002');
    await toggleFirstRowWith(page, vendorCode, false);

    await gotoApp(page, '/settings/buyers');
    await page.getByRole('button', { name: /^add$/i }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Buyer Code', buyerCode);
    await fillByLabel(dialog, 'Buyer Name', `${PREFIX} Export Buyer`);
    await fillByLabel(dialog, 'Contact Person', 'Anita Shah');
    await selectByLabel(page, dialog, 'Country', 'India');
    await fillByLabel(dialog, 'Phone', '+91 90000 20001');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search...', buyerCode);
    dialog = await editFirstRowWith(page, buyerCode);
    await fillByLabel(dialog, 'Buyer Name', `${PREFIX} Export Buyer Edited`);
    await saveDialog(dialog);
    await expect(rowByText(page, buyerCode)).toContainText('Edited');
    await toggleFirstRowWith(page, buyerCode, false);

    await gotoApp(page, '/settings/fabrics');
    await page.getByRole('button', { name: /^add$/i }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Fabric Name', fabricName);
    await fillByLabel(dialog, 'GSM', '180');
    await fillByLabel(dialog, 'Width', '58');
    await fillByLabel(dialog, 'Short Form', `FT-${RUN_ID}`);
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search...', fabricName);
    dialog = await editFirstRowWith(page, fabricName);
    await fillByLabel(dialog, 'GSM', '185');
    await saveDialog(dialog);
    await expect(rowByText(page, fabricName)).toContainText('185');
    await toggleFirstRowWith(page, fabricName, false);

    await gotoApp(page, '/settings/printing-products');
    await page.getByRole('button', { name: /^add$/i }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Product Name', `${PREFIX} Print Panel`);
    await fillByLabel(dialog, 'Size', '58in');
    await fillByLabel(dialog, 'Product Code', printProductCode);
    await selectByLabel(page, dialog, 'UOM', 'Pieces');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search...', printProductCode);
    dialog = await editFirstRowWith(page, printProductCode);
    await fillByLabel(dialog, 'Size', '60in');
    await fillByLabel(dialog, 'Product Code', printProductCode);
    await saveDialog(dialog);
    await expect(rowByText(page, printProductCode)).toContainText('60in');
    await toggleFirstRowWith(page, printProductCode, false);

    await gotoApp(page, '/settings/stitching-products');
    await page.getByRole('button', { name: /^add$/i }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Product Name', `${PREFIX} Cushion Cover`);
    await fillByLabel(dialog, 'Short Form', stitchProductCode);
    await fillByLabel(dialog, 'Size / Specification', '18x18');
    await selectByLabel(page, dialog, 'UOM', 'Pieces');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search...', stitchProductCode);
    dialog = await editFirstRowWith(page, stitchProductCode);
    await fillByLabel(dialog, 'Description', 'Edited lifecycle stitching product');
    await saveDialog(dialog);
    await toggleFirstRowWith(page, stitchProductCode, false);

    await gotoApp(page, '/settings/factories-shifts');
    await page.getByRole('button', { name: /add factory/i }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Factory Code', factoryCode);
    await fillByLabel(dialog, 'Factory Name', `${PREFIX} Mixed Factory`);
    await selectByLabel(page, dialog, 'Type', 'Mixed');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search factories...', factoryCode);
    await rowByText(page, factoryCode).click();
    await page.getByRole('button', { name: /add shift/i }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Shift Code', shiftCode);
    await fillByLabel(dialog, 'Shift Name', `${PREFIX} Day`);
    await fillByLabel(dialog, 'Start Time', '08:30');
    await fillByLabel(dialog, 'End Time', '17:30');
    await saveDialog(dialog);
    await expect(rowByText(page, shiftCode)).toBeVisible();

    await gotoApp(page, '/settings/printing-tables');
    await page.getByRole('button', { name: /^add$/i }).click();
    dialog = page.getByRole('dialog');
    await selectByLabel(page, dialog, 'Factory', `${PREFIX} Mixed Factory`);
    await fillByLabel(dialog, 'Table Code', tableCode);
    await fillByLabel(dialog, 'Table Name', `${PREFIX} Printing Table`);
    await fillByLabel(dialog, 'Size', '12m');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search...', tableCode);
    await toggleFirstRowWith(page, tableCode, false);

    await gotoApp(page, '/settings/stitching-lines');
    await page.getByRole('button', { name: /^add$/i }).click();
    dialog = page.getByRole('dialog');
    await selectByLabel(page, dialog, 'Factory', `${PREFIX} Mixed Factory`);
    await fillByLabel(dialog, 'Line Code', lineCode);
    await fillByLabel(dialog, 'Line Name', `${PREFIX} Stitch Line`);
    await fillByLabel(dialog, 'Machines', '8');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search...', lineCode);
    await toggleFirstRowWith(page, lineCode, false);

    await gotoApp(page, '/settings/workers-rates');
    await page.getByRole('button', { name: 'Add Worker', exact: true }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Name', workerName);
    await selectByLabel(page, dialog, 'Factory', `${PREFIX} Mixed Factory`);
    await selectByLabel(page, dialog, 'Module', 'Both');
    await fillByLabel(dialog, 'Default Rate Value', '325');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search workers...', workerName);
    await expect(rowByText(page, workerName)).toContainText(/1|2|3/);
    await toggleFirstRowWith(page, workerName, false);

    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@full-lifecycle orders are entered, modified, status-updated, and deleted', async ({ page }) => {
    const runtime = watchRuntime(page);

    for (const module of ['printing', 'stitching'] as const) {
      const path = module === 'printing' ? '/printing-orders' : '/stitching-orders';
      const style = `${PREFIX} ${module} order`;
      await gotoApp(page, path);
      await page.getByRole('button', { name: /new order/i }).click();
      let dialog = page.getByRole('dialog');
      const internalPO = await (await inputByLabel(dialog, 'Internal PO')).inputValue();
      await fillByLabel(dialog, 'Buyer PO', `BPO-${module}-${RUN_ID}`);
      await selectFirstByLabel(page, dialog, 'Customer');
      await fillByLabel(dialog, 'Style / Design', style);
      await selectFirstByLabel(page, dialog, 'Product');
      if (module === 'printing') await selectFirstByLabel(page, dialog, 'Fabric');
      await fillByLabel(dialog, 'Order Qty', '96');
      await fillByLabel(dialog, 'Chart Qty', '96');
      await fillByLabel(dialog, 'Rate/Item', '4.75');
      if (module === 'stitching') {
        await dialog.getByRole('button', { name: /^add$/i }).first().click();
      }
      const colourRows = dialog.locator('table tbody tr');
      await expect(colourRows.first()).toBeVisible({ timeout: 10_000 });
      await colourRows.first().locator('input').nth(0).fill(module === 'printing' ? 'Indigo' : 'Natural');
      await colourRows.first().locator('input[type="number"]').first().fill('96');
      await dialog.getByRole('button', { name: /save order/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 20_000 });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await searchAndExpect(page, 'Search orders...', internalPO);
      dialog = await editFirstRowWith(page, internalPO);
      await fillByLabel(dialog, 'Remarks', `${PREFIX} edited remarks`);
      await selectByLabel(page, dialog, 'Status', 'Completed');
      await dialog.getByRole('button', { name: /save order/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 20_000 });
      await searchAndExpect(page, 'Search orders...', internalPO);
      await expect(rowByText(page, internalPO)).toContainText(/Completed|Done|100%/i);
      await bulkDeleteFirstRow(page, internalPO);
    }

    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@full-lifecycle inventory, dispatch, PO, and GRN records save then delete where supported', async ({ page }) => {
    const runtime = watchRuntime(page);
    const itemCode = `INV-${RUN_ID}`;
    const poNumber = `PO-MAT-${RUN_ID}`;
    const grnNumber = `GRN-${RUN_ID}`;
    const challan = `CH-${PREFIX}`;

    await gotoApp(page, '/inventory');
    await page.getByRole('button', { name: /add item/i }).click();
    let dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Code', itemCode);
    await fillByLabel(dialog, 'Name', `${PREFIX} Dyed Fabric Roll`);
    await selectByLabel(page, dialog, 'Category', 'Fabric');
    await fillByLabel(dialog, 'UOM', 'meters');
    await fillByLabel(dialog, 'Opening Stock', '50');
    await fillByLabel(dialog, 'Reorder Level', '20');
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search items...', itemCode);
    dialog = await editFirstRowWith(page, itemCode);
    await fillByLabel(dialog, 'Reorder Level', '25');
    await saveDialog(dialog);
    await expect(rowByText(page, itemCode)).toContainText('25');
    await page.getByRole('button', { name: /inward/i }).click();
    dialog = page.getByRole('dialog');
    await selectByLabel(page, dialog, 'Item', new RegExp(itemCode));
    await fillByLabel(dialog, 'Qty', '40');
    await fillByLabel(dialog, 'Lot', `LOT-${RUN_ID}`);
    await fillByLabel(dialog, 'Remarks', `${PREFIX} stock inward`);
    await saveDialog(dialog);
    await page.getByRole('tab', { name: /transactions/i }).click();
    await expect(page.locator('body')).toContainText(`${PREFIX} stock inward`, { timeout: 12_000 });

    await gotoApp(page, '/dispatch');
    await page.getByRole('button', { name: /new dispatch/i }).click();
    dialog = page.getByRole('dialog');
    await selectByLabel(page, dialog, 'Type', 'From Stock');
    await selectFirstByLabel(page, dialog, 'Buyer');
    await fillByLabel(dialog, 'Product', `${PREFIX} Packed Goods`);
    await fillByLabel(dialog, 'Colour', 'Indigo');
    await fillByLabel(dialog, 'Size', '58in');
    await fillByLabel(dialog, 'Qty', '12');
    await fillByLabel(dialog, 'Vehicle', `VH-${RUN_ID}`);
    await fillByLabel(dialog, 'Challan', challan);
    await fillByLabel(dialog, 'Remarks', `${PREFIX} dispatch`);
    await saveDialog(dialog);
    await searchAndExpect(page, 'Search dispatches...', challan);
    dialog = await editFirstRowWith(page, challan);
    await fillByLabel(dialog, 'Qty', '14');
    await saveDialog(dialog);
    await expect(rowByText(page, challan)).toContainText('14');
    await bulkDeleteFirstRow(page, challan);

    await gotoApp(page, '/purchase-orders');
    await page.getByRole('button', { name: /new po/i }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'PO Number', poNumber);
    await selectFirstByLabel(page, dialog, 'Vendor');
    await fillByLabel(dialog, 'Remarks', `${PREFIX} purchase`);
    const poLine = dialog.locator('tbody tr').first();
    await poLine.locator('input').nth(0).fill(`${PREFIX} Thread Cone`);
    await poLine.locator('input').nth(1).fill('cones');
    await poLine.locator('input[type="number"]').nth(0).fill('20');
    await poLine.locator('input[type="number"]').nth(1).fill('65');
    await dialog.getByRole('button', { name: /create po/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 20_000 });
    await searchAndExpect(page, 'Search POs...', poNumber);

    await gotoApp(page, '/grn');
    await page.getByRole('button', { name: /new grn/i }).click();
    dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'GRN', grnNumber);
    await selectFirstByLabel(page, dialog, 'Vendor');
    await fillByLabel(dialog, 'Remarks', `${PREFIX} receipt`);
    const grnLine = dialog.locator('tbody tr').first();
    await grnLine.locator('[role="combobox"]').first().click({ force: true });
    await page.getByRole('option', { name: new RegExp(itemCode) }).first().click();
    await grnLine.locator('input[type="number"]').first().fill('10');
    await grnLine.locator('input').nth(3).fill(`LOT-${RUN_ID}`);
    await grnLine.locator('input').nth(4).fill(`BATCH-${RUN_ID}`);
    await dialog.getByRole('button', { name: /save grn/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 20_000 });
    await searchAndExpect(page, 'Search GRNs...', grnNumber);
    await bulkDeleteFirstRow(page, grnNumber);

    await gotoApp(page, '/purchase-orders');
    await searchAndExpect(page, 'Search POs...', poNumber);
    await bulkDeleteFirstRow(page, poNumber, /delete/i);

    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@full-lifecycle production entry can be entered, edited, and deleted', async ({ page }) => {
    const runtime = watchRuntime(page);
    const fixture = await createProductionFixture();
    const note = `${PREFIX} production output`;

    await gotoApp(page, '/entries');
    await page.getByRole('tab', { name: /single entry/i }).click();
    await selectByLabel(page, page, 'Module', 'Printing');
    await selectByLabel(page, page, 'Factory', fixture.factory.name);
    await selectByLabel(page, page, 'Order', new RegExp(fixture.order.internal_po));
    await selectByLabel(page, page, 'Colour', new RegExp(`${PREFIX}-ENTRY White`));
    await selectByLabel(page, page, 'Shift', fixture.shift.name);
    await selectByLabel(page, page, 'Table', new RegExp(fixture.table.code));
    await selectByLabel(page, page, 'Worker Type', fixture.worker.name);
    await fillByLabel(page, 'Persons Used', '2');
    await fillByLabel(page, 'Output Qty', '12');
    await fillByLabel(page, 'UOM', 'pcs');
    await fillByLabel(page, 'Notes', note);
    await page.getByRole('button', { name: /save entry/i }).click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText(/Output saved/i, { timeout: 20_000 });

    await page.getByRole('tab', { name: /entry list/i }).click();
    await searchAndExpect(page, 'Search entries...', note);
    let row = rowByText(page, note);
    await row.locator('button').first().click();
    let dialog = page.getByRole('dialog');
    await fillByLabel(dialog, 'Output', '16');
    await fillByLabel(dialog, 'Notes', `${note} edited`);
    await dialog.getByRole('button', { name: /save changes/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    await searchAndExpect(page, 'Search entries...', `${note} edited`);
    row = rowByText(page, `${note} edited`);
    page.once('dialog', dialogBox => dialogBox.accept());
    await row.locator('button').nth(1).click();
    await expect(rowByText(page, `${note} edited`)).toHaveCount(0, { timeout: 15_000 });

    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });
});
