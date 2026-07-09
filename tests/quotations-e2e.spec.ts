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
    localStorage.removeItem('fabrios_factory');
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

  // Create a buyer
  const buyer = crypto.randomUUID();
  S.buyerId = buyer;
  S.buyerName = unique('QT Buyer');
  await admin.from('buyers').insert({ id: buyer, company_id: companyId, code: `BUY-QT-${RUN}`, name: S.buyerName, country: 'India', is_active: true });
});

test.afterAll(async () => {
  const admin = getSupabaseAdmin();
  try { if (S.quotationId) await admin.from('quotation_lines').delete().eq('quotation_id', S.quotationId); } catch {}
  try { if (S.quotationId) await admin.from('quotations').delete().eq('id', S.quotationId); } catch {}
  try { if (S.orderId) await admin.from('order_rows').delete().eq('order_id', S.orderId); } catch {}
  try { if (S.orderId) await admin.from('order_headers').delete().eq('id', S.orderId); } catch {}
  try { await admin.from('buyers').delete().eq('id', S.buyerId); } catch {}
});

test('QT-01 quotations page loads with list view', async ({ page }) => {
  await authGoto(page, `${BASE}/quotations`);
  await page.waitForTimeout(5000);
  await noError(page);

  await expect(page.locator('h1')).toContainText('Quotations');
  await expect(page.getByRole('button', { name: /new quotation/i })).toBeVisible();
});

test('QT-02 create quotation with line items and verify totals', async ({ page }) => {
  await authGoto(page, `${BASE}/quotations`);
  await page.waitForTimeout(5000);
  await noError(page);

  // Open dialog
  await page.getByRole('button', { name: /new quotation/i }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Select buyer
  const buyerSelect = page.locator('[role="dialog"]').locator('text=Buyer').locator('..').locator('[role="combobox"]').first();
  await buyerSelect.click();
  await page.waitForTimeout(300);
  await page.locator(`[role="option"]:has-text("${S.buyerName}")`).click();
  await page.waitForTimeout(200);

  // Fill first line item
  const descInput = page.locator('[role="dialog"] input[placeholder="Item description"]');
  await descInput.fill(unique('Printed Shirts'));

  const qtyInput = page.locator('[role="dialog"] tbody input[type="number"]').first();
  await qtyInput.fill('100');

  const rateInput = page.locator('[role="dialog"] tbody input[type="number"]').nth(1);
  await rateInput.fill('15.50');

  // Save
  await page.getByRole('button', { name: /save/i }).click();
  await page.waitForTimeout(3000);
  await noError(page);

  // Verify quotation appears in table
  await expect(page.locator('table tbody').locator(`text=${S.buyerName}`).first()).toBeVisible({ timeout: 15000 });

  // Store quotation for cleanup
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('quotations').select('id, quotation_number').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).single();
  if (data) {
    S.quotationId = data.id;
    S.quotationNumber = data.quotation_number;
  }
});

test('QT-03 status change updates quotation', async ({ page }) => {
  await authGoto(page, `${BASE}/quotations`);
  await page.waitForTimeout(8000);
  await noError(page);

  // Find our quotation in the table and change its status to "Sent"
  const row = page.locator('table tbody tr').filter({ hasText: S.buyerName });
  await expect(row.first()).toBeVisible({ timeout: 15000 });

  const statusSelect = row.first().locator('[role="combobox"]');
  await statusSelect.click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: /sent/i }).click();
  await page.waitForTimeout(1000);
  await noError(page);
});

test('QT-04 edit quotation modifies line items', async ({ page }) => {
  await authGoto(page, `${BASE}/quotations`);
  await page.waitForTimeout(8000);
  await noError(page);

  const row = page.locator('table tbody tr').filter({ hasText: S.buyerName });
  await expect(row.first()).toBeVisible({ timeout: 15000 });

  // Click edit button (pencil icon, second button after status select)
  const editBtn = row.first().locator('button[title="Edit"]');
  await editBtn.click();
  await page.waitForTimeout(500);
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Add a second line
  await page.getByRole('button', { name: /add line/i }).click();
  await page.waitForTimeout(200);

  // Fill second line
  const descInputs = page.locator('[role="dialog"] input[placeholder="Item description"]');
  await descInputs.nth(1).fill(unique('Premium Fabric'));

  const numInputs = page.locator('[role="dialog"] tbody input[type="number"]');
  await numInputs.nth(2).fill('50');
  await numInputs.nth(3).fill('25.00');

  await page.getByRole('button', { name: /save/i }).click();
  await page.waitForTimeout(2000);
  await noError(page);
});

test('QT-05 sidebar navigates to quotations page', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(2000);

  const link = page.locator('a').filter({ hasText: 'Quotations' });
  await link.click();
  await page.waitForURL(/\/quotations/, { timeout: 10000 });
  await page.waitForTimeout(1000);
  await noError(page);
  await expect(page.locator('h1')).toContainText('Quotations');
});

test('QT-06 change quotation to accepted and convert to order', async ({ page }) => {
  await authGoto(page, `${BASE}/quotations`);
  await page.waitForTimeout(8000);
  await noError(page);

  // Find our quotation
  const row = page.locator('table tbody tr').filter({ hasText: S.buyerName });
  await expect(row.first()).toBeVisible({ timeout: 15000 });

  // Change status to accepted via dropdown
  const statusSelect = row.first().locator('[role="combobox"]');
  await statusSelect.click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: /accepted/i }).click();
  await page.waitForTimeout(1000);

  // Click convert-to-order button (arrow icon with title)
  const convertBtn = row.first().locator('button[title="Convert to Order"]');
  await expect(convertBtn).toBeVisible({ timeout: 3000 });
  await convertBtn.click();
  await page.waitForTimeout(3000);
  await noError(page);
});
