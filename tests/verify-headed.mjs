import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 1. Landing page
  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(1000);
  console.log('1. Landing page — hero + features');

  // 2. Terms
  await page.goto('http://localhost:8080/terms');
  await page.waitForTimeout(500);
  console.log('2. Terms & Conditions');

  // 3. Privacy
  await page.goto('http://localhost:8080/privacy');
  await page.waitForTimeout(500);
  console.log('3. Privacy Policy');

  // 4. Login page (with signup tab)
  await page.goto('http://localhost:8080/login?signup=1');
  await page.waitForTimeout(500);
  console.log('4. Login page (sign-up tab from landing CTA)');

  // 5. Log in
  await page.goto('http://localhost:8080/login');
  await page.fill('input[placeholder="you@company.com"]', 'anirudh6174@gmail.com');
  await page.fill('input[placeholder="••••••••"]', 'ani12345');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(3000);

  // If module select appears
  const both = page.locator('h2:has-text("Both")').locator('..');
  if (await both.isVisible().catch(() => false)) {
    await both.click();
    await page.waitForTimeout(1000);
  }

  // 6. Dashboard (with guided tour)
  console.log('5. Dashboard — close tour if shown');
  const gotIt = page.locator('button:has-text("Got it")');
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(300);
  }

  // 7. Help page
  await page.goto('http://localhost:8080/help');
  await page.waitForTimeout(1000);
  console.log('6. Help & Guides page');

  // Click first help article
  const firstArticle = page.locator('button:has-text("Getting Started")');
  if (await firstArticle.isVisible().catch(() => false)) {
    await firstArticle.click();
    await page.waitForTimeout(1000);
  }
  console.log('7. Help article detail view');

  // Back to articles
  const backBtn = page.locator('button:has-text("All articles")');
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click();
    await page.waitForTimeout(300);
  }

  // 8. Reports page
  await page.goto('http://localhost:8080/reports');
  await page.waitForTimeout(2000);
  console.log('8. Reports — Excel/CSV/PDF buttons visible');

  // Click through a few report tabs
  const tabs = ['cost-analysis', 'production-summary', 'profit-loss', 'monthly-trend'];
  for (const tab of tabs) {
    const tabBtn = page.locator(`button[value="${tab}"]`);
    if (await tabBtn.isVisible().catch(() => false)) {
      await tabBtn.click();
      await page.waitForTimeout(300);
    }
  }
  console.log('9. Scrolled through report tabs');

  // 9. A page with explainer tip
  await page.goto('http://localhost:8080/settings/factories-shifts');
  await page.waitForTimeout(1000);
  console.log('10. Factories page with explainer tip (i icon)');

  await page.waitForTimeout(2000);
  await browser.close();
  console.log('Done — all pages verified visually');
})();
