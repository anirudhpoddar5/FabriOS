import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = 'playwright/.auth/user.json';

const TEST_EMAIL = process.env.FABRIOS_TEST_EMAIL ?? 'steelman@fabrios-demo.com';
const TEST_PASSWORD = process.env.FABRIOS_TEST_PASSWORD;
if (!TEST_PASSWORD) throw new Error('Set FABRIOS_TEST_PASSWORD before running auth.setup.ts');

setup('authenticate via steelman', async ({ page }) => {
  fs.mkdirSync('playwright/.auth', { recursive: true });

  await page.goto('/login');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Sign in with steelman
  await page.getByPlaceholder('you@company.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log('After sign-in URL:', url);

  // Handle module selection if needed
  const moduleHeading = page.getByText('Select your workspace');
  if (await moduleHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Module selection detected');
    await page.getByText('Both').click();
    await page.waitForTimeout(1000);
  }

  // Navigate to dashboard
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  if (finalUrl.includes('/login')) {
    throw new Error('Authentication failed - still on login page');
  }

  await page.context().storageState({ path: authFile });
  const saved = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  console.log('Auth state saved. Origins:', saved.origins?.length);
});
