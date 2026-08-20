import { test, expect } from '@playwright/test';
import { getSupabaseAdmin } from './supabase-admin';

/**
 * The Office Grid's Persons and Output cells are ~70px wide. The shared Input
 * component adds px-3 (24px of horizontal padding), which left ~13px of usable
 * text width — less than one digit — so typed numbers were clipped out of sight.
 * The value did register (the Totals row showed it), but the box looked empty,
 * which reads as "I can't type in this field".
 *
 * Guards the visible result, not the CSS: type a number, then assert it is
 * actually legible in the box.
 */

const admin = getSupabaseAdmin();
let companyId = '', orderId = '';

test.beforeAll(async () => {
  const { data: c } = await admin.from('companies').select('id').eq('name', 'FabriOS Test Co').single();
  if (!c) throw new Error('test company missing — run: npm run seed:test');
  companyId = c.id;
  const { data: fab } = await admin.from('fabrics').select('id').eq('company_id', companyId).limit(1).single();
  const { data: prod } = await admin.from('printing_products').select('id').eq('company_id', companyId).limit(1).single();
  const { data: h } = await admin.from('order_headers').insert({
    company_id: companyId, module: 'printing', internal_po: 'GRIDTEST-0001', style: 'GRIDTEST',
    status: 'Started', currency: 'INR', buyer_delivery_date: '2026-12-01', target_end_date: '2026-12-01',
  }).select('id').single();
  orderId = h!.id;
  const { data: r } = await admin.from('order_rows').insert({
    order_id: orderId, product_id: prod!.id, fabric_id: fab!.id, uom: 'meters',
    order_qty: 500, chart_qty: 0, rate_per_item: 10, no_of_colours: 1, sort_order: 0,
  }).select('id').single();
  await admin.from('order_colourways').insert({
    order_row_id: r!.id, colour_name: 'Ochre', ordered_qty: 500, uom: 'meters', sort_order: 0,
  });
});

test.afterAll(async () => {
  const { data: rows } = await admin.from('order_rows').select('id').eq('order_id', orderId);
  if (rows?.length) await admin.from('order_colourways').delete().in('order_row_id', rows.map(r => r.id));
  await admin.from('order_rows').delete().eq('order_id', orderId);
  await admin.from('order_headers').delete().eq('id', orderId);
});

/** Width actually available for text: client box minus its own horizontal padding. */
async function legibility(page: any, index: number) {
  return page.evaluate((i: number) => {
    const el = document.querySelectorAll('input[type=number]')[i] as HTMLInputElement;
    const cs = getComputedStyle(el);
    return {
      value: el.value,
      usableTextWidth: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      clipped: el.scrollWidth > el.clientWidth,
    };
  }, index);
}

test('Persons and Output accept typed numbers and show them legibly', async ({ page }) => {
  await page.goto('/entries');
  await page.waitForLoadState('networkidle');
  await page.getByRole('tab', { name: 'Office Grid' }).click();
  await page.waitForTimeout(1000);

  const numbers = page.locator('input[type="number"]');
  await expect(numbers).toHaveCount(2);          // Persons, Output

  const persons = numbers.nth(0);
  const output = numbers.nth(1);

  await persons.fill('4');
  await output.fill('300');
  await page.waitForTimeout(300);

  // the values must round-trip...
  expect(await persons.inputValue()).toBe('4');
  expect(await output.inputValue()).toBe('300');

  // ...and be readable rather than clipped out of the box
  for (const [label, i] of [['Persons', 0], ['Output', 1]] as const) {
    const m = await legibility(page, i);
    expect(m.clipped, `${label}: typed value is clipped out of view (box too narrow)`).toBe(false);
    expect(m.usableTextWidth, `${label}: only ${m.usableTextWidth}px of usable text width`).toBeGreaterThan(30);
  }

  // and the grid's own total must agree with what was typed
  await expect(page.locator('tr', { hasText: 'Totals:' })).toContainText('300');
});
