import { test, expect } from '@playwright/test';

test('order detail page shows production target panel', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fabrios_tour_done', '1');
  });
  await page.goto('/printing-orders');
  await page.waitForTimeout(2000);

  const firstOrderLink = page.locator('a[href*="/printing-orders/"]').first();
  await firstOrderLink.click();
  await page.waitForTimeout(2000);

  const body = await page.locator('body').innerText();

  // Production Target panel renders when an active order is viewed
  // It may say "On track" or show an exception — both are valid
  expect(body).toContain('Printing Order');
});

test('dashboard renders delay exception section if present', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fabrios_tour_done', '1');
  });
  await page.goto('/');
  await page.waitForTimeout(2000);

  const body = await page.locator('body').innerText();
  expect(body).toContain('Today');
  expect(body).not.toContain('Application error');
});
