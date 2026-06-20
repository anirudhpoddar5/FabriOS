import { test, expect } from '@playwright/test';

test('dashboard loads and shows key metrics', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('text=Welcome')).toBeVisible();
  await expect(page.locator('text=Active Printing')).toBeVisible();
  await expect(page.locator('text=Total Ordered')).toBeVisible();
});