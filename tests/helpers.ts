import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Supabase Admin Client (service_role) ──
let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = 'https://ejebukxlwgwebjgdicyb.supabase.co';

  // Try to load service role key from .env.local
  const envPath = path.resolve(__dirname, '..', '.env.local');
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key && fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    if (match) key = match[1].trim();
  }
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not found. Set it in .env.local or environment.');

  _admin = createClient(url, key);
  return _admin;
}

// ── UI Helpers (reusable across tests) ──

export async function selectOption(page: Page, label: string, optionText: string | RegExp) {
  const parent = page.locator(`div:has(> label:text-is("${label}"))`).first();
  const trigger = parent.locator('[role="combobox"]');
  await trigger.click();
  await page.waitForTimeout(200);
  await page.getByRole('option', { name: optionText as any }).first().click();
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

export const TEST_EMAIL = 'steelman@fabrios-demo.com';
export const TEST_PASSWORD = 'SteelMan@Demo2026!';
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
