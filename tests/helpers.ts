import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { getSupabaseAdmin } from './supabase-admin';

// ── UI Helpers (reusable across tests) ──

export async function selectOption(page: Page, label: string, optionText: string | RegExp) {
  const parent = page.locator(`div:has(> label:text-is("${label}"))`).first();
  const trigger = parent.locator('[role="combobox"]');
  await trigger.click({ force: true });
  await page.waitForTimeout(300);
  const option = page.getByRole('option', { name: optionText as any }).first();
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

export async function clickButton(page: Page, text: string | RegExp) {
  if (typeof text === 'string') {
    await page.getByRole('button', { name: text, exact: true }).click();
  } else {
    await page.getByRole('button', { name: text }).first().click();
  }
}

export async function fillField(page: Page, label: string, value: string) {
  const parent = page.locator(`div:has(> label:text-is("${label}"))`).first();
  const input = parent.locator('input').first();
  await input.clear();
  await input.fill(value);
}

// ── Auth ──

export const TEST_EMAIL = process.env.FABRIOS_TEST_EMAIL ?? 'steelman@fabrios-demo.com';
export const TEST_PASSWORD = (() => {
  const pw = process.env.FABRIOS_TEST_PASSWORD;
  if (!pw) throw new Error('Set FABRIOS_TEST_PASSWORD before running tests that import tests/helpers.ts');
  return pw;
})();
export const TEST_COMPANY = 'SteelM Industries';
export const TEST_DISPLAY = 'SteelMan Tester';

export function getUserIdFromStorage(page: Page): Promise<string | null> {
  const projectId = 'ejebukxlwgwebjgdicyb';
  return page.evaluate((pid: string) => {
    try {
      const raw = localStorage.getItem(`sb-${pid}-auth-token`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.user?.id || null;
    } catch { return null; }
  }, projectId);
}
