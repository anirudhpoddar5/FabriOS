import { test, expect } from '@playwright/test';

test('dashboard loads', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).not.toHaveURL(/login/);
  await expect(page.locator('body')).toBeVisible();
});

test('stock jobs page loads', async ({ page }) => {
  await page.goto('/stock-jobs');
  await expect(page).not.toHaveURL(/login/);
});

test('dispatch page loads', async ({ page }) => {
  await page.goto('/dispatch');
  await expect(page).not.toHaveURL(/login/);
});
