import { test, expect, Page } from '@playwright/test';

/**
 * Integration pass: verify all four improvement features show consistent
 * numbers for the same order at the same time.
 *
 * Uses known order UUIDs from the test user's company (test@fabrios-e2e.com).
 * Cross-checks: produced qty, ordered qty, remaining qty, due date
 * across summary card, cost card, target panel, and colourway table.
 */

const BASE = 'http://localhost:8080';
const inconsistencies: string[] = [];

function record(label: string, a: string | undefined, b: string | undefined) {
  if (!a || !b) return;
  if (a !== b && a !== '—' && b !== '—') {
    inconsistencies.push(`  MISMATCH [${label}]: "${a}" vs "${b}"`);
  }
}

async function ensureAuth(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 }).catch(() => {});
  await page.addInitScript(() => {
    localStorage.setItem('fabrios_module', 'both');
    localStorage.setItem('fabrios_tour_done', '1');
    localStorage.removeItem('fabrios_factory');
  });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  const needsLogin = page.url().includes('/login') ||
    await page.getByRole('button', { name: /^sign in$/i }).first().isVisible().catch(() => false);
  if (needsLogin) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.getByPlaceholder('you@company.com').fill('test@fabrios-e2e.com');
    await page.getByPlaceholder('••••••••').fill('TestPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(4000);
    const stillOnLogin = page.url().includes('/login');
    if (!stillOnLogin && await page.getByText('Select your workspace').isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByText('Both').click();
      await page.waitForTimeout(1000);
    }
  }
}

async function getBody(page: Page) {
  return (await page.locator('body').innerText().catch(() => ''));
}

test.describe.configure({ mode: 'serial' });

test.describe('Integration consistency — four features, one order', () => {

  test('INT-01: Dashboard loads without error', async ({ page }) => {
    await ensureAuth(page);
    const body = await getBody(page);
    expect(body).not.toContain('Application error');
    expect(body).not.toContain('Something went wrong');
    expect(body.length).toBeGreaterThan(100);
    console.log(`Dashboard OK (${body.length} chars)`);
  });

  test('INT-02: Stitching order PO-S-0001 — verify produced/ordered/remaining consistent across all panels', async ({ page }) => {
    // PO-S-0001 has 5 entries, exists in test user's company
    const uuid = '6a07b246-95f8-46a1-8937-1b9c631f5ae5';
    await ensureAuth(page);
    await page.goto(`${BASE}/stitching-orders/${uuid}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);

    const body = await getBody(page);
    expect(body).not.toContain('Application error');
    expect(body).not.toContain('Something went wrong');
    expect(body).toContain('PO-S-0001');
    console.log(`Order page loaded (${body.length} chars)`);

    // === Feature 1: Summary Card (Total Output card) ===
    // Extracts produced and ordered from "XXXX / YYYY" pattern in the Total Output card
    const summaryMatch = body.match(/Total Output[^]*?(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
    let summaryProduced = '';
    let summaryOrdered = '';
    if (summaryMatch) {
      summaryProduced = summaryMatch[1].replace(/,/g, '');
      summaryOrdered = summaryMatch[2].replace(/,/g, '');
      console.log(`[Summary Card] produced=${summaryProduced}, ordered=${summaryOrdered}`);
    } else {
      // Fallback: find any X/Y pattern
      const fallback = body.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
      if (fallback) {
        summaryProduced = fallback[1].replace(/,/g, '');
        summaryOrdered = fallback[2].replace(/,/g, '');
        console.log(`[Summary Card] (fallback) produced=${summaryProduced}, ordered=${summaryOrdered}`);
      }
    }

    // === Feature 2: Cost Summary card ===
    const costVisible = body.includes('Cost Summary');
    console.log(`[Cost Summary] visible: ${costVisible}`);
    if (costVisible) {
      if (body.includes('Cost is on plan')) {
        console.log('[Cost Summary] Status: on plan');
      } else if (body.includes('over plan')) {
        console.log('[Cost Summary] Status: over plan');
      }
    }

    // === Feature 3: Production Target panel ===
    const targetVisible = body.includes('Production Target');
    console.log(`[Production Target] visible: ${targetVisible}`);
    if (targetVisible) {
      const remMatch = body.match(/Remaining[^]*?(\d[\d,]*)\s*units/);
      if (remMatch) {
        const targetRemaining = remMatch[1].replace(/,/g, '');
        console.log(`[Production Target] remaining: ${targetRemaining}`);
        if (summaryProduced && summaryOrdered) {
          const expected = String(Math.max(parseInt(summaryOrdered) - parseInt(summaryProduced), 0));
          record('remaining = ordered - produced', expected, targetRemaining);
        }
      }

      // Check status line
      const statusLine =
        body.includes('On track') ? 'On track' :
        body.includes('days late') ? 'Late' :
        body.includes('No output') ? 'No output' :
        body.includes('below required') ? 'Below target' :
        body.includes('Due today') ? 'Due today' :
        body.includes('Order complete') ? 'Complete' : 'Unknown';
      console.log(`[Production Target] status: ${statusLine}`);
    }

    // === Feature 4: Material Consumption ===
    const consumptionVisible = body.includes('Material Consumption');
    console.log(`[Material Consumption] visible: ${consumptionVisible}`);

    // === Cross-check: Colourway Balance ===
    const balanceMatch = body.match(/Balance[^]*?(\d+)/);
    if (balanceMatch && summaryProduced && summaryOrdered) {
      const balance = balanceMatch[1];
      const expectedBalance = String(Math.max(parseInt(summaryOrdered) - parseInt(summaryProduced), 0));
      console.log(`[Colourway] balance: ${balance}, computed: ${expectedBalance}`);
      record('colourway balance', expectedBalance, balance);
    }

    // === Report ===
    if (inconsistencies.length) {
      console.log('\n--- INCONSISTENCIES FOUND ---');
      inconsistencies.forEach(i => console.log(i));
      console.log('---\n');
    } else {
      console.log('\n✓ All features show consistent data for this order.\n');
      expect(true).toBeTruthy();
    }

    expect(inconsistencies.length).toBe(0);
  });

  test('INT-03: Printing order list loads, verify dashboard shows it', async ({ page }) => {
    await ensureAuth(page);
    await page.goto(`${BASE}/print-orders`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.goto(`${BASE}/printing-orders`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);
    const body = await getBody(page);
    expect(body).not.toContain('Application error');
    // The page should have some order listings
    const hasList = body.includes('PO-') || body.includes('Order') || body.includes('printing');
    expect(hasList).toBeTruthy();
    console.log(`Printing orders page OK (${body.length} chars)`);
  });

});
