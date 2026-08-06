import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8080';

async function selectComboboxOption(page: any, labelText: string) {
  const label = page.locator('label').filter({ hasText: new RegExp(labelText, 'i') }).first();
  const container = label.locator('..');
  const trigger = container.locator('[role="combobox"]');
  await trigger.waitFor({ state: 'visible', timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(500);
  const option = page.getByRole('option').first();
  await option.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

test.describe('Bug fix verification', () => {

  test('Bug 1: Printing Order save with internalPO', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      const t = msg.text();
      if (t.includes('DEBUG') || t.includes('error') || t.includes('ERRO')) logs.push(t);
    });

    await page.goto(`${BASE}/printing-orders`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const testStyle = `E2E-STYLE-${Date.now()}`;

    await page.getByRole('button', { name: /new order/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');
    const allInputs = dialog.locator('input');

    const internalPO = await allInputs.first().inputValue();
    console.log(`Internal PO: ${internalPO}`);

    await allInputs.nth(1).fill('BUYER-PO-E2E');

    await selectComboboxOption(page, 'Customer');

    await allInputs.nth(2).fill(testStyle);

    await selectComboboxOption(page, 'Product');

    await selectComboboxOption(page, 'Fabric');

    await dialog.locator('input[type="number"]').first().fill('500');

    await dialog.getByRole('button', { name: /save order/i }).click();
    await page.waitForTimeout(3000);

    for (const l of logs) console.log('BROWSER:', l);

    const toast = page.locator('[data-sonner-toast]');
    if (await toast.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('TOAST:', await toast.innerText());
    }

    await page.waitForTimeout(2000);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const searchBox = page.getByPlaceholder(/search/i);
    if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchBox.fill(internalPO);
      await page.waitForTimeout(2000);
    }

    let found = await page.locator('table').locator(`text=${internalPO}`).isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Found by PO search: ${found}`);

    expect(found).toBe(true);
  });

  test('Bug 2: BOM save with total_amount', async ({ page }) => {
    await page.goto(`${BASE}/bom`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const testTitle = `E2E-BOM-${Date.now()}`;

    await page.getByRole('button', { name: /new bom/i, exact: false }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');

    const titleInput = dialog.locator('input, [contenteditable]').first();
    await titleInput.fill(testTitle);

    const saveBtn = dialog.getByRole('button', { name: /save/i });
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
    } else {
      await dialog.getByRole('button', { name: /create/i }).click();
    }

    await page.waitForTimeout(3000);

    const toast = page.locator('[data-sonner-toast]');
    if (await toast.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('BOM TOAST:', await toast.innerText());
    }

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const found = await page.locator(`text=${testTitle}`).isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`BOM "${testTitle}" found: ${found}`);

    expect(found).toBe(true);
  });

  // Bug 3 (Stock Job end-date clear) is covered with a real assertion in bug-verify.spec.ts —
  // this file previously had a duplicate of that test whose only assertion was expect(true).toBe(true).

});
