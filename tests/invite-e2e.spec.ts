import { test, expect } from '@playwright/test';
import { getSupabaseAdmin, selectOption, fillField, clickButton, TEST_EMAIL, TEST_PASSWORD } from './helpers';

const BASE = 'https://fabrios.pages.dev';
const INVITE_EMAIL = `invited-${Date.now()}@fabrios-test.com`;
const INVITE_NAME = 'Invited Tester';

test('Invite a user via UI', async ({ page }) => {
  test.setTimeout(120_000);
  const admin = getSupabaseAdmin();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const emailInput = page.getByPlaceholder('you@company.com');
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(TEST_EMAIL);
      await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForTimeout(3000);
    }

    // Step 2: Go to Users page
    await page.goto(`${BASE}/settings/users`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();

    // Step 3: Invite a new user
    await page.getByRole('button', { name: /invite user/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(500);

    await fillField(page, 'Display Name *', INVITE_NAME);
    await fillField(page, 'Email *', INVITE_EMAIL);
    await page.getByRole('button', { name: /send invite/i }).click();

    // Wait for the invite to process
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Invite failed');
    expect(bodyText).not.toContain('already exists');
    console.log('✅ Invite sent for', INVITE_EMAIL);

    // Verify user appeared in the user list
    await page.waitForTimeout(2000);
    const listText = await page.locator('body').innerText();
    expect(listText).toContain(INVITE_NAME);
    console.log('✅ Invited user visible in user list');
  } finally {
    await page.close();
  }

  // Step 4: Clean up
  const { data: users } = await admin.auth.admin.listUsers();
  const invitedUser = users?.users?.find(u => u.email === INVITE_EMAIL);
  if (invitedUser) {
    await admin.auth.admin.deleteUser(invitedUser.id);
    console.log('✅ Cleaned up invited user');
  }

  console.log('✅ Invite flow verified');
});
