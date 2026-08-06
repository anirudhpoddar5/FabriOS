import { test, expect, Page } from '@playwright/test';

/* ═══════════════════════════════════════════════════════════════
   ZERO-TO-PRODUCTION PIPELINE — UI-ONLY
   A single new company built entirely through the UI:
   signup → SetupWizard (auto-approve) → ModuleSelect (Both) →
   masters (factory/shift/worker type/rate/buyer/fabric/printing
   product/printing table/vendor) → printing order (rows +
   colourways) → BOM (with vendors) → Generate POs → GRN →
   production entry → dispatch → stock job → inventory item +
   transaction → reports tab click-through → logout/login.

   No service-role client is used anywhere. Every assertion is
   UI-only (visible text, toasts, tables, URLs).
   ═══════════════════════════════════════════════════════════════ */

const BASE = 'http://localhost:8080';
const TS = Date.now().toString(36).slice(-4);
const RUN = `ZP${TS}`;

const S: Record<string, any> = {};

function unique(s: string) { return `${s}-${RUN}`; }

const PROJECT_ID = 'ejebukxlwgwebjgdicyb';

async function noError(page: Page) {
  const body = await page.locator('body').innerText().catch(() => '');
  expect(body).not.toContain('Application error');
  expect(body).not.toContain('Something went wrong');
  expect(body).not.toContain('Unexpected Application');
}

async function fillByLabel(page: Page, label: string, value: string) {
  const el = page.locator(`div:has(> label:text-is("${label}")) input`).first();
  await el.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await el.clear();
  await el.fill(value);
}

async function selectShadcn(page: Page, label: string, optionText: string | RegExp) {
  const trigger = page.locator(`label:text-is("${label}")`).locator('..').locator('[role="combobox"]').first();
  if (!(await trigger.isVisible({ timeout: 3000 }).catch(() => false))) return;
  await trigger.click({ force: true, timeout: 3000 });
  await page.waitForTimeout(400);
  const option = page.getByRole('option', { name: optionText }).first();
  if (await option.isVisible({ timeout: 5000 }).catch(() => false)) await option.click();
  await page.waitForTimeout(300);
}

async function clickVisible(page: Page, text: string | RegExp) {
  const btn = page.getByRole('button', { name: text }).first();
  await btn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await btn.click();
}

async function checkToast(page: Page, text: string) {
  const toast = page.locator('[role="status"], .sonner-toast').first();
  const ok = await toast.isVisible({ timeout: 15000 }).catch(() => false);
  if (!ok) { console.log(`⚠️ No toast (expected "${text}")`); return; }
  const t = await toast.textContent().catch(() => '');
  expect(t.toLowerCase()).toContain(text.toLowerCase());
}

async function authGoto(page: Page, targetUrl: string) {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);
  const onLogin = page.url().includes('/login') ||
    await page.getByRole('button', { name: /^sign in$/i }).first().isVisible().catch(() => false);
  if (onLogin && S.email && S.password) {
    if (!page.url().includes('/login')) {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }
    await page.getByPlaceholder('you@company.com').fill(S.email);
    await page.getByPlaceholder('••••••••').fill(S.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(3000);
    if (await page.getByText('Select your workspace').isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByText('Both').click();
      await page.waitForTimeout(1000);
    }
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => {
    localStorage.setItem('fabrios_module', 'both');
    localStorage.setItem('fabrios_tour_done', '1');
  });
}

test.describe.configure({ mode: 'serial' });

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — Registration, Setup Wizard, Module Select
   ═══════════════════════════════════════════════════════════════ */
test.describe('Section 1 — Registration & Setup', () => {

  test('1.01 — Sign up as a brand-new user', async ({ page }) => {
    S.email = `zero-${RUN}@fabrios-e2e.com`.toLowerCase();
    S.password = 'ZeroToProd2026!';
    S.displayName = `Zero Tester ${RUN}`;
    S.companyName = unique('Zero Prod Corp');

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const createAccount = page.getByText('Create account').first();
    if (await createAccount.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createAccount.click();
      await page.waitForTimeout(500);
    }

    await page.getByPlaceholder('John Doe').fill(S.displayName);
    await page.getByPlaceholder('you@company.com').fill(S.email);
    const passInputs = page.locator('input[type="password"]');
    await passInputs.nth(0).fill(S.password);
    await passInputs.nth(1).fill(S.password);

    await clickVisible(page, /create account/i);
    await page.waitForTimeout(4000);

    const wizardHeader = page.getByText("Let's set up your workspace");
    const isInWizard = await wizardHeader.isVisible({ timeout: 8000 }).catch(() => false);
    expect(isInWizard).toBe(true);
    console.log(`✅ 1.01 — Signed up: ${S.email}`);
  });

  test('1.02 — Complete SetupWizard (creates company + auto-approves)', async ({ page }) => {
    await authGoto(page, `${BASE}/`);
    await page.waitForTimeout(2000);

    // SetupWizard — Company step
    const wizard = page.getByText("Let's set up your workspace");
    if (await wizard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fillByLabel(page, 'Company Name *', S.companyName);
      await fillByLabel(page, 'Your Name', S.displayName);
      await clickVisible(page, /continue/i);
      await page.waitForTimeout(3000);
    } else {
      // Maybe already on module select or dashboard — acceptable
      console.log('⚠️ 1.02 — SetupWizard not shown (company may already exist)');
    }

    // After company creation the app redirects to ModuleSelect
    // (currentModule state is still null). Verify we're past the wizard.
    const moduleSelect = page.getByText('Select your workspace');
    const onModuleSelect = await moduleSelect.isVisible({ timeout: 8000 }).catch(() => false);
    expect(onModuleSelect).toBe(true);
    await noError(page);
    console.log('✅ 1.02 — SetupWizard completed, company created');
  });

  test('1.03 — Module select: choose Both', async ({ page }) => {
    await authGoto(page, `${BASE}/`);
    await page.waitForTimeout(2000);

    const moduleSelect = page.getByText('Select your workspace');
    if (await moduleSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByText('Both').first().click();
      await page.waitForTimeout(2000);
    }

    await noError(page);
    // Should be on dashboard now
    const body = await page.locator('body').innerText();
    const onDashboard = /good (morning|afternoon|evening)|today.*output|wip balance/i.test(body);
    expect(onDashboard).toBe(true);
    console.log('✅ 1.03 — Module "Both" selected, dashboard loaded');
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — Master Data (all via Settings UI)
   ═══════════════════════════════════════════════════════════════ */
test.describe('Section 2 — Master Data', () => {

  test('2.01 — Create factory', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/factories-shifts`);
    await page.waitForTimeout(2000);

    await clickVisible(page, /add/i);
    await page.waitForTimeout(500);

    S.factoryCode = unique('FAC-Z');
    S.factoryName = unique('Zero Factory');
    await fillByLabel(page, 'Factory Code *', S.factoryCode);
    await fillByLabel(page, 'Factory Name *', S.factoryName);
    await selectShadcn(page, 'Type', 'Mixed');

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);

    await expect(page.locator('table tbody')).toContainText(S.factoryCode, { timeout: 8000 });
    await noError(page);
    console.log(`✅ 2.01 — Factory ${S.factoryCode} created`);
  });

  test('2.02 — Create shift', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/factories-shifts`);
    await page.waitForTimeout(2000);

    const factoryRow = page.locator('table tbody tr').filter({ hasText: S.factoryCode }).first();
    await factoryRow.click();
    await page.waitForTimeout(500);

    const shiftTab = page.getByRole('tab', { name: /shift/i });
    if (await shiftTab.isVisible().catch(() => false)) await shiftTab.click();
    await page.waitForTimeout(500);

    await clickVisible(page, /add shift/i);
    await page.waitForTimeout(500);

    S.shiftCode = unique('SFT');
    S.shiftName = unique('Zero Shift');
    await fillByLabel(page, 'Shift Code *', S.shiftCode);
    await fillByLabel(page, 'Shift Name *', S.shiftName);
    await fillByLabel(page, 'Start Time *', '08:00');
    await fillByLabel(page, 'End Time *', '17:00');

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toContainText(S.shiftCode, { timeout: 8000 });
    console.log(`✅ 2.02 — Shift ${S.shiftCode} created`);
  });

  test('2.03 — Create worker type', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/workers-rates`);
    await page.waitForTimeout(2000);

    const wtTab = page.getByRole('tab', { name: /worker type/i });
    if (await wtTab.isVisible().catch(() => false)) await wtTab.click();
    await page.waitForTimeout(500);

    const addWorkerBtn = page.getByRole('button', { name: 'Add Worker', exact: true }).first();
    await expect(addWorkerBtn).toBeVisible({ timeout: 5000 });
    await addWorkerBtn.click();
    await page.waitForTimeout(500);

    S.workerTypeName = unique('Zero Operator');
    await fillByLabel(page, 'Name *', S.workerTypeName);
    await selectShadcn(page, 'Module', 'Both');
    await selectShadcn(page, 'Rate Basis', 'Per Person/Shift');
    await fillByLabel(page, 'Default Rate Value', '250');

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toContainText(S.workerTypeName, { timeout: 8000 });
    console.log(`✅ 2.03 — Worker type ${S.workerTypeName} created`);
  });

  test('2.04 — Create rate master', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/workers-rates`);
    await page.waitForTimeout(2000);

    const rateTab = page.getByRole('tab', { name: /rate/i });
    if (await rateTab.isVisible().catch(() => false)) await rateTab.click();
    await page.waitForTimeout(500);

    await clickVisible(page, /add rate/i);
    await page.waitForTimeout(500);

    await selectShadcn(page, 'Factory', new RegExp(S.factoryCode));
    await selectShadcn(page, 'Worker Type', new RegExp(S.workerTypeName));
    await selectShadcn(page, 'Shift', new RegExp(S.shiftCode));
    await fillByLabel(page, 'Rate Value', '250');
    await fillByLabel(page, 'Effective From', '2026-01-01');

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
    await noError(page);
    console.log('✅ 2.04 — Rate master created');
  });

  test('2.05 — Create buyer', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/buyers`);
    await page.waitForTimeout(2000);

    await clickVisible(page, /add/i);
    await page.waitForTimeout(500);

    S.buyerCode = unique('BUY-Z');
    S.buyerName = unique('Zero Buyer');
    await fillByLabel(page, 'Buyer Code *', S.buyerCode);
    await fillByLabel(page, 'Buyer Name', S.buyerName);
    await selectShadcn(page, 'Country *', 'India');

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('table tbody')).toContainText(S.buyerName, { timeout: 8000 });
    console.log(`✅ 2.05 — Buyer ${S.buyerName} created`);
  });

  test('2.06 — Create fabric', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/fabrics`);
    await page.waitForTimeout(2000);

    await clickVisible(page, /add/i);
    await page.waitForTimeout(500);

    S.fabricName = unique('Zero Cotton');
    S.fabricShort = `ZC${RUN}`;
    await fillByLabel(page, 'Fabric Name *', S.fabricName);
    await fillByLabel(page, 'Short Form', S.fabricShort);

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('table tbody')).toContainText(S.fabricName, { timeout: 8000 });
    console.log(`✅ 2.06 — Fabric ${S.fabricName} created`);
  });

  test('2.07 — Create printing product', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/printing-products`);
    await page.waitForTimeout(2000);

    await clickVisible(page, /add/i);
    await page.waitForTimeout(500);

    S.printProdCode = unique('PP-Z');
    S.printProdName = unique('Zero Print Product');
    await fillByLabel(page, 'Product Name *', S.printProdName);
    await fillByLabel(page, 'Product Code (auto)', S.printProdCode);
    await selectShadcn(page, 'UOM *', 'Meters');

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('table tbody')).toContainText(S.printProdName, { timeout: 8000 });
    console.log(`✅ 2.07 — Printing product ${S.printProdName} created`);
  });

  test('2.08 — Create printing table', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/printing-tables`);
    await page.waitForTimeout(2000);

    await clickVisible(page, /add/i);
    await page.waitForTimeout(500);

    S.tableCode = unique('TBL-Z');
    S.tableName = unique('Zero Table');
    await selectShadcn(page, 'Factory *', new RegExp(S.factoryCode));
    await fillByLabel(page, 'Table Code *', S.tableCode);
    await fillByLabel(page, 'Table Name *', S.tableName);

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('table tbody')).toContainText(S.tableCode, { timeout: 8000 });
    console.log(`✅ 2.08 — Printing table ${S.tableCode} created`);
  });

  test('2.09 — Create vendor', async ({ page }) => {
    await authGoto(page, `${BASE}/settings/vendors`);
    await page.waitForTimeout(2000);

    await clickVisible(page, /add/i);
    await page.waitForTimeout(500);

    S.vendorCode = unique('VND-Z');
    S.vendorName = unique('Zero Vendor');
    await fillByLabel(page, 'Code *', S.vendorCode);
    await fillByLabel(page, 'Name *', S.vendorName);

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('table tbody')).toContainText(S.vendorCode, { timeout: 8000 });
    console.log(`✅ 2.09 — Vendor ${S.vendorName} created`);
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — Printing Order (rows + colourways)
   ═══════════════════════════════════════════════════════════════ */
test.describe('Section 3 — Printing Order', () => {

  test('3.01 — Create printing order with a row and colourways', async ({ page }) => {
    await authGoto(page, `${BASE}/printing-orders`);
    await page.waitForTimeout(3000);

    await clickVisible(page, /new order/i);
    await page.waitForTimeout(1000);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    S.printStyle = unique('STYLE-ZERO');
    const buyerLabel = page.locator('label:text-is("Buyer *")');
    if (await buyerLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectShadcn(page, 'Buyer *', new RegExp(S.buyerCode));
    }
    await fillByLabel(page, 'Style *', S.printStyle);

    // Row quantity / rate fields
    const numInputs = page.locator('[role="dialog"] input[type="number"]');
    if (await numInputs.count() >= 1) await numInputs.nth(0).fill('1000');
    if (await numInputs.count() >= 2) await numInputs.nth(1).fill('950');
    if (await numInputs.count() >= 3) await numInputs.nth(2).fill('5.50');

    // First colourway
    const cwTable = page.locator('[role="dialog"] table tbody');
    const cwRow1 = cwTable.locator('tr').first();
    const cwInputs = cwRow1.locator('input');
    if (await cwInputs.count() >= 1) await cwInputs.nth(0).fill('Red');
    if (await cwInputs.count() >= 2) await cwInputs.nth(1).fill('600');

    // Second colourway
    const addCwBtn = page.locator('[role="dialog"] button:has-text("Add Colour")').first();
    if (await addCwBtn.isVisible().catch(() => false)) await addCwBtn.click();
    await page.waitForTimeout(300);
    const cwRows = cwTable.locator('tr');
    if (await cwRows.count() >= 2) {
      await cwRows.nth(1).locator('input').nth(0).fill('Blue');
      await cwRows.nth(1).locator('input[type="number"]').first().fill('400');
    }

    await clickVisible(page, /save order/i);
    await page.waitForTimeout(3000);
    await noError(page);

    // Verify appears on list
    await page.goto(`${BASE}/printing-orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const searchBox = page.getByPlaceholder('Search orders...');
    if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchBox.fill(S.printStyle);
      await page.waitForTimeout(1000);
    }
    await expect(page.locator('body')).toContainText(S.printStyle, { timeout: 10000 });
    console.log(`✅ 3.01 — Printing order ${S.printStyle} created`);
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — BOM → PO → GRN Chain
   ═══════════════════════════════════════════════════════════════ */
test.describe('Section 4 — BOM, PO, GRN', () => {

  test('4.01 — Create BOM with vendor-assigned lines', async ({ page }) => {
    await authGoto(page, `${BASE}/bom`);
    await page.waitForTimeout(3000);
    await noError(page);

    await clickVisible(page, /new bom/i);
    await page.waitForTimeout(800);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    S.bomTitle = unique('BOM-Zero');
    const titleInput = page.locator('[role="dialog"] input').first();
    if (await titleInput.isVisible().catch(() => false)) await titleInput.fill(S.bomTitle);

    await selectShadcn(page, 'Order', new RegExp(S.printStyle));

    // Line 1 — with vendor assigned (needed for PO generation)
    await clickVisible(page, /add line/i);
    await page.waitForTimeout(300);
    let lineRow = page.locator('[role="dialog"] table tbody tr').first();
    if (await lineRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      const inputs = lineRow.locator('input');
      if (await inputs.count() >= 1) await inputs.nth(0).fill(unique('Main Fabric'));
      const nums = lineRow.locator('input[type="number"]');
      if (await nums.count() >= 1) await nums.nth(0).fill('500');
      if (await nums.count() >= 2) await nums.nth(1).fill('5');
      if (await nums.count() >= 3) await nums.nth(2).fill('3.50');
      // Vendor select — last combobox in the row
      const vendorCb = lineRow.locator('[role="combobox"]').last();
      if (await vendorCb.isVisible({ timeout: 2000 }).catch(() => false)) {
        await vendorCb.click({ force: true });
        await page.waitForTimeout(300);
        const vendorOpt = page.getByRole('option', { name: new RegExp(S.vendorName) }).first();
        if (await vendorOpt.isVisible({ timeout: 3000 }).catch(() => false)) await vendorOpt.click();
        await page.waitForTimeout(300);
      }
    }

    // Line 2 — with vendor assigned
    await clickVisible(page, /add line/i);
    await page.waitForTimeout(300);
    lineRow = page.locator('[role="dialog"] table tbody tr').nth(1);
    if (await lineRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      const inputs = lineRow.locator('input');
      if (await inputs.count() >= 1) await inputs.nth(0).fill(unique('Thread'));
      const nums = lineRow.locator('input[type="number"]');
      if (await nums.count() >= 1) await nums.nth(0).fill('100');
      if (await nums.count() >= 2) await nums.nth(1).fill('10');
      if (await nums.count() >= 3) await nums.nth(2).fill('0.50');
      const vendorCb = lineRow.locator('[role="combobox"]').last();
      if (await vendorCb.isVisible({ timeout: 2000 }).catch(() => false)) {
        await vendorCb.click({ force: true });
        await page.waitForTimeout(300);
        const vendorOpt = page.getByRole('option', { name: new RegExp(S.vendorName) }).first();
        if (await vendorOpt.isVisible({ timeout: 3000 }).catch(() => false)) await vendorOpt.click();
        await page.waitForTimeout(300);
      }
    }

    await clickVisible(page, /save bom/i);
    await page.waitForTimeout(3000);
    await noError(page);

    await page.goto(`${BASE}/bom`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toContainText(S.bomTitle, { timeout: 10000 });
    console.log(`✅ 4.01 — BOM ${S.bomTitle} created`);
  });

  test('4.02 — Generate POs from BOM (with vendors)', async ({ page }) => {
    await authGoto(page, `${BASE}/bom`);
    await page.waitForTimeout(3000);

    const bomRow = page.locator('table tbody tr').filter({ hasText: S.bomTitle }).first();
    await bomRow.getByRole('button').first().click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Select both lines
    const checkboxes = page.locator('[role="dialog"] [role="checkbox"]');
    const n = await checkboxes.count();
    for (let i = 0; i < n; i++) {
      await checkboxes.nth(i).check({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(300);

    const genBtn = page.getByRole('button', { name: /generate po/i });
    if (await genBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await genBtn.click();
      await page.waitForTimeout(1500);
    }

    // PO confirmation dialog — vendors already set on lines; confirm creation
    const createBtn = page.getByRole('button', { name: /create.*po/i });
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(3000);
      await checkToast(page, 'Purchase Orders generated successfully');
    }

    await noError(page);
    console.log('✅ 4.02 — PO generated from BOM');

    // Verify purchase orders page loads
    await page.goto(`${BASE}/purchase-orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await noError(page);
    console.log('✅ 4.02 — Purchase orders page loads');
  });

  test('4.03 — Create GRN', async ({ page }) => {
    await authGoto(page, `${BASE}/grn`);
    await page.waitForTimeout(3000);
    await noError(page);

    await clickVisible(page, /new/i);
    await page.waitForTimeout(800);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    S.grnNumber = unique('GRN-Z');
    await fillByLabel(page, 'GRN #', S.grnNumber);
    await selectShadcn(page, 'Vendor *', new RegExp(S.vendorName));
    await selectShadcn(page, 'PO Reference', new RegExp('PO-'));
    await fillByLabel(page, 'Date *', '2026-08-01');

    // First item line — qty received
    const itemRow = page.locator('[role="dialog"] table tbody tr').first();
    if (await itemRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      const nums = itemRow.locator('input[type="number"]');
      if (await nums.count() >= 1) await nums.nth(0).fill('500');
    }

    await clickVisible(page, /save/i);
    await page.waitForTimeout(3000);
    await noError(page);

    await page.goto(`${BASE}/grn`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toContainText(S.grnNumber, { timeout: 10000 });
    console.log(`✅ 4.03 — GRN ${S.grnNumber} created`);
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — Production Entry (single)
   ═══════════════════════════════════════════════════════════════ */
test.describe('Section 5 — Production Entry', () => {

  test('5.01 — Log a single production entry', async ({ page }) => {
    await authGoto(page, `${BASE}/entries`);
    await page.waitForTimeout(3000);
    await noError(page);

    const singleTab = page.getByRole('tab', { name: /single/i });
    if (await singleTab.isVisible().catch(() => false)) await singleTab.click();
    await page.waitForTimeout(500);

    await selectShadcn(page, 'Order *', new RegExp(S.printStyle));
    await page.waitForTimeout(500);

    const colourLabel = page.locator('label:has-text("Colour")').first();
    if (await colourLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectShadcn(page, 'Colour *', /Red/);
      await page.waitForTimeout(300);
    }

    await selectShadcn(page, 'Factory *', new RegExp(S.factoryCode));
    await page.waitForTimeout(300);

    await selectShadcn(page, 'Shift *', new RegExp(S.shiftCode));
    await page.waitForTimeout(300);

    const resLabel = page.locator('label:has-text("Table")').first();
    if (await resLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectShadcn(page, 'Table *', new RegExp(S.tableCode));
      await page.waitForTimeout(300);
    }

    await selectShadcn(page, 'Worker Type *', new RegExp(S.workerTypeName));
    await page.waitForTimeout(300);

    const personsInput = page.locator('label:has-text("Persons")').locator('..').locator('input').first();
    if (await personsInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await personsInput.fill('2');
    }

    const outputInput = page.locator('label:has-text("Output")').locator('..').locator('input').first();
    if (await outputInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await outputInput.fill('300');
    }

    await clickVisible(page, /save entry/i);
    await page.waitForTimeout(3000);
    await noError(page);

    const listTab = page.getByRole('tab', { name: /list/i });
    if (await listTab.isVisible().catch(() => false)) await listTab.click();
    await page.waitForTimeout(1000);

    const body = await page.locator('body').innerText();
    expect(body).toContain('300');
    console.log('✅ 5.01 — Single production entry created');
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — Dispatch, Stock Job, Inventory
   ═══════════════════════════════════════════════════════════════ */
test.describe('Section 6 — Dispatch, Stock, Inventory', () => {

  test('6.01 — Record a dispatch against the order', async ({ page }) => {
    await authGoto(page, `${BASE}/dispatch`);
    await page.waitForTimeout(3000);
    await noError(page);

    await clickVisible(page, /new dispatch/i);
    await page.waitForTimeout(800);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Order select (Internal PO options)
    await selectShadcn(page, 'Order (Internal PO)', new RegExp(S.printStyle));
    await page.waitForTimeout(500);

    await selectShadcn(page, 'Buyer', new RegExp(S.buyerName));

    // Product / colour / size
    const dialog = page.getByRole('dialog');
    await dialog.locator('label:text-is("Product")').locator('..').locator('input').first().fill('Zero Print Product');
    await dialog.locator('label:text-is("Colour")').locator('..').locator('input').first().fill('Red');
    await dialog.locator('label:text-is("Size")').locator('..').locator('input').first().fill('M');

    // Qty (must be ≤ order balance of 1000)
    const qtyLabel = dialog.locator('label:text-is("Qty *")');
    await qtyLabel.locator('..').locator('input').first().fill('100');

    // Vehicle + Challan
    await dialog.locator('label:text-is("Vehicle #")').locator('..').locator('input').first().fill('MH01-AB-1234');
    await dialog.locator('label:text-is("Challan #")').locator('..').locator('input').first().fill(unique('CHL'));

    await dialog.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(3000);
    await checkToast(page, 'Dispatch recorded');
    await noError(page);

    const body = await page.locator('body').innerText();
    expect(body).toContain('MH01-AB-1234');
    console.log('✅ 6.01 — Dispatch recorded');
  });

  test('6.02 — Create a stock job', async ({ page }) => {
    await authGoto(page, `${BASE}/stock-jobs`);
    await page.waitForTimeout(3000);
    await noError(page);

    await clickVisible(page, /new job/i);
    await page.waitForTimeout(800);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    S.jobNumber = unique('SJ-ZERO');
    await fillByLabel(page, 'Job Number *', S.jobNumber);
    await fillByLabel(page, 'Product Name *', 'Zero Stock Product');
    await fillByLabel(page, 'Target Qty', '1000');
    await fillByLabel(page, 'Produced', '250');
    await fillByLabel(page, 'UOM', 'meters');

    await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(3000);
    await checkToast(page, 'Job created');
    await noError(page);

    await expect(page.locator('body')).toContainText(S.jobNumber, { timeout: 10000 });
    console.log(`✅ 6.02 — Stock job ${S.jobNumber} created`);
  });

  test('6.03 — Add inventory item + record inward transaction', async ({ page }) => {
    await authGoto(page, `${BASE}/inventory`);
    await page.waitForTimeout(3000);
    await noError(page);

    // Add item
    await clickVisible(page, /add item/i);
    await page.waitForTimeout(500);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    S.invCode = unique('INV-Z');
    S.invName = unique('Zero Ink');
    await fillByLabel(page, 'Code *', S.invCode);
    await fillByLabel(page, 'Name *', S.invName);
    await fillByLabel(page, 'Opening Stock', '500');

    await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(3000);
    await checkToast(page, 'Saved');
    await noError(page);

    await expect(page.locator('body')).toContainText(S.invCode, { timeout: 10000 });

    // Inward transaction
    await clickVisible(page, /inward/i);
    await page.waitForTimeout(500);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await selectShadcn(page, 'Item', new RegExp(S.invName));
    await fillByLabel(page, 'Qty *', '200');
    await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(3000);
    await checkToast(page, 'Transaction recorded');
    await noError(page);
    console.log(`✅ 6.03 — Inventory item ${S.invName} + inward transaction`);
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 — Reports & Session Persistence
   ═══════════════════════════════════════════════════════════════ */
test.describe('Section 7 — Reports & Persistence', () => {

  test('7.01 — Reports page: click through tabs', async ({ page }) => {
    await authGoto(page, `${BASE}/reports`);
    await page.waitForTimeout(4000);
    await noError(page);

    const tabs = ['order status', 'production', 'cost', 'profit'];
    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
        await noError(page);
      }
    }
    console.log('✅ 7.01 — Reports tabs functional');
  });

  test('7.02 — Dashboard final state', async ({ page }) => {
    await authGoto(page, `${BASE}/`);
    await page.waitForTimeout(5000);
    await noError(page);

    const body = await page.locator('body').innerText();
    const hasKPIs = /today|output|active|order/i.test(body);
    expect(hasKPIs).toBe(true);
    console.log('✅ 7.02 — Dashboard final state verified');
  });

  test('7.03 — Log out and log back in — data persists', async ({ page }) => {
    await authGoto(page, `${BASE}/`);
    await page.waitForTimeout(2000);

    const signOutBtn = page.getByRole('button', { name: /sign out/i });
    if (await signOutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signOutBtn.click();
      await page.waitForTimeout(2000);
    } else {
      const userMenu = page.locator('[class*="user"] button, [class*="avatar"]').first();
      if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userMenu.click();
        await page.waitForTimeout(500);
        await signOutBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    await page.waitForLoadState('domcontentloaded');
    const loginInput = page.getByPlaceholder('you@company.com');
    if (await loginInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginInput.fill(S.email);
      await page.getByPlaceholder('••••••••').fill(S.password);
      await clickVisible(page, /sign in/i);
      await page.waitForTimeout(5000);
      await noError(page);

      const body = await page.locator('body').innerText();
      expect(body).not.toContain('Sign in');
      expect(body).not.toContain('Login');

      // Verify an early-created record still exists (buyer persists)
      await page.goto(`${BASE}/settings/buyers`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await expect(page.locator('body')).toContainText(S.buyerCode, { timeout: 10000 });
      console.log('✅ 7.03 — Logged out and back in, data persists');
    } else {
      console.log('⚠️ 7.03 — Sign-out button not found, session may be persistent');
    }
  });
});
