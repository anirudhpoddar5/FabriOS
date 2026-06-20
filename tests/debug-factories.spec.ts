import { test, expect } from '@playwright/test';

const BASE = 'https://fabrios.pages.dev';
const AUTH_FILE = 'test-results/steelman-auth.json';

test.use({ storageState: AUTH_FILE });

test('debug factories page', async ({ page }) => {
  await page.goto(`${BASE}/settings/factories-shifts`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/debug-factories.png', fullPage: true });
  const url = page.url();
  const bodyText = await page.locator('body').innerText().catch(() => 'BODY-NOT-FOUND');
  const h1Text = await page.locator('h1').first().innerText().catch(() => 'NO-H1');
  console.log('URL:', url);
  console.log('H1:', h1Text);
  console.log('Body:', bodyText.substring(0, 1000));
  await expect(page.getByRole('heading', { name: /factories/i })).toBeVisible({ timeout: 10000 });
});
