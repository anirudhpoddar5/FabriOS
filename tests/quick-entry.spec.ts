import { test, expect, type Page } from '@playwright/test';
import { getSupabaseAdmin } from './helpers';

const TEST_EMAIL = 'test@fabrios-e2e.com';

function id() {
  return crypto.randomUUID();
}

async function selectOption(page: Page, label: string, optionText: string | RegExp) {
  const parent = page.locator(`div:has(> label:text-is("${label}"))`).first();
  const trigger = parent.locator('[role="combobox"]').first();
  await trigger.click({ force: true });
  const listbox = page.locator('[role="listbox"]').last();
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  const option = page.getByRole('option', { name: optionText }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  const renderedOptions = await page.getByRole('option').allTextContents();
  console.log(`Options for ${label}: ${JSON.stringify(renderedOptions)}`);
  await option.click();
}

async function selectQuickResource(page: Page, optionText: string | RegExp) {
  const trigger = page.getByTestId('quick-resource');
  await expect(trigger).toHaveAttribute('data-resource-count', /^[1-9]\d*$/, { timeout: 10_000 });
  await trigger.click({ force: true });
  const listbox = page.locator('[role="listbox"]').last();
  if (!(await listbox.isVisible({ timeout: 1000 }).catch(() => false))) {
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
  }
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  const option = page.getByRole('option', { name: optionText }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  const renderedOptions = await page.getByRole('option').allTextContents();
  console.log(`Options for Table: ${JSON.stringify(renderedOptions)}`);
  await option.click();
}

async function seedQuickEntryFixture() {
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('email', TEST_EMAIL)
    .single();

  test.skip(!profile?.company_id, `No approved ${TEST_EMAIL} profile with company_id is available`);

  const companyId = profile!.company_id;
  const run = Date.now().toString(36);
  const factoryId = id();
  const shiftId = id();
  const workerTypeId = id();
  const rateId = id();
  const tableId = id();
  const productId = id();
  const orderId = id();
  const rowId = id();
  const colourId = id();

  await admin.from('factories').insert({
    id: factoryId,
    company_id: companyId,
    code: `QE-F-${run}`,
    name: `Quick Factory ${run}`,
    type: 'printing',
  });
  await admin.from('shifts').insert({
    id: shiftId,
    factory_id: factoryId,
    code: `QE-S-${run}`,
    name: `Quick Shift ${run}`,
    start_time: '08:00',
    end_time: '17:00',
  });
  await admin.from('worker_types').insert({
    id: workerTypeId,
    company_id: companyId,
    factory_id: factoryId,
    name: `Quick Operator ${run}`,
    module: 'printing',
  });
  await admin.from('rate_masters').insert({
    id: rateId,
    company_id: companyId,
    factory_id: factoryId,
    shift_id: shiftId,
    worker_type_id: workerTypeId,
    rate_basis: 'per_piece',
    rate_value: 3,
    effective_from: '2026-01-01',
  });
  await admin.from('printing_tables').insert({
    id: tableId,
    factory_id: factoryId,
    code: `QE-T-${run}`,
    name: `Quick Table ${run}`,
  });
  await admin.from('printing_products').insert({
    id: productId,
    company_id: companyId,
    code: `QE-P-${run}`,
    name: `Quick Product ${run}`,
    uom: 'pcs',
  });
  await admin.from('order_headers').insert({
    id: orderId,
    company_id: companyId,
    module: 'printing',
    internal_po: `QE-PO-${run}`,
    style: `QE-STYLE-${run}`,
    currency: 'INR',
    status: 'Started',
  });
  await admin.from('order_rows').insert({
    id: rowId,
    order_id: orderId,
    product_id: productId,
    order_qty: 100,
    chart_qty: 100,
    uom: 'pcs',
  });
  await admin.from('order_colourways').insert({
    id: colourId,
    order_row_id: rowId,
    colour_name: `Quick Red ${run}`,
    ordered_qty: 100,
    uom: 'pcs',
  });

  return {
    admin,
    companyId,
    factoryId,
    shiftId,
    workerTypeId,
    rateId,
    tableId,
    productId,
    orderId,
    rowId,
    colourId,
    factoryName: `Quick Factory ${run}`,
    orderLabel: `QE-PO-${run}`,
    colourLabel: `Quick Red ${run}`,
    shiftLabel: `Quick Shift ${run}`,
    tableLabel: `QE-T-${run}`,
    workerLabel: `Quick Operator ${run}`,
  };
}

test.describe('Bulk Entry Quick Entry', () => {
  test('saves one quick entry on a phone viewport', async ({ page }) => {
    const fixture = await seedQuickEntryFixture();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/entries', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('fabrios:draft:bulk-entry:quick'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('tab', { name: 'Quick Entry' })).toHaveAttribute('data-state', 'active');
    await selectOption(page, 'Factory', fixture.factoryName);
    await page.waitForResponse(response =>
      response.url().includes('/rest/v1/printing_tables') &&
      response.url().includes(`factory_id=eq.${fixture.factoryId}`) &&
      response.status() === 200,
    );
    await selectOption(page, 'Order', new RegExp(fixture.orderLabel));
    await selectOption(page, 'Colour', new RegExp(fixture.colourLabel));
    await selectOption(page, 'Shift', fixture.shiftLabel);
    await selectQuickResource(page, new RegExp(fixture.tableLabel));
    await selectOption(page, 'Worker Type', new RegExp(fixture.workerLabel));
    await page.getByTestId('quick-output').fill('24');

    await page.getByTestId('quick-save').click();
    await expect(page.getByText('Quick entry saved')).toBeVisible({ timeout: 15_000 });

    const { data: entries, error } = await fixture.admin
      .from('production_entries')
      .select('id, output_qty, order_id, colourway_id, factory_id')
      .eq('order_id', fixture.orderId)
      .eq('colourway_id', fixture.colourId);

    expect(error).toBeNull();
    expect(entries).toHaveLength(1);
    expect(entries?.[0]).toMatchObject({
      output_qty: 24,
      order_id: fixture.orderId,
      colourway_id: fixture.colourId,
      factory_id: fixture.factoryId,
    });
  });

  test('keeps failed quick entry input visible', async ({ page }) => {
    const fixture = await seedQuickEntryFixture();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/entries', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('fabrios:draft:bulk-entry:quick'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    await selectOption(page, 'Factory', fixture.factoryName);
    await page.waitForResponse(response =>
      response.url().includes('/rest/v1/printing_tables') &&
      response.url().includes(`factory_id=eq.${fixture.factoryId}`) &&
      response.status() === 200,
    );
    await selectOption(page, 'Order', new RegExp(fixture.orderLabel));
    await selectOption(page, 'Colour', new RegExp(fixture.colourLabel));
    await selectOption(page, 'Shift', fixture.shiftLabel);
    await selectQuickResource(page, new RegExp(fixture.tableLabel));
    await page.getByTestId('quick-output').fill('77');

    await page.getByTestId('quick-save').click();

    await expect(page.getByTestId('quick-entry-error')).toContainText('Quick entry was not saved');
    await expect(page.getByTestId('quick-output')).toHaveValue('77');
    await expect(page.getByTestId('quick-order')).toContainText(fixture.orderLabel);
    await expect(page.getByTestId('quick-colour')).toContainText(fixture.colourLabel);

    const { data: entries } = await fixture.admin
      .from('production_entries')
      .select('id')
      .eq('order_id', fixture.orderId)
      .eq('colourway_id', fixture.colourId);
    expect(entries ?? []).toHaveLength(0);
  });
});
