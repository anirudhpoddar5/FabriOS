import { test, expect } from '@playwright/test';

const routes = [
  { path: '/', name: 'Home' },
  { path: '/printing-orders', name: 'Printing Orders' },
  { path: '/stitching-orders', name: 'Stitching Orders' },
  { path: '/stock-jobs', name: 'Stock Jobs' },
  { path: '/entries', name: 'Entries' },
  { path: '/dispatch', name: 'Dispatch' },
  { path: '/reports', name: 'Reports' },
  { path: '/inventory', name: 'Inventory' },
  { path: '/bom', name: 'BOM' },
  { path: '/purchase-orders', name: 'Purchase Orders' },
  { path: '/grn', name: 'GRN' },
  { path: '/settings/companies', name: 'Companies Settings' },
  { path: '/settings/factories-shifts', name: 'Factories & Shifts Settings' },
  { path: '/settings/workers-rates', name: 'Workers & Rates Settings' },
  { path: '/settings/buyers', name: 'Buyers Settings' },
  { path: '/settings/fabrics', name: 'Fabrics Settings' },
  { path: '/settings/printing-tables', name: 'Printing Tables Settings' },
  { path: '/settings/stitching-lines', name: 'Stitching Lines Settings' },
  { path: '/settings/printing-products', name: 'Printing Products Settings' },
  { path: '/settings/stitching-products', name: 'Stitching Products Settings' },
  { path: '/settings/vendors', name: 'Vendors Settings' },
  { path: '/settings/users', name: 'Users Settings' },
] as const;

async function expectAppShell(page: import('@playwright/test').Page) {
  await expect(page).toHaveTitle(/FabriOS/i);
  await expect(page.locator('body')).toBeVisible();
}

async function expectNoCrash(page: import('@playwright/test').Page) {
  await expect(page.locator('body')).not.toContainText(/Application error/i);
  await expect(page.locator('body')).not.toContainText(/Unexpected Application Error/i);
  await expect(page.locator('body')).not.toContainText(/Something went wrong/i);
}

test.describe('FabriOS route smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.error('PAGE ERROR:', err.message);
    });
  });

  for (const route of routes) {
    test(`smoke: ${route.name} loads (${route.path})`, async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      expect(response, `No response received for ${route.path}`).not.toBeNull();
      expect(response?.status(), `Unexpected status for ${route.path}`).toBeLessThan(500);

      await expectAppShell(page);
      await expectNoCrash(page);

      await page.waitForLoadState('networkidle').catch(() => {});

      const bodyText = (await page.locator('body').innerText()).trim();
      expect(bodyText.length, `Page body is empty for ${route.path}`).toBeGreaterThan(0);

      expect(
        consoleErrors,
        `Console errors found on ${route.path}:\n${consoleErrors.join('\n')}`
      ).toEqual([]);
    });
  }

  test('home route redirects or renders a meaningful entry screen', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectAppShell(page);

    await expect(page.locator('body')).toContainText(
      /FabriOS|Login|Sign in|Dashboard|Module|Setup|Pending Approval/i
    );
  });

  test('settings routes are reachable and not 404', async ({ page }) => {
    const settingsRoutes = routes.filter((r) => r.path.startsWith('/settings/'));

    for (const route of settingsRoutes) {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response, `No response for ${route.path}`).not.toBeNull();
      expect(response?.status(), `Unexpected status for ${route.path}`).toBeLessThan(500);
      await expect(page.locator('body')).not.toContainText(/404|Not Found/i);
    }
  });
});
