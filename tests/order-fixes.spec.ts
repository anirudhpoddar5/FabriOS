import { test, expect } from '@playwright/test';
import { getSupabaseAdmin } from './supabase-admin';

/**
 * Covers the order-list fixes: line-item summary columns, safe delete, the status
 * control, and factory grouping on master lists.
 *
 * Seeds its own throwaway orders and removes them again, so it never depends on —
 * or damages — data that is already in the demo company.
 */

const admin = getSupabaseAdmin();
const TAG = `ZZTEST-${Date.now()}`;

let companyId: string;
let orderWithEntry: string;   // must refuse to delete
let orderNoEntry: string;     // must delete cleanly
const cleanup: { table: string; id: string }[] = [];

async function seedOrder(internalPo: string, qty: number, rate: number) {
  const { data: fabric } = await admin.from('fabrics').select('id, name').eq('company_id', companyId).eq('is_active', true).limit(1).single();
  const { data: product } = await admin.from('printing_products').select('id, name').eq('company_id', companyId).eq('is_active', true).limit(1).single();

  const { data: header, error: hErr } = await admin.from('order_headers').insert({
    company_id: companyId, module: 'printing', internal_po: internalPo,
    style: TAG, status: 'Started', currency: 'INR',
    buyer_delivery_date: '2026-12-15', target_end_date: '2026-12-10',
  }).select('id').single();
  if (hErr) throw new Error(`seed header: ${hErr.message}`);
  cleanup.unshift({ table: 'order_headers', id: header.id });

  const { data: row, error: rErr } = await admin.from('order_rows').insert({
    order_id: header.id, product_id: product?.id ?? null, fabric_id: fabric?.id ?? null,
    uom: 'meters', order_qty: qty, chart_qty: 0, rate_per_item: rate, no_of_colours: 1, sort_order: 0,
  }).select('id').single();
  if (rErr) throw new Error(`seed row: ${rErr.message}`);

  const { data: cw, error: cErr } = await admin.from('order_colourways').insert({
    order_row_id: row.id, colour_name: 'TestBlue', ordered_qty: qty, uom: 'meters', sort_order: 0,
  }).select('id').single();
  if (cErr) throw new Error(`seed colourway: ${cErr.message}`);

  return { orderId: header.id, rowId: row.id, colourwayId: cw.id, fabric: fabric?.name, product: product?.name };
}

test.beforeAll(async () => {
  const { data: company } = await admin.from('companies').select('id').eq('name', 'SteelM Industries').limit(1).single();
  if (!company) throw new Error('demo company not found');
  companyId = company.id;

  const a = await seedOrder(`${TAG}-A`, 500, 12);
  const b = await seedOrder(`${TAG}-B`, 300, 8);
  orderWithEntry = a.orderId;
  orderNoEntry = b.orderId;

  // Clone an existing production entry onto order A so it has real production logged
  // against it — that is what must make the delete refuse.
  const { data: sample } = await admin.from('production_entries').select('*').eq('company_id', companyId).limit(1).single();
  if (!sample) throw new Error('no existing production entry to clone from');
  const { id, created_at, updated_at, ...shape } = sample as any;
  const { error: eErr } = await admin.from('production_entries').insert({
    ...shape, order_id: a.orderId, order_row_id: a.rowId, colourway_id: a.colourwayId, output_qty: 5,
  });
  if (eErr) throw new Error(`seed entry: ${eErr.message}`);
});

test.afterAll(async () => {
  // production_entries first — they are what blocks the order delete
  await admin.from('production_entries').delete().in('order_id', [orderWithEntry, orderNoEntry].filter(Boolean));
  for (const { table, id } of cleanup) await admin.from(table).delete().eq('id', id);
});

async function openPrintingOrders(page: any) {
  await page.goto('/printing-orders');
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/\/login/);
  await page.getByPlaceholder('Search orders...').fill(TAG);
  await page.waitForTimeout(800);
}

test('order list fills in Product, Fabric and Qty from the order rows', async ({ page }) => {
  await openPrintingOrders(page);
  const row = page.locator('tr', { hasText: `${TAG}-A` }).first();
  await expect(row).toBeVisible();
  // the three columns that were blank before the fix
  await expect(row).toContainText('500');
  await expect(row).toContainText('meters');
  const cells = await row.locator('td').allInnerTexts();
  const [product, fabric] = [cells[4], cells[5]];
  expect(product.trim(), 'Product column must not be blank').not.toBe('');
  expect(product.trim()).not.toBe('—');
  expect(fabric.trim(), 'Fabric column must not be blank').not.toBe('');
  expect(fabric.trim()).not.toBe('—');
});

test('month sub-total and page total report real qty and value, not zero', async ({ page }) => {
  await page.goto('/printing-orders');
  await page.waitForLoadState('networkidle');
  const totals = page.locator('tr', { hasText: /Sub-total|Page Total/ });
  const count = await totals.count();
  if (count === 0) test.skip(true, 'only one month group on this data set');
  const text = await totals.first().innerText();
  const numbers = (text.match(/\d+/g) || []).map(Number);
  expect(Math.max(...numbers, 0), `totals row still reads zero: "${text}"`).toBeGreaterThan(0);
});

test('deleting an order that has production entries is refused, in plain English, and nothing is lost', async ({ page }) => {
  await openPrintingOrders(page);
  page.on('dialog', d => d.accept());

  const row = page.locator('tr', { hasText: `${TAG}-A` }).first();
  await row.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: /Delete/i }).click();

  const toast = page.locator('[data-sonner-toast]');
  await expect(toast).toContainText(/production entries/i, { timeout: 10_000 });
  await expect(toast).not.toContainText(/foreign key|constraint|violates/i);

  // the order, its row and its colourway must all still be there
  const { data: stillThere } = await admin.from('order_headers').select('id').eq('id', orderWithEntry).maybeSingle();
  expect(stillThere, 'order was deleted despite having production entries').not.toBeNull();
  const { count: rowCount } = await admin.from('order_rows').select('id', { count: 'exact', head: true }).eq('order_id', orderWithEntry);
  expect(rowCount, 'order rows were destroyed by a blocked delete').toBe(1);
});

test('deleting an order with no production entries still works', async ({ page }) => {
  await openPrintingOrders(page);
  page.on('dialog', d => d.accept());

  const row = page.locator('tr', { hasText: `${TAG}-B` }).first();
  await row.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: /Delete/i }).click();
  await expect(page.locator('[data-sonner-toast]')).toContainText(/deleted/i, { timeout: 10_000 });

  const { data: gone } = await admin.from('order_headers').select('id').eq('id', orderNoEntry).maybeSingle();
  expect(gone, 'order should have been deleted').toBeNull();
});

test('order detail page can set the status directly', async ({ page }) => {
  await page.goto(`/printing-orders/${orderWithEntry}`);
  await page.waitForLoadState('networkidle');

  const trigger = page.locator('[role="combobox"]').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole('option', { name: 'Completed' }).click();
  await expect(page.locator('[data-sonner-toast]')).toContainText(/Completed/i, { timeout: 10_000 });

  const { data: updated } = await admin.from('order_headers').select('status').eq('id', orderWithEntry).single();
  expect(updated?.status).toBe('Completed');
});

test('printing tables are grouped by factory instead of interleaved', async ({ page }) => {
  await page.goto('/settings/printing-tables');
  await page.waitForLoadState('networkidle');

  const { data: factories } = await admin.from('factories').select('name').eq('company_id', companyId).eq('is_active', true);
  const names = (factories || []).map(f => f.name);
  if (names.length < 2) test.skip(true, 'needs at least two factories to prove grouping');

  // guard first: with no rows the contiguity check below is vacuously true, so an
  // unauthenticated or broken page would "pass" without verifying anything
  await expect(page.getByRole('heading', { name: /Printing Tables/i })).toBeVisible();
  const dataRows = page.locator('tbody tr');
  await expect(dataRows.first()).toBeVisible();
  expect(await dataRows.count(), 'no rows rendered — nothing was verified').toBeGreaterThan(1);

  // every row's factory cell, in render order — each factory must appear as one contiguous block
  const factoryCells = await page.locator('tbody tr td:first-child').allInnerTexts();
  const seen: string[] = [];
  for (const cell of factoryCells.map(c => c.trim()).filter(Boolean)) {
    if (seen[seen.length - 1] !== cell) seen.push(cell);
  }
  const duplicated = seen.filter((v, i) => seen.indexOf(v) !== i);
  expect(duplicated, `factories are still interleaved: ${seen.join(' | ')}`).toHaveLength(0);
});
