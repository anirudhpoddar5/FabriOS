import { test } from '@playwright/test';
import * as fs from 'fs';

test.use({ storageState: 'test-results/steelman-auth.json' });

test('dump dialog HTML', async ({ page }) => {
  await page.goto('https://fabrios.pages.dev/printing-orders', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /new order/i }).click();
  await page.waitForTimeout(2000);
  const dialogHtml = await page.locator('[role="dialog"]').innerHTML().catch(() => 'NO-DIALOG');
  fs.writeFileSync('test-results/dialog-html.txt', dialogHtml);
  console.log('Dialog HTML saved, length:', dialogHtml.length);
  console.log('First 2000 chars:', dialogHtml.substring(0, 2000));
});
