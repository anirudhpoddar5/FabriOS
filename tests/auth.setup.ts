import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';

const authFile = 'playwright/.auth/user.json';

const TEST_EMAIL = 'test@fabrios-e2e.com';
const TEST_PASSWORD = 'TestPass123!';

setup('authenticate from scratch', async ({ page }) => {
  fs.mkdirSync('playwright/.auth', { recursive: true });

  // Clear previous session
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Check if already authenticated (fresh DB = no, but defensive)
  const isSignInPage = await page.getByPlaceholder('you@company.com').isVisible().catch(() => false);
  if (!isSignInPage) {
    // Already has a session — save and exit
    await page.context().storageState({ path: authFile });
    return;
  }

  // ── Try sign in first (user may exist from a previous run) ──
  await page.getByPlaceholder('you@company.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(1500);

  // Check if sign-in succeeded (redirected away from login)
  const stillOnLogin = await page.getByRole('button', { name: /sign in/i }).isVisible().catch(() => false);
  if (!stillOnLogin) {
    // Sign-in worked — check if we need module selection
    await handlePostLogin(page);
    await page.context().storageState({ path: authFile });
    return;
  }

  // ── Sign-in failed — sign up a new user ──
  // Navigate directly to sign-up view via URL parameter
  await page.goto('/login?signup=1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await expect(page.locator('h2').filter({ hasText: 'Create account' })).toBeVisible({ timeout: 3000 });

  await page.getByPlaceholder('John Doe').fill('E2E Test User');
  await page.getByPlaceholder('you@company.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('Min 6 characters').fill(TEST_PASSWORD);
  await page.getByPlaceholder('Re-enter password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();

  // Wait for signup to process — with email confirm OFF, auto-login redirects away
  await page.waitForTimeout(3000);
  const afterSignupUrl = page.url();
  console.log('After signup URL:', afterSignupUrl);
  const bodyPreview = await page.locator('body').innerText().catch(() => '');
  console.log('After signup body:', bodyPreview.slice(0, 200));

  // Handle post-signup flow
  const signupSuccess = await page.getByText('Account created').isVisible().catch(() => false);

  if (signupSuccess) {
    // Email confirmation is ON — user needs to confirm email
    // We can't proceed. Instruct user to disable email confirmation in Supabase.
    console.log('='.repeat(60));
    console.log('Email confirmation is ENABLED in Supabase.');
    console.log('To run tests from scratch, please:');
    console.log('1. Go to Supabase Dashboard → Authentication → Settings');
    console.log('2. Toggle OFF "Enable email confirmations"');
    console.log('3. Re-run the tests');
    console.log('='.repeat(60));
    // Still try to sign in — the user might have confirmed manually
    await page.getByRole('button', { name: /go to sign in/i }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('you@company.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(1500);
    const loginFailed = await page.getByRole('button', { name: /sign in/i }).isVisible().catch(() => false);
    if (loginFailed) {
      // Still on login page — skip this test run gracefully
      test.skip(true, 'Cannot authenticate: email confirmation is enabled. Disable it in Supabase Auth settings.');
      return;
    }
  }

  // If we get here, we're either auto-logged-in or signed in manually
  await handlePostLogin(page);

  // Save auth state
  await page.context().storageState({ path: authFile });
  console.log(`Auth state saved to ${authFile}`);
});

async function handlePostLogin(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');

  // ── Step: Setup Wizard (company creation) ──
  // Detect wizard by looking for the company name input
  const companyInput = page.getByPlaceholder('Acme Textiles')
  if (await companyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Setup wizard detected — creating company');
    await companyInput.fill('E2E Test Company');
    await page.getByPlaceholder('John Doe').fill('E2E Test User');
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait for company creation to complete — either "You're all set" or error toast
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Wait for company creation to complete
    await page.waitForTimeout(3000);

    // Debug: take a screenshot on failure
    const goBtn = page.getByRole('button', { name: /go to dashboard/i }).or(page.getByRole('button', { name: /continue/i }))
    const btnVisible = await goBtn.first().isVisible({ timeout: 8000 }).catch(() => false)

    if (!btnVisible) {
      await page.screenshot({ path: 'test-results/setup-debug.png' })
      const bodyText = await page.locator('body').innerText()
      console.log('Current page text after Continue click:', bodyText.slice(0, 500))
      const url = page.url()
      console.log('Current URL:', url)
    }

    // "You're all set!" page — click Go to Dashboard
    if (await page.getByRole('button', { name: /go to dashboard/i }).isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole('button', { name: /go to dashboard/i }).click();
      await page.waitForLoadState('networkidle');
      console.log('Setup wizard completed — went to dashboard');
    }
  }

  // ── Step: Module Selection ──
  const moduleHeading = page.getByText('Select your workspace')
  if (await moduleHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Module selection detected — selecting Both');
    await page.getByText('Both').click();
    await page.waitForTimeout(500);
    console.log('Module Both selected');
  }
}
