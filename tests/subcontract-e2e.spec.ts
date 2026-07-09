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

  // Create a subcontract job via admin
  const jobId = crypto.randomUUID();
  S.jobId = jobId;
  S.jobNum = `SC-${unique('TEST')}`;
  await admin.from('subcontract_jobs').insert({
    id: jobId, company_id: companyId, job_number: S.jobNum,
    process: 'printing', product_description: unique('Test Fabric'),
    qty_sent: 500, qty_received: 0, rate: 12.50,
    send_date: new Date().toISOString().slice(0, 10),
    status: 'sent',
  });
});

test.afterAll(async () => {
  const admin = getSupabaseAdmin();
  try { if (S.jobId) await admin.from('subcontract_jobs').delete().eq('id', S.jobId); } catch {}
});

test('SC-01 subcontract jobs page loads with list view', async ({ page }) => {
  await authGoto(page, `${BASE}/subcontract-jobs`);
  await page.waitForTimeout(5000);
  await noError(page);
  await expect(page.locator('h1')).toContainText('Subcontract Jobs');
  await expect(page.getByRole('button', { name: /new job/i })).toBeVisible();
});

test('SC-02 existing job appears in list', async ({ page }) => {
  await authGoto(page, `${BASE}/subcontract-jobs`);
  await page.waitForTimeout(8000);
  await noError(page);
  const row = page.locator('table tbody tr').filter({ hasText: S.jobNum });
  await expect(row.first()).toBeVisible({ timeout: 15000 });
  await expect(row.first()).toContainText('sent');
});

test('SC-03 create a new subcontract job via dialog', async ({ page }) => {
  await authGoto(page, `${BASE}/subcontract-jobs`);
  await page.waitForTimeout(8000);
  await noError(page);

  await page.getByRole('button', { name: /new job/i }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  const numInput = page.locator('[role="dialog"] input').first();
  await numInput.fill(unique('SC-NEW'));

  const qtyInput = page.locator('[role="dialog"] input[type="number"]').first();
  await qtyInput.fill('200');

  await page.getByRole('button', { name: /save/i }).click();
  await page.waitForTimeout(3000);
  await noError(page);
});

test('SC-04 sidebar navigates to subcontract page', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(2000);
  const link = page.locator('a').filter({ hasText: 'Subcontract' });
  await link.click();
  await page.waitForURL(/\/subcontract-jobs/, { timeout: 10000 });
  await page.waitForTimeout(1000);
  await noError(page);
  await expect(page.locator('h1')).toContainText('Subcontract Jobs');
});

test('SC-05 dashboard shows subcontract KPI', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(5000);
  await noError(page);
  await expect(page.locator('main').getByText('Subcontract')).toBeVisible();
});
