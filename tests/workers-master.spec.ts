import { test, expect, Page } from '@playwright/test';
import { getSupabaseAdmin, selectOption, clickButton, fillField } from './helpers';

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

  // Create a factory for worker assignments
  const f1 = crypto.randomUUID();
  S.factoryId = f1;
  S.factoryName = unique('WM Factory');
  await admin.from('factories').insert({
    id: f1, company_id: companyId, code: `FAC-WM-${RUN}`, name: S.factoryName, type: 'mixed', is_active: true,
  });

  // Create a worker type for worker assignments
  const wt = crypto.randomUUID();
  S.workerTypeId = wt;
  S.workerTypeName = unique('WM Worker Type');
  await admin.from('worker_types').insert({
    id: wt, company_id: companyId, name: S.workerTypeName, module: 'both', is_active: true,
  });
});

test.afterAll(async () => {
  const admin = getSupabaseAdmin();
  try { if (S.workerId) await admin.from('workers').delete().eq('id', S.workerId); } catch {}
  try { await admin.from('worker_types').delete().eq('id', S.workerTypeId); } catch {}
  try { await admin.from('factories').delete().eq('id', S.factoryId); } catch {}
});

test('WM-01 workers page loads with correct table columns', async ({ page }) => {
  await authGoto(page, `${BASE}/settings/workers`);
  await page.waitForTimeout(1000);
  await noError(page);

  await expect(page.locator('h1')).toContainText('Workers');
  await expect(page.getByRole('button', { name: /add/i })).toBeVisible();
  await expect(page.locator('input[placeholder="Search..."]')).toBeVisible();

  // Verify table headers
  const ths = page.locator('table thead th');
  await expect(ths.nth(0)).toContainText('Code');
  await expect(ths.nth(1)).toContainText('Name');
  await expect(ths.nth(2)).toContainText('Factory');
  await expect(ths.nth(3)).toContainText('Worker Type');
  await expect(ths.nth(4)).toContainText('Hourly Rate');
});

test('WM-02 create worker via UI and verify it appears in table', async ({ page }) => {
  await authGoto(page, `${BASE}/settings/workers`);
  await page.waitForTimeout(1000);
  await noError(page);

  const workerCode = unique('W001');
  const workerName = unique('Test Worker');

  // Open add dialog
  await page.getByRole('button', { name: /add/i }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Fill employee code
  const codeInput = page.locator('[role="dialog"] input').first();
  await codeInput.fill(workerCode);

  // Fill name (second input in first grid row)
  const nameInput = page.locator('[role="dialog"] input').nth(1);
  await nameInput.fill(workerName);

  // Select factory
  await page.locator('[role="dialog"]').locator('text=Factory').locator('..').locator('[role="combobox"]').click();
  await page.waitForTimeout(300);
  await page.locator(`[role="option"]:has-text("${S.factoryName}")`).click();
  await page.waitForTimeout(200);

  // Select worker type
  const wtCombobox = page.locator('[role="dialog"]').locator('text=Worker Type').locator('..').locator('[role="combobox"]');
  await wtCombobox.click();
  await page.waitForTimeout(300);
  await page.locator(`[role="option"]:has-text("${S.workerTypeName}")`).click();
  await page.waitForTimeout(200);

  // Set hourly rate
  const rateInput = page.locator('[role="dialog"] input[type="number"]');
  await rateInput.fill('350');

  // Save
  await page.getByRole('button', { name: /save/i }).click();
  await page.waitForTimeout(1000);
  await noError(page);

  // Verify worker appears in table
  await expect(page.locator('table tbody').locator(`text=${workerCode}`).first()).toBeVisible();
  await expect(page.locator('table tbody').locator(`text=${workerName}`).first()).toBeVisible();

  // Verify hourly rate shows ₹350
  await expect(page.locator('table tbody').locator('text=₹350.00').first()).toBeVisible();

  // Store for cleanup and subsequent tests
  S.workerCode = workerCode;
  S.workerName = workerName;

  // Get worker ID from DB for cleanup
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('workers').select('id').eq('employee_code', workerCode).eq('company_id', companyId).single();
  if (data) S.workerId = data.id;
});

test('WM-03 editing worker name and rate persists correctly', async ({ page }) => {
  await authGoto(page, `${BASE}/settings/workers`);
  await page.waitForTimeout(1000);

  // Find the edit button for our worker
  const workerRow = page.locator('table tbody tr').filter({ hasText: S.workerCode });
  await expect(workerRow.first()).toBeVisible();

  const editBtn = workerRow.first().locator('[class*="h-7 w-7"]');
  await editBtn.click();
  await page.waitForTimeout(500);

  // Change name
  const nameInput = page.locator('[role="dialog"] input').nth(1);
  await nameInput.clear();
  const editedName = unique('Edited Worker');
  await nameInput.fill(editedName);

  // Change hourly rate
  const rateInput = page.locator('[role="dialog"] input[type="number"]');
  await rateInput.clear();
  await rateInput.fill('425');

  await page.getByRole('button', { name: /save/i }).click();
  await page.waitForTimeout(1000);
  await noError(page);

  // Verify edited name in table
  await expect(page.locator('table tbody').locator(`text=${editedName}`).first()).toBeVisible();
  await expect(page.locator('table tbody').locator('text=₹425.00').first()).toBeVisible();
  S.workerName = editedName;
});

test('WM-04 toggling worker active status works', async ({ page }) => {
  await authGoto(page, `${BASE}/settings/workers`);
  await page.waitForTimeout(1000);

  const workerRow = page.locator('table tbody tr').filter({ hasText: S.workerCode });
  await expect(workerRow.first()).toBeVisible();

  // Find the switch in the row
  const switchBtn = workerRow.first().locator('[role="switch"]');
  const isChecked = await switchBtn.isChecked().catch(() => false);

  // Toggle it
  await switchBtn.click();
  await page.waitForTimeout(1000);
  await noError(page);

  // Verify the badge changed
  if (isChecked) {
    await expect(workerRow.first()).toContainText('Inactive');
  } else {
    await expect(workerRow.first()).toContainText('Active');
  }

  // Toggle back
  await switchBtn.click();
  await page.waitForTimeout(1000);
  await noError(page);
});

test('WM-05 search filters workers by name', async ({ page }) => {
  await authGoto(page, `${BASE}/settings/workers`);
  await page.waitForTimeout(1000);

  const searchInput = page.locator('input[placeholder="Search..."]');
  await searchInput.fill(S.workerName);
  await page.waitForTimeout(500);

  // Our worker should be visible
  await expect(page.locator('table tbody').locator(`text=${S.workerCode}`).first()).toBeVisible();

  // Search for nonexistent name
  await searchInput.clear();
  await searchInput.fill('ZZZZ_NONEXISTENT_12345');
  await page.waitForTimeout(500);

  // Table should show "No records found"
  await expect(page.locator('table tbody')).toContainText('No records found');
});

test('WM-06 opening add dialog shows empty form, cancel closes it', async ({ page }) => {
  await authGoto(page, `${BASE}/settings/workers`);
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /add/i }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Text/string inputs are empty (skip number inputs which default to 0)
  const textInputs = page.locator('[role="dialog"] input:not([type="number"])');
  const count = await textInputs.count();
  for (let i = 0; i < count; i++) {
    const val = await textInputs.nth(i).inputValue();
    expect(val).toBe('');
  }
  // Rate input defaults to 0
  const rateInput = page.locator('[role="dialog"] input[type="number"]');
  await expect(rateInput).toHaveValue('0');

  await page.getByRole('button', { name: /cancel/i }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});

test('WM-07 sidebar navigates to workers page without error', async ({ page }) => {
  await authGoto(page, `${BASE}/`);
  await page.waitForTimeout(1000);

  const settingsToggle = page.locator('text=Settings').first();
  await settingsToggle.click().catch(() => {});
  await page.waitForTimeout(300);

  const link = page.locator('a').filter({ hasText: 'Worker Masters' });
  await link.click();
  await page.waitForURL(/\/settings\/workers/, { timeout: 10000 });
  await page.waitForTimeout(500);

  await noError(page);
  await expect(page.locator('h1')).toContainText('Workers');
});
