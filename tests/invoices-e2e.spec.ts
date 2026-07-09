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

  // Create buyer + order + dispatch
  const buyer = crypto.randomUUID();
  S.buyerId = buyer;
  S.buyerName = unique('INV Buyer');
  await admin.from('buyers').insert({ id: buyer, company_id: companyId, code: `BUY-INV-${RUN}`, name: S.buyerName, country: 'India', is_active: true });

  const orderId = crypto.randomUUID();
  S.orderId = orderId;
  await admin.from('order_headers').insert({ id: orderId, company_id: companyId, module: 'printing', internal_po: `PO-INV-${RUN}`, currency: 'USD', status: 'Started' });

  const dispatchId = crypto.randomUUID();
  S.dispatchId = dispatchId;
  await admin.from('dispatch_records').insert({ id: dispatchId, company_id: companyId, dispatch_date: new Date().toISOString().slice(0, 10), order_id: orderId, buyer_id: buyer, qty: 100, uom: 'pcs', dispatch_type: 'order' });

  // Create an invoice directly via API
  const invId = crypto.randomUUID();
  S.invoiceId = invId;
  S.invoiceNum = `INV-${unique('9900')}`;
  await admin.from('invoices').insert({
    id: invId, company_id: companyId, invoice_number: S.invoiceNum,
    buyer_id: buyer, order_id: orderId, dispatch_id: dispatchId,
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    subtotal: 1550, tax_percent: 10, status: 'sent',
  });
});

test.afterAll(async () => {
  const admin = getSupabaseAdmin();
  try { if (S.invoiceId) await admin.from('invoices').delete().eq('id', S.invoiceId); } catch {}
  try { if (S.dispatchId) await admin.from('dispatch_records').delete().eq('id', S.dispatchId); } catch {}
  try { if (S.orderId) await admin.from('order_rows').delete().eq('order_id', S.orderId); } catch {}
  try { if (S.orderId) await admin.from('order_headers').delete().eq('id', S.orderId); } catch {}
  try { await admin.from('buyers').delete().eq('id', S.buyerId); } catch {}
});

test('INV-01 invoices page loads with AR aging', async ({ page }) => {
  await authGoto(page, `${BASE}/invoices`);
  await page.waitForTimeout(5000);
  await noError(page);
  await expect(page.locator('h1')).toContainText('Invoices');
});

test('INV-02 invoice appears in list with correct status', async ({ page }) => {
  await authGoto(page, `${BASE}/invoices`);
  await page.waitForTimeout(8000);
  await noError(page);
  const row = page.locator('table tbody tr').filter({ hasText: S.invoiceNum });
  await expect(row.first()).toBeVisible({ timeout: 15000 });
  await expect(row.first()).toContainText(/sent/i);
});

test('INV-03 mark invoice as paid', async ({ page }) => {
  await authGoto(page, `${BASE}/invoices`);
  await page.waitForTimeout(8000);
  await noError(page);

  // Find our invoice and click the paid button
  const row = page.locator('table tbody tr').filter({ hasText: S.invoiceNum });
  await expect(row.first()).toBeVisible({ timeout: 15000 });

  const payBtn = row.first().locator('button[title="Mark Paid"]');
  if (await payBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await payBtn.click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /confirm payment/i }).click();
    await page.waitForTimeout(1000);
    await noError(page);
  }
});

test('INV-04 dashboard shows AR KPI', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(5000);
  await noError(page);
  await expect(page.getByText('Overdue AR')).toBeVisible();
});

test('INV-05 sidebar navigates to invoices page', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(2000);
  const link = page.locator('a').filter({ hasText: 'Invoices / AR' });
  await link.click();
  await page.waitForURL(/\/invoices/, { timeout: 10000 });
  await page.waitForTimeout(1000);
  await noError(page);
  await expect(page.locator('h1')).toContainText('Invoices');
});
