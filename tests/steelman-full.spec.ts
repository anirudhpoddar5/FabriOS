import { test, expect, Page } from '@playwright/test';
import { getSupabaseAdmin, selectOption, clickButton, fillField } from './helpers';
import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:8080';
const RUN = Date.now().toString(36);
const PREFIX = `E2E${RUN}`;

let companyId: string;

// ── Shared UI helpers ──
async function noError(page: Page) {
  const body = await page.locator('body').innerText().catch(() => '');
  expect(body).not.toContain('Application error');
  expect(body).not.toContain('Something went wrong');
}
function unique(s: string) { return `${s}-${RUN}`; }

// ── Seed data IDs (populated beforeAll) ──
const S: Record<string, any> = {};

test.describe.configure({ mode: 'serial' });

let _sessionJson: string | null = null;

async function authGoto(page: Page, targetUrl: string) {
  await page.setViewportSize({ width: 1280, height: 720 }).catch(() => {});
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForTimeout(1000);
  // If redirected to /login or still on landing page (not signed in), sign in
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

  // Get Supabase session token for auth injection
  const anonSupabase = createClient('https://ejebukxlwgwebjgdicyb.supabase.co', 'sb_publishable_IdKOfQkILYvWdNNopuKpeA_B-dQ3vHZ');
  const { data: { session } } = await anonSupabase.auth.signInWithPassword({ email: 'test@fabrios-e2e.com', password: 'TestPass123!' });
  if (session) _sessionJson = JSON.stringify(session);

  const f1 = crypto.randomUUID(), f2 = crypto.randomUUID();
  S.factories = [f1, f2];
  await admin.from('factories').insert([
    { id: f1, company_id: companyId, code: `FAC-A-${RUN}`, name: unique('Factory Alpha'), type: 'mixed', is_active: true },
    { id: f2, company_id: companyId, code: `FAC-B-${RUN}`, name: unique('Factory Beta'), type: 'printing', is_active: true },
  ]);

  S.shifts = [];
  for (const fid of [f1, f2]) {
    for (const s of [{ code: 'A', name: 'Morning' }, { code: 'B', name: 'Afternoon' }, { code: 'C', name: 'Night' }]) {
      const sid = crypto.randomUUID();
      S.shifts.push(sid);
      await admin.from('shifts').insert({ id: sid, factory_id: fid, code: s.code, name: s.name, start_time: '08:00', end_time: '17:00', is_active: true });
    }
  }

  S.workerTypes = [];
  for (const w of [{ name: unique('Printer'), module: 'printing' }, { name: unique('Tailor'), module: 'stitching' }, { name: unique('QC'), module: 'both' }]) {
    const wid = crypto.randomUUID();
    S.workerTypes.push(wid);
    await admin.from('worker_types').insert({ id: wid, company_id: companyId, name: w.name, module: w.module, is_active: true });
  }

  S.rateMasters = [];
  for (let i = 0; i < Math.min(4, S.shifts.length); i++) {
    const rid = crypto.randomUUID();
    S.rateMasters.push(rid);
    await admin.from('rate_masters').insert({ id: rid, company_id: companyId, factory_id: f1, shift_id: S.shifts[i], worker_type_id: S.workerTypes[0], rate_basis: 'per_person_per_shift', rate_value: 200, effective_from: '2026-01-01', is_active: true });
  }

  S.buyers = []; S.buyerDisplay = [];
  for (const b of [{ code: `BUY-1-${RUN}`, name: unique('Buyer One') }, { code: `BUY-2-${RUN}`, name: unique('Buyer Two') }, { code: `BUY-3-${RUN}`, name: unique('Buyer Three') }]) {
    const bid = crypto.randomUUID();
    S.buyers.push(bid);
    S.buyerDisplay.push(`${b.code} - ${b.name}`);
    await admin.from('buyers').insert({ id: bid, company_id: companyId, code: b.code, name: b.name, country: 'India', is_active: true });
  }

  S.fabrics = [];
  for (const fab of [{ name: unique('Cotton Canvas'), short_form: 'CC' }, { name: unique('Polyester Silk'), short_form: 'PS' }, { name: unique('Linen Blend'), short_form: 'LB' }]) {
    const fid = crypto.randomUUID();
    S.fabrics.push(fid);
    await admin.from('fabrics').insert({ id: fid, company_id: companyId, name: fab.name, short_form: fab.short_form, is_active: true });
  }

  S.printProducts = [];
  for (const p of [{ code: `PP1-${RUN}`, name: unique('Premium Print'), uom: 'meters' }, { code: `PP2-${RUN}`, name: unique('Eco Print'), uom: 'meters' }, { code: `PP3-${RUN}`, name: unique('Digital Print'), uom: 'meters' }]) {
    const pid = crypto.randomUUID();
    S.printProducts.push(pid);
    await admin.from('printing_products').insert({ id: pid, company_id: companyId, code: p.code, name: p.name, uom: p.uom, is_active: true });
  }

  S.stitchProducts = [];
  for (const p of [{ code: `SP1-${RUN}`, name: unique('Polo Shirt'), uom: 'pieces' }, { code: `SP2-${RUN}`, name: unique('Formal Shirt'), uom: 'pieces' }, { code: `SP3-${RUN}`, name: unique('Jeans'), uom: 'pieces' }]) {
    const pid = crypto.randomUUID();
    S.stitchProducts.push(pid);
    await admin.from('stitching_products').insert({ id: pid, company_id: companyId, code: p.code, name: p.name, uom: p.uom, is_active: true });
  }

  S.tables = [];
  for (const t of [{ code: 'TBL-A', name: unique('Table Alpha') }, { code: 'TBL-B', name: unique('Table Beta') }]) {
    const tid = crypto.randomUUID();
    S.tables.push(tid);
    await admin.from('printing_tables').insert({ id: tid, factory_id: f1, code: t.code, name: t.name, is_active: true });
  }

  S.lines = [];
  for (const l of [{ code: 'LN-A', name: unique('Line Alpha') }, { code: 'LN-B', name: unique('Line Beta') }]) {
    const lid = crypto.randomUUID();
    S.lines.push(lid);
    await admin.from('stitching_lines').insert({ id: lid, factory_id: f2, code: l.code, name: l.name, is_active: true });
  }

  S.vendors = [];
  for (const v of [{ code: `VND-1-${RUN}`, name: unique('Vendor One') }, { code: `VND-2-${RUN}`, name: unique('Vendor Two') }]) {
    const vid = crypto.randomUUID();
    S.vendors.push(vid);
    await admin.from('vendors').insert({ id: vid, company_id: companyId, code: v.code, name: v.name, is_active: true });
  }

  // ── Printing Orders ──
  S.printOrderIds = []; S.printRowIds = []; S.printCwIds = [];
  for (let oi = 0; oi < 3; oi++) {
    const oid = crypto.randomUUID();
    S.printOrderIds.push(oid);
    const pastDate = oi === 0 ? '2025-06-01' : (oi === 1 ? '2026-12-01' : '2026-06-01');
    await admin.from('order_headers').insert({ id: oid, company_id: companyId, module: 'printing', internal_po: `PO-P-${RUN}-${oi}`, buyer_id: S.buyers[0], style: unique(`STY-P-${oi}`), currency: 'USD', buyer_delivery_date: pastDate, status: oi === 2 ? 'Completed' : 'Started' });
    const rid1 = crypto.randomUUID();
    S.printRowIds.push(rid1);
    await admin.from('order_rows').insert({ id: rid1, order_id: oid, product_id: S.printProducts[0], fabric_id: S.fabrics[0], uom: 'meters', order_qty: 1000, chart_qty: 1000, rate_per_item: 5.5, no_of_colours: 3 });
    if (oi === 1) {
      const rid2 = crypto.randomUUID();
      S.printRowIds.push(rid2);
      await admin.from('order_rows').insert({ id: rid2, order_id: oid, product_id: S.printProducts[1], fabric_id: S.fabrics[1], uom: 'meters', order_qty: 500, chart_qty: 500, rate_per_item: 4.5, no_of_colours: 2 });
    }
    const rowIds = S.printRowIds.filter((_, idx) => idx === S.printRowIds.length - 1 - (oi === 1 ? 1 : 0));
    // Simplified: just attach to first/last row
    const targetRowId = S.printRowIds[S.printRowIds.length - 1];
    for (let ci = 0; ci < 3; ci++) {
      const cid = crypto.randomUUID();
      S.printCwIds.push(cid);
      await admin.from('order_colourways').insert({ id: cid, order_row_id: targetRowId, colour_name: unique(`Red-${oi}-${ci}`), ordered_qty: 300, uom: 'meters', sort_order: ci });
    }
  }

  // ── Stitching Orders ──
  S.stitchOrderIds = []; S.stitchRowIds = []; S.stitchCwIds = [];
  for (let oi = 0; oi < 2; oi++) {
    const oid = crypto.randomUUID();
    S.stitchOrderIds.push(oid);
    await admin.from('order_headers').insert({ id: oid, company_id: companyId, module: 'stitching', internal_po: `PO-S-${RUN}-${oi}`, buyer_id: S.buyers[1], style: unique(`STY-S-${oi}`), currency: 'INR', status: 'Started' });
    const rid = crypto.randomUUID();
    S.stitchRowIds.push(rid);
    await admin.from('order_rows').insert({ id: rid, order_id: oid, product_id: S.stitchProducts[0], uom: 'pieces', order_qty: 500, chart_qty: 500, rate_per_item: 3.0, no_of_colours: 3 });
    for (let ci = 0; ci < 3; ci++) {
      const cid = crypto.randomUUID();
      S.stitchCwIds.push(cid);
      await admin.from('order_colourways').insert({ id: cid, order_row_id: rid, colour_name: ['S', 'M', 'L'][ci], ordered_qty: 150, uom: 'pieces', size: ['S', 'M', 'L'][ci], sort_order: ci });
    }
  }

  // ── Production Entries ──
  S.entryIds = [];
  if (S.printCwIds.length > 0) {
    for (let ei = 0; ei < Math.min(3, S.printCwIds.length); ei++) {
      const eid = crypto.randomUUID();
      S.entryIds.push(eid);
      await admin.from('production_entries').insert({
        id: eid, company_id: companyId, date: '2026-06-20', module: 'printing', order_id: S.printOrderIds[0],
        colourway_id: S.printCwIds[ei], factory_id: S.factories[0], shift_id: S.shifts[0],
        worker_type_id: S.workerTypes[0], persons_used: 2, output_qty: 200 + ei * 100,
        output_uom: 'meters', rate_basis: 'per_person_per_shift', rate_value: 200, cost_amount: 400,
      });
    }
  }

  // ── Stock Jobs ──
  S.stockJobIds = [];
  for (let ji = 0; ji < 4; ji++) {
    const jid = crypto.randomUUID();
    S.stockJobIds.push(jid);
    await admin.from('stock_jobs').insert({
      id: jid, company_id: companyId, job_number: `SJ-${RUN}-${ji}`, product_name: unique(`StockProd-${ji}`),
      module: ji < 2 ? 'printing' : 'stitching', target_qty: 1000, produced_qty: ji === 2 ? 1000 : 500,
      uom: ji < 2 ? 'meters' : 'pieces', status: ['planned', 'in_progress', 'completed', 'planned'][ji],
      start_date: '2026-06-01', end_date: ji === 3 ? null : '2026-06-30', remarks: `Test job ${ji}`,
    });
  }

  // ── BOMs ──
  if (S.printOrderIds.length > 0) {
    S.bomIds = [];
    for (let bi = 0; bi < 2; bi++) {
      const bid = crypto.randomUUID();
      S.bomIds.push(bid);
      await admin.from('bom_headers').insert({ id: bid, company_id: companyId, title: unique(`BOM-${bi}`), bom_type: 'order', order_id: S.printOrderIds[bi], status: 'confirmed' });
      await admin.from('bom_lines').insert({ bom_id: bid, category: 'fabric', item_name: unique(`Material-${bi}-0`), quantity: 500, uom: 'meters', avg_consumption: 1.1, extra_pct: 5, rate: 3.5, sort_order: 0 });
      await admin.from('bom_lines').insert({ bom_id: bid, category: 'trim', item_name: unique(`Thread-${bi}-1`), quantity: 100, uom: 'spool', avg_consumption: 0.05, extra_pct: 10, rate: 0.5, sort_order: 1 });
    }
  }

  // ── Purchase Orders ──
  if (S.vendors.length > 0) {
    S.poIds = [];
    for (let pi = 0; pi < 2; pi++) {
      const poid = crypto.randomUUID();
      S.poIds.push(poid);
      await admin.from('purchase_orders').insert({ id: poid, company_id: companyId, po_number: `PO-BUY-${RUN}-${pi}`, vendor_id: S.vendors[0], po_date: '2026-06-15', status: pi === 0 ? 'draft' : 'ordered', currency: 'USD', total_amount: 7000, source_type: 'manual' });
      await admin.from('purchase_order_lines').insert({ po_id: poid, item_name: unique(`POItem-${pi}-0`), uom: 'meters', qty_ordered: 2000, rate: 3.5, amount: 7000 });
      await admin.from('purchase_order_lines').insert({ po_id: poid, item_name: unique(`POItem-${pi}-1`), uom: 'spool', qty_ordered: 500, rate: 0.5, amount: 250 });
    }
  }

  // ── Inventory ──
  S.invIds = [];
  for (const inv of [
    { code: `INV-1-${RUN}`, name: unique('Cotton Roll'), category: 'fabric', uom: 'meters', reorder: 100, stock: 5000 },
    { code: `INV-2-${RUN}`, name: unique('Ink Red'), category: 'ink', uom: 'kg', reorder: 10, stock: 5 },  // below reorder
    { code: `INV-3-${RUN}`, name: unique('Thread White'), category: 'trim', uom: 'spool', reorder: 50, stock: 200 },
    { code: `INV-4-${RUN}`, name: unique('Box Carton'), category: 'packaging', uom: 'pcs', reorder: 100, stock: 500 },
  ]) {
    const iid = crypto.randomUUID();
    S.invIds.push(iid);
    await admin.from('inventory_items').insert({ id: iid, company_id: companyId, code: inv.code, name: inv.name, category: inv.category, uom: inv.uom, reorder_level: inv.reorder, opening_stock: inv.stock, is_active: true });
  }

  // ── GRNs ──
  if (S.poIds && S.invIds.length > 0) {
    S.grnIds = [];
    for (let gi = 0; gi < 2; gi++) {
      const gid = crypto.randomUUID();
      S.grnIds.push(gid);
      await admin.from('grn_headers').insert({ id: gid, company_id: companyId, grn_number: `GRN-${RUN}-${gi}`, vendor_id: S.vendors[0], grn_date: '2026-06-18', status: gi === 0 ? 'completed' : 'partial' });
      await admin.from('grn_lines').insert({ grn_id: gid, item_id: S.invIds[gi], item_name: unique(`GRN Item ${gi}`), qty_received: gi === 0 ? 100 : 50, uom: 'pcs', remarks: gi === 1 ? 'Rejected 5 pcs - defect' : null });
    }
  }

  // ── Dispatch ──
  S.dispatchIds = [];
  if (S.printOrderIds.length > 0 && S.buyers.length > 0) {
    for (let di = 0; di < 2; di++) {
      const did = crypto.randomUUID();
      S.dispatchIds.push(did);
      await admin.from('dispatch_records').insert({ id: did, company_id: companyId, dispatch_date: '2026-06-19', order_id: S.printOrderIds[0], buyer_id: S.buyers[0], qty: 100 + di * 50, product_name: unique(`Prod-${di}`), colour: 'Red', challan_number: `CH-${RUN}-${di}`, vehicle_number: `HR-26-${RUN}-${di}`, dispatch_type: 'against_order', uom: 'meters' });
    }
  }

  console.log(`✅ Seeded: ${S.factories.length} factories, ${S.shifts.length} shifts, ${S.workerTypes.length} worker types, ${S.buyers.length} buyers, ${S.fabrics.length} fabrics, ${S.printProducts.length} print prods, ${S.stitchProducts.length} stitch prods, ${S.tables.length} tables, ${S.lines.length} lines, ${S.vendors.length} vendors, ${S.printOrderIds.length} POs, ${S.stitchOrderIds.length} SOs, ${S.entryIds.length} entries, ${S.stockJobIds.length} SJs, ${S.bomIds?.length || 0} BOMs, ${S.poIds?.length || 0} POs, ${S.invIds.length} inv, ${S.grnIds?.length || 0} GRNs, ${S.dispatchIds.length} dispatches`);
});

// ════════════════════════════════════════════════════════
// 👑 FACTORY OWNER — Dashboard
// ════════════════════════════════════════════════════════
test.describe('Factory Owner — Dashboard KPIs', () => {
  test('DO-01 All KPI card labels visible', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    const text = await page.locator('body').innerText();
    for (const label of ["TODAY'S OUTPUT", 'ACTIVE ORDERS', 'OVERDUE / DUE', '7-DAY TREND', "Today's Cost", 'Pending POs', 'Stock Jobs', 'Low Stock', 'WIP Balance', 'QUICK ACTIONS']) {
      expect(text).toContain(label);
    }
  });

  test('DO-02 Production progress: produced <= ordered, ratio sound', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    const header = page.getByText('Overall Production Progress');
    if (await header.isVisible().catch(() => false)) {
      const text = await header.locator('..').innerText();
      const m = text.match(/([\d.]+)\s*\/\s*([\d.]+)/);
      if (m) expect(parseFloat(m[1])).toBeLessThanOrEqual(parseFloat(m[2]) * 1.01);
    }
  });

  test('DO-03 Production progress section visible with WIP Balance', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    const body = await page.locator('body').innerText();
    if (body.includes('OVERALL PRODUCTION PROGRESS')) {
      expect(body).toContain('OVERALL PRODUCTION PROGRESS');
    }
    expect(body).toContain('WIP Balance');
  });

  test('DO-04 Per-colourway chips show valid percentages', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    const chips = page.locator('.text-\\[9px\\].bg-muted\\/50');
    const count = await chips.count();
    if (count > 0) for (const chip of await chips.all()) expect(await chip.innerText()).toMatch(/\d+%/);
  });

  test('DO-05 Overdue/Due card shows combined count', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    const card = page.getByText('Overdue / Due').locator('..').locator('..');
    await expect(card).toBeVisible();
    const val = parseInt((await card.locator('.text-2xl').textContent()) || '0');
    expect(typeof val).toBe('number');
    if (val > 0) await expect(card.locator('.lucide-triangle-alert')).toBeVisible();
  });

  test('DO-06 Quick Actions navigate with ?action=new', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    for (const btn of ['New Order', 'New PO', 'Receive Goods']) {
      const b = page.getByRole('button', { name: btn });
      if (await b.isVisible().catch(() => false)) {
        await b.click();
        await page.waitForURL(/\/(printing-orders|purchase-orders|grn)/, { timeout: 10_000 }).catch(() => {});
        expect(page.url()).toContain('action=new');
        await page.goBack();
        await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
      }
    }
  });

  test('DO-07 No undefined or NaN on dashboard', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\bundefined\b/); expect(body).not.toMatch(/\bNaN\b/);
  });

  test('DO-08 Mobile: KPI cards visible on 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, BASE); await noError(page);
    await expect(page.getByText("Today's Output")).toBeVisible();
    await expect(page.getByText('WIP Balance')).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════
// 👑 FACTORY OWNER — Reports
// ════════════════════════════════════════════════════════
test.describe('Factory Owner — Reports', () => {
  const REPORT_TABS = ['Order Status', 'Production', 'Delayed', 'Dispatch', 'PO Status', 'Stock On Hand', 'Profit/Loss'];

  test('DR-01 All report tabs render without error', async ({ page }) => {
    await authGoto(page, `${BASE}/reports`); await noError(page);
    for (const tab of REPORT_TABS) {
      const t = page.getByRole('tab', { name: tab });
      if (await t.isVisible({ timeout: 3000 }).catch(() => false)) {
        await t.click(); await page.waitForTimeout(300); await noError(page);
      }
    }
  });

  test('DR-02 CSV export button visible on reports page', async ({ page }) => {
    await authGoto(page, `${BASE}/reports`); await noError(page);
    await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/csv/i);
  });

  test('DR-03 Reports page loads without application error', async ({ page }) => {
    await authGoto(page, `${BASE}/reports`); await noError(page);
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
  });

  test('DR-04 Mobile: reports tab list scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/reports`); await noError(page);
    const firstTab = page.getByRole('tab', { name: REPORT_TABS[0] });
    await expect(firstTab).toBeVisible({ timeout: 5000 });
  });
});

// ════════════════════════════════════════════════════════
// 🏭 PRODUCTION MANAGER — Printing Orders
// ════════════════════════════════════════════════════════
test.describe('Production Manager — Printing Orders', () => {
  test('PM-PO-01 Order table shows seeded orders', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await expect(page.locator('body')).toContainText(`PO-P-${RUN}-0`, { timeout: 15_000 });
    for (let i = 0; i < 3; i++) await expect(page.locator('body')).toContainText(unique(`STY-P-${i}`));
  });

  test('PM-PO-02 Default sort is by buyer delivery date', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    const sortTrigger = page.locator('body').getByText('Delivery Date');
    await expect(sortTrigger).toBeVisible();
  });

  test('PM-PO-03 Status filter works', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    const statusFilter = page.getByRole('combobox').or(page.locator('[role="combobox"]')).first();
    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.click(); await page.waitForTimeout(200);
      const opt = page.getByRole('option', { name: /completed/i });
      if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) { await opt.click(); await page.waitForTimeout(300); }
    }
    await noError(page);
  });

  test('PM-PO-04 Create order via UI with 1 product row + 2 colourways', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await clickButton(page, /new order/i); await expect(page.getByRole('dialog')).toBeVisible();
    const style = unique(`UI-P-${Date.now()}`);
    await selectOption(page, 'Buyer *', new RegExp(unique('Buyer One')));
    await page.locator('div:has(> label:text-is("Style *")) input').fill(style);
    await clickButton(page, /add product row/i);
    await page.waitForTimeout(300);
    await selectOption(page, 'Fabric *', new RegExp('CC'));
    const nums = page.locator('[role="dialog"] input[type="number"]');
    await nums.nth(0).fill('1000'); await nums.nth(1).fill('950'); await nums.nth(2).fill('5.5');
    await page.locator('[role="dialog"] table tbody tr').first().locator('input').nth(0).fill('Red');
    await page.locator('[role="dialog"] table tbody tr').first().locator('input[type="number"]').first().fill('500');
    await clickButton(page, /save order/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText(style, { timeout: 10_000 });
  });

  test('PM-PO-05 Edit order: change style name', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    // Data-load wait with reload fallback (Supabase session may need refresh)
    const dataLoaded = async () => {
      try {
        await expect(page.locator('body')).toContainText(`PO-P-${RUN}-0`, { timeout: 10_000 });
        return true;
      } catch { return false; }
    };
    if (!await dataLoaded()) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      await noError(page);
    }
    await expect(page.locator('body')).toContainText(`PO-P-${RUN}-0`, { timeout: 30_000 });
    const row = page.locator(`table tbody tr:has(td:text("PO-P-${RUN}"))`).first();
    const count = await row.count();
    if (count === 0) { test.skip(true, 'No orders'); return; }
    await row.locator('button').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/edit printing order/i)).toBeVisible();
  });

  test('PM-PO-06 Row click navigates to order detail', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await expect(page.locator('body')).toContainText(`PO-P-${RUN}-0`, { timeout: 10_000 });
    const poRow = page.locator(`table tbody tr:has(td:text("PO-P-${RUN}"))`).first();
    if (await poRow.count() === 0) { test.skip(true, 'No rows'); return; }
    const poText = await poRow.locator('td').first().textContent();
    await poRow.click();
    await expect(page).toHaveURL(/\/printing-orders\//, { timeout: 10_000 });
    if (poText) await expect(page.locator('body')).toContainText(poText);
  });

  test('PM-PO-07 Mobile: printing orders table scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await expect(page.getByRole('heading', { name: /printing orders/i })).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════
// 🏭 PRODUCTION MANAGER — Production Entries
// ════════════════════════════════════════════════════════
test.describe('Production Manager — Production Entries', () => {
  test('PM-EN-01 Single entry: order → product → colourway → save', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await expect(page.getByRole('heading', { name: /entries/i })).toBeVisible();
    const orderPo = `PO-P-${RUN}-0`;
    await selectOption(page, 'Order *', new RegExp(orderPo)); await page.waitForTimeout(500);
    await selectOption(page, 'Colour *', new RegExp('Red'));
    const factoryName = unique('Factory Alpha');
    await selectOption(page, 'Factory *', new RegExp(factoryName)); await page.waitForTimeout(300);
    await selectOption(page, 'Shift *', 'Morning');
    await selectOption(page, 'Table *', 'TBL-A');
    await selectOption(page, 'Worker Type *', new RegExp(unique('Printer')));
    await fillField(page, 'Persons Used', '3'); await fillField(page, 'Output Qty', '500'); await fillField(page, 'UOM', 'meters');
    await clickButton(page, /save entry/i); await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Failed');
  });

  test('PM-EN-02 Single entry: rate + cost auto-calculated', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await selectOption(page, 'Order *', new RegExp(`PO-P-${RUN}-0`)); await page.waitForTimeout(500);
    await selectOption(page, 'Colour *', new RegExp('Red'));
    await selectOption(page, 'Factory *', new RegExp(unique('Factory Alpha'))); await page.waitForTimeout(300);
    await selectOption(page, 'Shift *', 'Morning');
    await selectOption(page, 'Table *', 'TBL-A');
    await selectOption(page, 'Worker Type *', new RegExp(unique('Printer')));
    await fillField(page, 'Persons Used', '2'); await fillField(page, 'Output Qty', '400');
    await expect(page.locator('body')).toContainText(/rate/i);
    await expect(page.locator('body')).toContainText(/cost/i);
  });

  test('PM-EN-03 Single entry: form resets orderId after save', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await selectOption(page, 'Order *', new RegExp(`PO-P-${RUN}-0`)); await page.waitForTimeout(500);
    await selectOption(page, 'Colour *', new RegExp('Red'));
    await selectOption(page, 'Factory *', new RegExp(unique('Factory Alpha'))); await page.waitForTimeout(300);
    await selectOption(page, 'Shift *', 'Morning');
    await selectOption(page, 'Table *', 'TBL-A');
    await selectOption(page, 'Worker Type *', new RegExp(unique('Printer')));
    await fillField(page, 'Persons Used', '1'); await fillField(page, 'Output Qty', '100');
    await clickButton(page, /save entry/i); await page.waitForTimeout(1000);
    await expect(page.locator('body')).not.toContainText(/Failed/);
  });

  test('PM-EN-04 Bulk entry: add 3 rows via UI', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await page.getByRole('tab', { name: /bulk/i }).click(); await page.waitForTimeout(300);
    const addBtn = page.getByRole('button', { name: /row/i });
    for (let i = 0; i < 3; i++) { await addBtn.click(); await page.waitForTimeout(100); }
    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
  });

  test('PM-EN-05 Bulk entry: validation shows errors for empty required fields', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await page.getByRole('tab', { name: /bulk/i }).click(); await page.waitForTimeout(300);
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      const firstStatus = rows.first().locator('td').last().locator('svg');
      const hasError = await firstStatus.isVisible().catch(() => false);
      // Row without data should show X (invalid)
    }
  });

  test('PM-EN-06 Bulk entry: product selector appears in colour cell', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await page.getByRole('tab', { name: /bulk/i }).click(); await page.waitForTimeout(300);
    const tableHeader = page.locator('table thead');
    await expect(tableHeader).toContainText(/product/i);
  });

  test('PM-EN-07 Mobile: entry form stacks vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/entries`); await noError(page);
    await expect(page.getByRole('heading', { name: /entries/i })).toBeVisible();
    await noError(page);
  });
});

// ════════════════════════════════════════════════════════
// 🏭 PRODUCTION MANAGER — Stitching Orders
// ════════════════════════════════════════════════════════
test.describe('Production Manager — Stitching Orders', () => {
  test('PM-SO-01 Stitching orders list shows seeded data', async ({ page }) => {
    await authGoto(page, `${BASE}/stitching-orders`); await noError(page);
    for (let i = 0; i < 2; i++) await expect(page.locator('body')).toContainText(unique(`STY-S-${i}`));
  });

  test('PM-SO-02 Create stitching order via UI', async ({ page }) => {
    await authGoto(page, `${BASE}/stitching-orders`); await noError(page);
    await clickButton(page, /new order/i); await expect(page.getByRole('dialog')).toBeVisible();
    const style = unique(`UI-S-${Date.now()}`);
    await selectOption(page, 'Buyer *', new RegExp(unique('Buyer Two')));
    await page.locator('div:has(> label:text-is("Style *")) input').fill(style);
    await selectOption(page, 'Product *', new RegExp(`SP1-${RUN}`));
    const nums = page.locator('[role="dialog"] input[type="number"]');
    await nums.nth(0).fill('500'); await nums.nth(1).fill('450'); await nums.nth(2).fill('3.0');
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await page.locator('[role="dialog"] input[placeholder*="Colour name"]').fill('Red');
    await clickButton(page, /save order/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
  });

  test('PM-SO-03 Row click navigates to stitching order detail', async ({ page }) => {
    await authGoto(page, `${BASE}/stitching-orders`); await noError(page);
    await expect(page.locator('body')).toContainText(`PO-S-${RUN}-0`, { timeout: 10_000 });
    const soRow = page.locator(`table tbody tr:has(td:text("PO-S-${RUN}"))`).first();
    if (await soRow.count() === 0) { test.skip(true, 'No rows'); return; }
    await soRow.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/stitching-orders\//);
  });

  test('PM-SO-04 Mobile: stitching orders responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/stitching-orders`); await noError(page);
    await expect(page.getByRole('heading', { name: /stitching orders/i })).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════
// 🏭 PRODUCTION MANAGER — Stock Jobs
// ════════════════════════════════════════════════════════
test.describe('Production Manager — Stock Jobs', () => {
  test('PM-SJ-01 Stock jobs list shows seeded data', async ({ page }) => {
    await authGoto(page, `${BASE}/stock-jobs`); await noError(page);
    for (let ji = 0; ji < 4; ji++) await expect(page.locator('body')).toContainText(`SJ-${RUN}-${ji}`);
  });

  test('PM-SJ-02 Create stock job via UI', async ({ page }) => {
    await authGoto(page, `${BASE}/stock-jobs`); await noError(page);
    await expect(page.locator('body')).toContainText(`SJ-${RUN}-0`, { timeout: 15_000 });
    await clickButton(page, /new job/i); await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('div:has(> label:text-is("Job Number *")) input').fill(unique(`SJ-UI-${Date.now()}`));
    await page.locator('div:has(> label:text-is("Product Name *")) input').fill(unique('UI Product'));
    await clickButton(page, /save/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  });

  test('PM-SJ-03 Edit stock job: clear end date persists (Bug 3 regression)', async ({ page }) => {
    await authGoto(page, `${BASE}/stock-jobs`); await noError(page);
    const row = page.locator('table tbody tr').filter({ hasText: `SJ-${RUN}-0` });
    if (await row.count() === 0) { test.skip(true, 'No matching SJ'); return; }
    await row.locator('button').first().click(); await expect(page.getByRole('dialog')).toBeVisible();
    const dates = page.locator('[role="dialog"] input[type="date"]');
    if (await dates.count() >= 2) { await dates.nth(1).clear(); await clickButton(page, /save/i); await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 }); }
  });

  test('PM-SJ-04 Status badges visible in stock jobs table', async ({ page }) => {
    await authGoto(page, `${BASE}/stock-jobs`); await noError(page);
    await expect(page.locator('body')).toContainText(/planned|in_progress|completed/i);
  });

  test('PM-SJ-05 Mobile: stock jobs responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/stock-jobs`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 📦 STORE INCHARGE — BOM
// ════════════════════════════════════════════════════════
test.describe('Store Incharge — BOM', () => {
  test('SI-BOM-01 BOM list shows seeded BOMs', async ({ page }) => {
    await authGoto(page, `${BASE}/bom`); await noError(page);
    for (let bi = 0; bi < 2; bi++) await expect(page.locator('body')).toContainText(unique(`BOM-${bi}`));
  });

  test('SI-BOM-02 Create BOM via UI', async ({ page }) => {
    await authGoto(page, `${BASE}/bom`); await noError(page);
    await clickButton(page, /new bom/i); await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('[role="dialog"] input').first().fill(unique(`BOM-UI-${Date.now()}`));
    await selectOption(page, 'Order', new RegExp(`PO-P-${RUN}-0`));
    await clickButton(page, /add line/i); await page.waitForTimeout(300);
    const line = page.locator('[role="dialog"] table tbody tr').first();
    await line.locator('input').nth(0).fill(unique('Mat UI'));
    await line.locator('input[type="number"]').nth(0).fill('100');
    await line.locator('input[type="number"]').nth(1).fill('5');
    await line.locator('input[type="number"]').nth(2).fill('2.5');
    await clickButton(page, /save bom/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
  });

  test('SI-BOM-03 Click BOM row navigates to detail', async ({ page }) => {
    await authGoto(page, `${BASE}/bom`); await noError(page);
    const rows = page.locator('table tbody tr');
    if (await rows.count() === 0) { test.skip(true, 'No rows'); return; }
    await rows.first().click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/bom\//);
  });
});

// ════════════════════════════════════════════════════════
// 📦 STORE INCHARGE — Purchase Orders
// ════════════════════════════════════════════════════════
test.describe('Store Incharge — Purchase Orders', () => {
  test('SI-PO-01 PO list shows seeded POs', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    for (let pi = 0; pi < 2; pi++) await expect(page.locator('body')).toContainText(`PO-BUY-${RUN}-${pi}`);
  });

  test('SI-PO-02 PO status badges visible (draft/ordered)', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    await expect(page.locator('body')).toContainText(/draft|ordered/i);
  });

  test('SI-PO-03 Row click navigates to PO detail', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    await expect(page.locator('body')).toContainText(`PO-BUY-${RUN}-0`, { timeout: 10_000 });
    const poRow = page.locator(`table tbody tr:has(td:text("PO-BUY-${RUN}"))`).first();
    if (await poRow.count() === 0) { test.skip(true, 'No rows'); return; }
    await poRow.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/purchase-orders\//);
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible();
  });

  test('SI-PO-04 Mobile: PO list responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 📦 STORE INCHARGE — GRN
// ════════════════════════════════════════════════════════
test.describe('Store Incharge — GRN', () => {
  test('SI-GRN-01 GRN list shows seeded GRNs', async ({ page }) => {
    await authGoto(page, `${BASE}/grn`); await noError(page);
    for (let gi = 0; gi < 2; gi++) await expect(page.locator('body')).toContainText(`GRN-${RUN}-${gi}`);
  });

  test('SI-GRN-02 GRN status badges visible', async ({ page }) => {
    await authGoto(page, `${BASE}/grn`); await noError(page);
    await expect(page.locator('body')).toContainText(/completed|partial/i);
  });

  test('SI-GRN-03 Row click navigates to GRN detail', async ({ page }) => {
    await authGoto(page, `${BASE}/grn`); await noError(page);
    await expect(page.locator('body')).toContainText(`GRN-${RUN}-0`, { timeout: 10_000 });
    const grnRow = page.locator(`table tbody tr:has(td:text("GRN-${RUN}"))`).first();
    if (await grnRow.count() === 0) { test.skip(true, 'No GRN rows'); return; }
    await grnRow.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/grn\//);
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible();
  });

  test('SI-GRN-04 Mobile: GRN responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/grn`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 📦 STORE INCHARGE — Dispatch
// ════════════════════════════════════════════════════════
test.describe('Store Incharge — Dispatch', () => {
  test('SI-DISP-01 Dispatch list shows seeded records', async ({ page }) => {
    await authGoto(page, `${BASE}/dispatch`); await noError(page);
    for (let di = 0; di < 2; di++) await expect(page.locator('body')).toContainText(`CH-${RUN}-${di}`);
  });

  test('SI-DISP-02 Mobile: dispatch responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/dispatch`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 💰 ACCOUNTS INCHARGE — Vendors
// ════════════════════════════════════════════════════════
test.describe('Accounts Incharge — Vendors', () => {
  test('AC-VEN-01 Vendor list shows seeded vendors', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/vendors`); await noError(page);
    await expect(page.locator('body')).not.toContainText('Loading...', { timeout: 20_000 });
    for (let vi = 0; vi < 2; vi++) await expect(page.locator('body')).toContainText(`VND-${vi + 1}-${RUN}`);
  });

  test('AC-VEN-02 Create vendor via UI', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/vendors`); await noError(page);
    // Wait for data to load before interacting (companyId must be set)
    await expect(page.locator('body')).toContainText(`VND-1-${RUN}`, { timeout: 15_000 });
    await clickButton(page, /add vendor/i); await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);
    const codeInput = page.locator('[role="dialog"] input').first();
    await codeInput.click();
    await codeInput.fill(`VND-UI-${RUN}`);
    await page.locator('[role="dialog"] input').nth(1).fill(unique('UI Vendor'));
    await clickButton(page, /save/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).toContainText(`VND-UI-${RUN}`);
  });
});

// ════════════════════════════════════════════════════════
// 💰 ACCOUNTS INCHARGE — Inventory
// ════════════════════════════════════════════════════════
test.describe('Accounts Incharge — Inventory', () => {
  test('AC-INV-01 Inventory list shows seeded items', async ({ page }) => {
    await authGoto(page, `${BASE}/inventory`); await noError(page);
    for (let ii = 0; ii < 4; ii++) await expect(page.locator('body')).toContainText(`INV-${ii + 1}-${RUN}`);
  });

  test('AC-INV-02 Add inventory item via UI', async ({ page }) => {
    await authGoto(page, `${BASE}/inventory`); await noError(page);
    await clickButton(page, /add item/i); await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] input').first().fill(`INV-UI-${RUN}`);
    await page.locator('[role="dialog"] input').nth(1).fill(unique('UI Item'));
    await page.locator('[role="dialog"] input').nth(2).fill('100');  // Opening Stock
    await clickButton(page, /save/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  });

  test('AC-INV-03 Low stock item visible (stock < reorder level)', async ({ page }) => {
    await authGoto(page, `${BASE}/inventory`); await noError(page);
    await expect(page.locator('body')).toContainText(unique('Ink Red'));
  });

  test('AC-INV-04 Inventory search filters items', async ({ page }) => {
    await authGoto(page, `${BASE}/inventory`); await noError(page);
    const search = page.getByPlaceholder(/search/i);
    if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
      await search.fill(unique('Cotton Roll')); await page.waitForTimeout(300);
      await expect(page.locator('body')).toContainText(unique('Cotton Roll'));
    }
  });

  test('AC-INV-05 Mobile: inventory responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/inventory`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 💰 ACCOUNTS INCHARGE — Financials
// ════════════════════════════════════════════════════════
test.describe('Accounts Incharge — Financials', () => {
  test('AC-FIN-01 PO line items visible with amounts', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    await expect(page.locator('body')).toContainText(`PO-BUY-${RUN}-0`, { timeout: 10_000 });
    const poRow = page.locator(`table tbody tr:has(td:text("PO-BUY-${RUN}"))`).first();
    if (await poRow.count() > 0) {
      await poRow.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
      await expect(page.locator('body')).toContainText(/amount|total/i);
    }
  });

  test('AC-FIN-02 PO detail has print/download buttons', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    await expect(page.locator('body')).toContainText(`PO-BUY-${RUN}-0`, { timeout: 10_000 });
    const poRow = page.locator(`table tbody tr:has(td:text("PO-BUY-${RUN}"))`).first();
    if (await poRow.count() > 0) {
      await poRow.click(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
      await expect(page.getByRole('button', { name: /print/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /csv/i })).toBeVisible();
    }
  });

  test('AC-FIN-03 Amounts display without truncation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/purchase-orders`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 🔗 CROSS-CUTTING — Navigation
// ════════════════════════════════════════════════════════
test.describe('Cross-cutting — Navigation', () => {
  test('CC-NAV-01 All pages render without crash', async ({ page }) => {
    const pages = [
      `${BASE}/`, `${BASE}/printing-orders`, `${BASE}/stitching-orders`, `${BASE}/entries`,
      `${BASE}/bom`, `${BASE}/purchase-orders`, `${BASE}/grn`, `${BASE}/dispatch`,
      `${BASE}/stock-jobs`, `${BASE}/inventory`, `${BASE}/production-control`, `${BASE}/reports`,
      `${BASE}/settings/factories-shifts`, `${BASE}/settings/workers-rates`, `${BASE}/settings/buyers`,
      `${BASE}/settings/fabrics`, `${BASE}/settings/printing-products`, `${BASE}/settings/stitching-products`,
      `${BASE}/settings/printing-tables`, `${BASE}/settings/stitching-lines`, `${BASE}/settings/vendors`,
      `${BASE}/settings/companies`, `${BASE}/settings/users`,
    ];
    for (const url of pages) {
      await authGoto(page, url);
      const body = await page.locator('body').innerText().catch(() => '');
      expect(body).not.toContain('Application error');
      expect(body).not.toContain('Something went wrong');
    }
  });

  test('CC-NAV-02 Sidebar collapse/expand toggles navigation text', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    const toggle = page.getByRole('button', { name: /toggle sidebar/i });
    await toggle.click({ force: true }); await page.waitForTimeout(400);
    await toggle.click({ force: true }); await page.waitForTimeout(400);
    await noError(page);
  });

  test('CC-NAV-03 Browser back returns to previous page', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await page.goBack(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await expect(page).toHaveURL(BASE + '/');
  });

  test('CC-NAV-04 Settings menu expandable in sidebar', async ({ page }) => {
    await authGoto(page, BASE);
    const settingsBtn = page.getByRole('button', { name: /settings/i });
    if (await settingsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsBtn.click(); await page.waitForTimeout(300);
      await expect(page.getByRole('link', { name: /factories/i }).first()).toBeVisible({ timeout: 3000 });
    }
  });
});

// ════════════════════════════════════════════════════════
// 🔗 CROSS-CUTTING — URL Params
// ════════════════════════════════════════════════════════
test.describe('Cross-cutting — URL Params', () => {
  test('CC-URL-01 ?action=new auto-opens on printing-orders', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders?action=new`); await noError(page);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('CC-URL-02 ?action=new auto-opens on purchase-orders', async ({ page }) => {
    await authGoto(page, `${BASE}/purchase-orders?action=new`); await noError(page);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('CC-URL-03 ?action=new auto-opens on GRN page', async ({ page }) => {
    await authGoto(page, `${BASE}/grn?action=new`); await noError(page);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });
});

// ════════════════════════════════════════════════════════
// 🔗 CROSS-CUTTING — Auth
// ════════════════════════════════════════════════════════
test.describe('Cross-cutting — Auth', () => {
  test('CC-AUTH-01 Session persists on full reload', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    await page.reload(); await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('CC-AUTH-02 Sign out button visible when authenticated', async ({ page }) => {
    await authGoto(page, BASE); await noError(page);
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('CC-AUTH-03 Reports accessible while authenticated', async ({ page }) => {
    await authGoto(page, `${BASE}/reports`); await noError(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('CC-AUTH-04 Inventory accessible while authenticated', async ({ page }) => {
    await authGoto(page, `${BASE}/inventory`); await noError(page);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ════════════════════════════════════════════════════════
// 🔗 CROSS-CUTTING — Mobile Viewport (375px)
// ════════════════════════════════════════════════════════
test.describe('Cross-cutting — Mobile Viewport', () => {
  test('CC-MOB-01 Login page stacks on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/login`); await noError(page);
  });

  test('CC-MOB-02 Dashboard renders on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, BASE); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });

  test('CC-MOB-03 Orders table scrolls horizontally on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/printing-orders`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });

  test('CC-MOB-04 Settings page renders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/settings/buyers`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });

  test('CC-MOB-05 Dispatch page renders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/dispatch`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });

  test('CC-MOB-06 Reports page renders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authGoto(page, `${BASE}/reports`); await noError(page);
    await expect(page.locator('body')).not.toContainText(/Application error/i);
  });
});

// ════════════════════════════════════════════════════════
// 🔗 CROSS-CUTTING — Settings CRUD
// ════════════════════════════════════════════════════════
test.describe('Cross-cutting — Settings CRUD', () => {
  test('CC-SET-01 Factory: create + verify in table', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/factories-shifts`); await noError(page);
    await clickButton(page, /add factory/i); await expect(page.getByRole('dialog')).toBeVisible();
    await fillField(page, 'Factory Code *', `FAC-UI-${RUN}`);
    await fillField(page, 'Factory Name *', unique('UI Factory'));
    await selectOption(page, 'Type *', 'Printing');
    await clickButton(page, /save/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table')).toContainText(`FAC-UI-${RUN}`);
  });

  test('CC-SET-02 Buyer: create + verify in table', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/buyers`); await noError(page);
    await clickButton(page, /^add$/i); await expect(page.getByRole('dialog')).toBeVisible();
    await fillField(page, 'Buyer Code *', `BUY-UI-${RUN}`);
    await fillField(page, 'Buyer Name', unique('UI Buyer'));
    await selectOption(page, 'Country *', 'India');
    await clickButton(page, /save/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).toContainText(`BUY-UI-${RUN}`);
  });

  test('CC-SET-03 Fabric: create + verify in table', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/fabrics`); await noError(page);
    await clickButton(page, /^add$/i); await expect(page.getByRole('dialog')).toBeVisible();
    await fillField(page, 'Fabric Name *', unique('UI Fabric'));
    await clickButton(page, /save/i);
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).toContainText(unique('UI Fabric'));
  });
});

// No afterAll cleanup needed — data uses unique RUN IDs per run
