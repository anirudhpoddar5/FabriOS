import { test, expect } from '@playwright/test';

test('dashboard loads and shows key metrics', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fabrios_tour_done', '1');
  });
  await page.goto('/');
  await page.waitForTimeout(2000);

  const body = await page.locator('body').innerText();
  expect(body).toContain('Today');
  expect(body).toContain('PRODUCTION');
  expect(body).not.toContain('Application error');
});
