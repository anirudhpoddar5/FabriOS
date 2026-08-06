import { expect, Page, test } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './helpers';

const RUN_ID = Date.now().toString(36).toUpperCase();

type RuntimeWatch = {
  errors: string[];
  assertClean: () => void;
};

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
        !/favicon|ResizeObserver loop|Download the React DevTools|Failed to load resource: the server responded with a status of 400/i.test(message)
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
  await page.waitForTimeout(1_200);

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
    await page.waitForTimeout(1_200);
  }

  if (await page.getByText('Select your workspace').isVisible({ timeout: 1_500 }).catch(() => false)) {
    await page.getByText('Both').click();
    await page.waitForTimeout(1_000);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1_200);
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

async function inputByLabel(scope: Page | ReturnType<Page['locator']>, labelText: string) {
  const label = scope.locator('label').filter({ hasText: new RegExp(`^${labelText}`, 'i') }).first();
  await label.waitFor({ state: 'visible', timeout: 10_000 });
  return label.locator('..').locator('input, textarea').first();
}

async function selectFirstOption(page: Page, scope: Page | ReturnType<Page['locator']>, labelText: string) {
  const label = scope.locator('label').filter({ hasText: new RegExp(`^${labelText}`, 'i') }).first();
  await label.waitFor({ state: 'visible', timeout: 10_000 });
  await label.locator('..').locator('[role="combobox"]').first().click({ force: true });
  await page.waitForTimeout(300);
  const option = page
    .getByRole('option')
    .filter({ hasNotText: /^(None|No |Loading|Select)/i })
    .first();
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

async function selectOption(page: Page, trigger: ReturnType<Page['locator']>, option: string | RegExp) {
  await trigger.click({ force: true });
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: option }).first().click();
}

async function expectToastOrVisible(page: Page, successText: RegExp, fallbackText: string | RegExp) {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: successText }).first();
  const toastVisible = await toast.isVisible({ timeout: 8_000 }).catch(() => false);
  if (!toastVisible) {
    await expect(page.locator('body')).toContainText(fallbackText, { timeout: 10_000 });
  }
}

async function expectToast(page: Page, pattern: RegExp, timeout = 15_000) {
  await expect(page.locator('[data-sonner-toast]').first()).toContainText(pattern, { timeout });
}

test.describe('SteelM Industries user audit', () => {
  test('@readonly core modules load and show the controls an operator needs', async ({ page }) => {
    test.setTimeout(180_000);
    const runtime = watchRuntime(page);
    const pages = [
      { path: '/', text: /Today's Output|Active Orders|Quick Actions/ },
      { path: '/printing-orders', text: /Printing Orders|New Order|Search orders/ },
      { path: '/stitching-orders', text: /Stitching Orders|New Order|Search orders/ },
      { path: '/entries', text: /Production Entries|Single Entry|Office Grid|Entry List/ },
      { path: '/stock-jobs', text: /Stock Jobs|New Job|Search jobs/ },
      { path: '/dispatch', text: /Dispatch & Shipping|New Dispatch|Search dispatches/ },
      { path: '/bom', text: /BOM & Purchase|Order BOM|General Purchase/ },
      { path: '/purchase-orders', text: /Purchase Orders|New PO|Search POs/ },
      { path: '/grn', text: /Goods Receipt|New GRN|Search GRNs/ },
      { path: '/inventory', text: /Inventory|Stock On Hand|Transactions/ },
      { path: '/reports', text: /Reports|Order Status|Profit\/Loss/ },
      { path: '/settings/companies', text: /Company|Search/ },
      { path: '/settings/factories-shifts', text: /Factories & Shifts|Factory|Shift/ },
      { path: '/settings/workers', text: /Workers|Search/ },
      { path: '/settings/workers-rates', text: /Workers & Rates|Rate Masters/ },
      { path: '/settings/buyers', text: /Buyer|Bulk Add|Search/ },
      { path: '/settings/fabrics', text: /Fabric|Bulk Add|Search/ },
      { path: '/settings/printing-products', text: /Printing Product|Bulk Add|Search/ },
      { path: '/settings/stitching-products', text: /Stitching Product|Search/ },
      { path: '/settings/printing-tables', text: /Printing Table|Bulk Add|Search/ },
      { path: '/settings/stitching-lines', text: /Stitching Line|Bulk Add|Search/ },
      { path: '/settings/vendors', text: /Vendors|New Vendor|Search vendors/ },
      { path: '/settings/users', text: /Users|Approval|Role/ },
    ];

    for (const target of pages) {
      await test.step(`load ${target.path}`, async () => {
        await gotoApp(page, target.path);
        await expect(page.locator('body')).toContainText(target.text, { timeout: 15_000 });
        await assertNoUserFacingErrors(page);
      });
    }

    runtime.assertClean();
  });

  test('@readonly dashboard exposes factory, order health, and production urgency signals', async ({ page }) => {
    const runtime = watchRuntime(page);
    await gotoApp(page, '/');

    await expect(page.locator('body')).toContainText(/Today's Output/);
    await expect(page.locator('body')).toContainText(/Active Orders/);
    await expect(page.locator('body')).toContainText(/Factory:/);
    await expect(page.locator('body')).toContainText(/In Production|Order Visibility Board|No active orders/);
    await expect(page.locator('body')).toContainText(/Late|At Risk|Not Started|On Track|Quick Actions/);
    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@mutating printing order lifecycle saves a header, item row, and multiple colourways', async ({ page }) => {
    const runtime = watchRuntime(page);
    await gotoApp(page, '/printing-orders');

    await page.getByRole('button', { name: /new order/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const internalPO = await (await inputByLabel(dialog, 'Internal PO')).inputValue();
    await (await inputByLabel(dialog, 'Buyer PO')).fill(`BUY-PO-${RUN_ID}`);
    await selectFirstOption(page, dialog, 'Customer');
    await (await inputByLabel(dialog, 'Style / Design')).fill(`AUDIT-PRINT-${RUN_ID}`);

    await selectFirstOption(page, dialog, 'Product');
    await selectFirstOption(page, dialog, 'Fabric');
    await (await inputByLabel(dialog, 'Order Qty')).fill('120');
    await (await inputByLabel(dialog, 'Chart Qty')).fill('120');
    await (await inputByLabel(dialog, 'Rate/Item')).fill('4.5');

    const colourRows = dialog.locator('table tbody tr');
    await colourRows.first().locator('input').nth(0).fill('Audit Red');
    await colourRows.first().locator('input[type="number"]').first().fill('70');
    await dialog.getByRole('button', { name: /add colour/i }).click();
    await colourRows.nth(1).locator('input').nth(0).fill('Audit Blue');
    await colourRows.nth(1).locator('input[type="number"]').first().fill('50');

    await dialog.getByRole('button', { name: /save order/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.getByPlaceholder('Search orders...').fill(internalPO);
    await expect(page.locator('table')).toContainText(internalPO, { timeout: 10_000 });
    await page.locator('table tbody tr').filter({ hasText: internalPO }).first().click();
    await expect(page).toHaveURL(/\/printing-orders\/[0-9a-f-]+/i);
    await expect(page.locator('body')).toContainText(/Audit Red|Audit Blue/, { timeout: 10_000 });
    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@mutating stitching order lifecycle creates an order with size/colour breakdown', async ({ page }) => {
    const runtime = watchRuntime(page);
    await gotoApp(page, '/stitching-orders');

    await page.getByRole('button', { name: /new order/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const internalPO = await (await inputByLabel(dialog, 'Internal PO')).inputValue();
    await (await inputByLabel(dialog, 'Buyer PO')).fill(`ST-BUY-${RUN_ID}`);
    await selectFirstOption(page, dialog, 'Customer');
    await (await inputByLabel(dialog, 'Style / Design')).fill(`AUDIT-STITCH-${RUN_ID}`);
    await selectFirstOption(page, dialog, 'Product');
    await (await inputByLabel(dialog, 'Order Qty')).fill('80');
    await (await inputByLabel(dialog, 'Chart Qty')).fill('80');
    await (await inputByLabel(dialog, 'Rate/Item')).fill('3.25');

    const colourRows = dialog.locator('table tbody tr');
    if (await colourRows.count() === 0) {
      await dialog.getByRole('button', { name: /^add$/i }).click();
    }
    await colourRows.first().locator('input').nth(0).fill('Navy');
    await colourRows.first().locator('input[type="number"]').first().fill('80');
    await colourRows.first().locator('input').nth(3).fill('M');

    await dialog.getByRole('button', { name: /save order/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 20_000 });
    await expectToastOrVisible(page, /Order created/i, internalPO);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.getByPlaceholder('Search orders...').fill(internalPO);
    await expect(page.locator('table')).toContainText(internalPO, { timeout: 10_000 });
    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@mutating stock job create, status change, and cleared end date persist', async ({ page }) => {
    const runtime = watchRuntime(page);
    const jobNumber = `SJ-AUDIT-${RUN_ID}`;
    await gotoApp(page, '/stock-jobs');

    await page.getByRole('button', { name: /new job/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await (await inputByLabel(dialog, 'Job Number')).fill(jobNumber);
    await (await inputByLabel(dialog, 'Product Name')).fill(`Audit Stock Product ${RUN_ID}`);
    await (await inputByLabel(dialog, 'Target Qty')).fill('200');
    await (await inputByLabel(dialog, 'Produced')).fill('25');
    await (await inputByLabel(dialog, 'UOM')).fill('meters');
    await (await inputByLabel(dialog, 'End Date')).fill('2026-09-30');
    await dialog.getByRole('button', { name: /^save$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    await expectToastOrVisible(page, /Job created/i, jobNumber);

    await page.getByPlaceholder('Search jobs...').fill(jobNumber);
    await expect(page.locator('table')).toContainText(jobNumber, { timeout: 10_000 });
    await page.locator('table tbody tr').filter({ hasText: jobNumber }).locator('button').filter({ has: page.locator('.lucide-pencil') }).click();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await (await inputByLabel(dialog, 'End Date')).clear();
    await selectOption(page, dialog.locator('label').filter({ hasText: /^Status/i }).locator('..').locator('[role="combobox"]').first(), /In Progress/i);
    await dialog.getByRole('button', { name: /^save$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    await expectToastOrVisible(page, /Job updated/i, jobNumber);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.getByPlaceholder('Search jobs...').fill(jobNumber);
    await page.locator('table tbody tr').filter({ hasText: jobNumber }).locator('button').filter({ has: page.locator('.lucide-pencil') }).click();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(await (await inputByLabel(dialog, 'End Date')).inputValue()).toBe('');
    await expect(dialog).not.toContainText(/End date cannot/i);
    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@mutating BOM can be created with a vendor line and converted to purchase orders', async ({ page }) => {
    const runtime = watchRuntime(page);
    const title = `AUDIT-BOM-${RUN_ID}`;
    await gotoApp(page, '/bom');

    await page.getByRole('tab', { name: /general purchase/i }).click();
    await page.getByRole('button', { name: /new bom/i }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /New BOM/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await (await inputByLabel(dialog, 'Title')).fill(title);
    await dialog.getByRole('button', { name: /add line/i }).click();
    const line = dialog.locator('table tbody tr').first();
    await line.locator('input').nth(0).fill(`Audit fabric ${RUN_ID}`);
    await line.locator('input').nth(1).fill('meters');
    await line.locator('input[type="number"]').nth(0).fill('30');
    await line.locator('input[type="number"]').nth(1).fill('5');
    await line.locator('input[type="number"]').nth(2).fill('12');
    await line.locator('[role="combobox"]').last().click();
    await page.getByRole('option').filter({ hasNotText: /^None$/i }).first().click();

    await dialog.getByRole('button', { name: /save bom/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    await expectToastOrVisible(page, /BOM created/i, title);
    await expect(page.locator('body')).toContainText(title, { timeout: 10_000 });

    await page.locator('table tbody tr').filter({ hasText: title }).locator('button').filter({ has: page.locator('.lucide-pencil') }).click();
    const editDialog = page.getByRole('dialog').filter({ hasText: /Edit BOM/i });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });
    await editDialog.getByRole('button', { name: /generate pos/i }).click();
    const poDialog = page.getByRole('dialog').filter({ hasText: /Generate Purchase Orders/i });
    await expect(poDialog).toBeVisible({ timeout: 10_000 });
    await poDialog.getByRole('button', { name: /create .*po/i }).click();
    await expectToast(page, /Purchase Orders generated|not found|must have a vendor|was not saved|error/i, 20_000);
    const generationFailed = await page.locator('[data-sonner-toast]').filter({ hasText: /not found|must have a vendor|was not saved|error/i }).isVisible().catch(() => false);
    expect(generationFailed, 'BOM line should generate a PO without vendor/save errors').toBe(false);
    await expect(poDialog).not.toBeVisible({ timeout: 20_000 });

    await gotoApp(page, '/purchase-orders');
    await expect(page.locator('body')).toContainText(/From BOM|PO-/, { timeout: 10_000 });
    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@mutating manual purchase order can be created and opened for receiving', async ({ page }) => {
    const runtime = watchRuntime(page);
    const poNumber = `PO-AUDIT-${RUN_ID}`;
    await gotoApp(page, '/purchase-orders');

    await page.getByRole('button', { name: /new po/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await (await inputByLabel(dialog, 'PO Number')).fill(poNumber);
    await selectFirstOption(page, dialog, 'Vendor');
    const line = dialog.locator('table tbody tr').first();
    await line.locator('input').nth(0).fill(`Audit trim ${RUN_ID}`);
    await line.locator('input').nth(1).fill('pcs');
    await line.locator('input[type="number"]').nth(0).fill('100');
    await line.locator('input[type="number"]').nth(1).fill('2');
    await dialog.getByRole('button', { name: /create po/i }).click();
    await expectToast(page, /PO created|Purchase order was not saved|error/i, 15_000);
    const poFailed = await page.locator('[data-sonner-toast]').filter({ hasText: /was not saved|error/i }).isVisible().catch(() => false);
    expect(poFailed, 'Manual PO should save without backend errors').toBe(false);
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Search POs...').fill(poNumber);
    const row = page.locator('table tbody tr').filter({ hasText: poNumber }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByRole('button', { name: /receive/i })).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/\/purchase-orders\/[0-9a-f-]+/i);
    await expect(page.locator('body')).toContainText(poNumber);
    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@readonly production entry form shows rate/cost controls and bulk grids render', async ({ page }) => {
    const runtime = watchRuntime(page);
    await gotoApp(page, '/entries');

    await page.getByRole('tab', { name: /single entry/i }).click();
    await expect(page.locator('body')).toContainText(/Rate:/);
    await expect(page.locator('body')).toContainText(/Cost:/);
    await selectFirstOption(page, page, 'Factory');
    await selectFirstOption(page, page, 'Order');
    await page.waitForTimeout(1_000);
    const colourTrigger = page.locator('label').filter({ hasText: /^Colour/i }).locator('..').locator('[role="combobox"]').first();
    if (await colourTrigger.isEnabled().catch(() => false)) {
      await selectFirstOption(page, page, 'Colour');
    }
    await selectFirstOption(page, page, 'Shift');
    await selectFirstOption(page, page, 'Table');
    await selectFirstOption(page, page, 'Worker Type');
    await (await inputByLabel(page, 'Persons Used')).fill('2');
    await (await inputByLabel(page, 'Output Qty')).fill('10');
    await expect(page.locator('body')).toContainText(/Rate:|No active rate/);
    await expect(page.locator('body')).toContainText(/Cost:/);

    await page.getByRole('tab', { name: /quick entry/i }).click();
    await expect(page.locator('body')).toContainText(/Quick Entry|Paste|Save|Rows|Order/i);
    await page.getByRole('tab', { name: /office grid/i }).click();
    await expect(page.locator('body')).toContainText(/Office Grid|Paste|Save|Rows|Order/i);
    await page.getByRole('tab', { name: /entry list/i }).click();
    await expect(page.locator('body')).toContainText(/Entry List|Search|Date|Output/i);
    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@readonly reports, filters, exports, and order bulk selection do not break live data views', async ({ page }) => {
    const runtime = watchRuntime(page);
    await gotoApp(page, '/reports');

    const reportTabs = ['Order Status', 'Production', 'Delayed', 'Dispatch', 'PO Status', 'Stock On Hand', 'Profit/Loss'];
    for (const label of reportTabs) {
      await page.getByRole('tab', { name: label }).click();
      await expect(page.locator('body')).toContainText(/CSV|Excel|PDF|No data|Total/i, { timeout: 10_000 });
      await assertNoUserFacingErrors(page);
    }

    await gotoApp(page, '/printing-orders');
    await page.getByPlaceholder('Search orders...').fill('NO-SUCH-ORDER-FOR-AUDIT');
    await expect(page.locator('body')).toContainText(/No orders found/);
    await page.getByPlaceholder('Search orders...').clear();
    await page.waitForTimeout(500);
    const headerCheckbox = page.locator('table thead input[type="checkbox"]').first();
    await headerCheckbox.check({ force: true });
    await expect(page.locator('body')).toContainText(/selected/);
    await assertNoUserFacingErrors(page);
    runtime.assertClean();
  });

  test('@readonly mobile viewport keeps high-use screens reachable', async ({ page }) => {
    const runtime = watchRuntime(page);
    await page.setViewportSize({ width: 375, height: 667 });
    for (const path of ['/', '/printing-orders', '/entries', '/stock-jobs', '/inventory', '/reports']) {
      await gotoApp(page, path);
      await assertNoUserFacingErrors(page);
      await expect(page.locator('body')).not.toHaveText('');
    }
    runtime.assertClean();
  });
});
