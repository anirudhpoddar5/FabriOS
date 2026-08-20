import { test } from '@playwright/test';
import fs from 'fs';

/**
 * Mechanical UI audit — v2.
 *
 * v1 was worthless: it scanned routes only, so it never saw the Office Grid at all
 * (that UI lives behind a tab) and found zero of the three bugs reported from live
 * use. This version opens tabs and dialogs, and carries a detector modelled on each
 * of those three bugs:
 *
 *   1. INPUT_* ....... a field too narrow to show what you type   (Persons/Output)
 *   2. SELECT_*  ..... a dropdown whose choice does not stick     (Product)
 *   3. BLOCKED_* ..... an action disabled with no stated reason   ("Save 0 Entries")
 *
 * It is validated against those three before its output is trusted.
 */

const ROUTES = [
  '/', '/printing-orders', '/stitching-orders', '/entries', '/attendance',
  '/material-issues', '/quotations', '/invoices', '/subcontract-jobs', '/stock-jobs',
  '/production-control', '/dispatch', '/reports', '/bom', '/inventory',
  '/purchase-orders', '/grn', '/help',
  '/settings/companies', '/settings/factories-shifts', '/settings/workers',
  '/settings/workers-rates', '/settings/buyers', '/settings/fabrics',
  '/settings/printing-tables', '/settings/stitching-lines',
  '/settings/printing-products', '/settings/stitching-products',
  '/settings/users', '/settings/vendors',
];
const ONLY = process.env.AUDIT_ONLY ? process.env.AUDIT_ONLY.split(',') : null;

type F = { where: string; kind: string; detail: string };
const findings: F[] = [];
const OUT = '/tmp/fabrios-audit-findings.jsonl';

/** Geometry + content defects. Runs in the page. */
const SCAN = () => {
  const out: { kind: string; detail: string }[] = [];
  const seen = new Set<string>();
  const push = (kind: string, detail: string) => {
    const k = kind + '|' + detail;
    if (!seen.has(k)) { seen.add(k); out.push({ kind, detail }); }
  };
  const vis = (e: HTMLElement) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const name = (e: HTMLElement) => e.getAttribute('aria-label') || e.getAttribute('placeholder')
    || e.getAttribute('name') || (e.textContent || '').trim().slice(0, 28) || '(unlabelled)';

  document.querySelectorAll('input,textarea').forEach(el => {
    const e = el as HTMLInputElement;
    if (!vis(e) || ['checkbox', 'radio', 'hidden', 'file', 'submit', 'button'].includes(e.type)) return;
    const cs = getComputedStyle(e);
    const usable = e.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
      - (e.type === 'number' && cs.appearance !== 'textfield' ? 16 : 0);
    if (usable < 28) push('INPUT_TOO_NARROW', `${name(e)} [${e.type}] ${Math.round(usable)}px usable`);
    if (e.value && e.scrollWidth > e.clientWidth + 1) push('INPUT_TEXT_CLIPPED', `${name(e)} value="${e.value.slice(0, 15)}"`);
  });

  document.querySelectorAll('td,th').forEach(el => {
    const e = el as HTMLElement;
    if (vis(e) && e.scrollWidth > e.clientWidth + 2 && (e.textContent || '').trim())
      push('CELL_TEXT_CLIPPED', `"${(e.textContent || '').trim().slice(0, 25)}"`);
  });

  document.querySelectorAll('table').forEach((t, ti) => {
    const h = t.querySelector('thead tr'); if (!h) return;
    const cols = Array.from(h.children).reduce((n, c) => n + ((c as HTMLTableCellElement).colSpan || 1), 0);
    t.querySelectorAll('tbody tr').forEach((tr, ri) => {
      const n = Array.from(tr.children).reduce((a, c) => a + ((c as HTMLTableCellElement).colSpan || 1), 0);
      if (n !== cols) push('TABLE_COLSPAN_MISMATCH', `table${ti + 1} row${ri + 1}: ${n} vs ${cols}`);
    });
  });

  const body = document.body.innerText || '';
  ['undefined', 'NaN', '[object Object]'].forEach(bad => {
    if (body.includes(bad)) push('RAW_VALUE_SHOWN', `"${bad}": ${(body.split('\n').find(l => l.includes(bad)) || '').trim().slice(0, 55)}`);
  });

  // an action the user cannot take, with nothing on screen saying why
  const alertText = Array.from(document.querySelectorAll('[role=alert],.text-destructive'))
    .map(e => (e as HTMLElement).innerText || '').join(' ');
  document.querySelectorAll('button').forEach(el => {
    const e = el as HTMLButtonElement;
    if (!vis(e) || !e.disabled) return;
    const label = (e.textContent || '').trim();
    if (/save|submit|create|add|generate|convert|post/i.test(label) && alertText.trim().length < 5)
      push('BLOCKED_NO_REASON', `"${label}" is disabled and nothing on screen explains why`);
  });
  return out;
};

async function scan(page: any, where: string) {
  for (const f of await page.evaluate(SCAN)) findings.push({ where, ...f });
}

/** Every dropdown must keep the option you pick. */
async function checkSelects(page: any, where: string) {
  const combos = page.locator('[role="combobox"]:visible');
  const n = Math.min(await combos.count(), 6);
  for (let i = 0; i < n; i++) {
    const c = combos.nth(i);
    try {
      const before = (await c.innerText()).trim();
      await c.click({ timeout: 1500 });
      await page.waitForTimeout(150);
      const opts = page.getByRole('option');
      const count = await opts.count();
      if (count === 0) { await page.keyboard.press('Escape'); continue; }
      let picked = '';
      for (let j = 0; j < Math.min(count, 6); j++) {
        const o = opts.nth(j);
        if (await o.isDisabled().catch(() => true)) continue;
        picked = (await o.innerText()).trim();
        await o.click({ timeout: 1500 });
        break;
      }
      if (!picked) { await page.keyboard.press('Escape'); continue; }
      await page.waitForTimeout(300);
      const after = (await c.innerText()).trim();
      const kept = after.includes(picked.slice(0, 6)) || after !== before;
      if (!kept) findings.push({ where, kind: 'SELECT_CHOICE_DISCARDED', detail: `picked "${picked.slice(0, 22)}" — trigger still reads "${after.slice(0, 22)}"` });
    } catch { await page.keyboard.press('Escape').catch(() => {}); }
  }
}

for (const route of (ONLY ?? ROUTES)) {
  test(`audit ${route}`, async ({ page }) => {
    test.setTimeout(120_000);
    findings.length = 0;
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 130)); });

    try {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForTimeout(1200);
    } catch {
      findings.push({ where: route, kind: 'PAGE_LOAD_FAILED', detail: 'timed out' });
      return flush(route, errs);
    }
    if (/\/login/.test(page.url())) { findings.push({ where: route, kind: 'REDIRECTED_TO_LOGIN', detail: '' }); return flush(route, errs); }

    await scan(page, route);
    await checkSelects(page, route);

    const tabs = page.getByRole('tab');
    for (let i = 0; i < await tabs.count(); i++) {
      const label = (await tabs.nth(i).innerText().catch(() => '')).trim();
      try {
        await tabs.nth(i).click({ timeout: 3000 });
        await page.waitForTimeout(900);
        await scan(page, `${route} [tab:${label}]`);
        await checkSelects(page, `${route} [tab:${label}]`);
      } catch { /* not clickable */ }
    }

    const openers = page.getByRole('button', { name: /^(\+\s*)?(new|add|create)\b/i });
    for (let i = 0; i < Math.min(await openers.count(), 2); i++) {
      const label = (await openers.nth(i).innerText().catch(() => '')).trim();
      try {
        await openers.nth(i).click({ timeout: 3000 });
        await page.waitForTimeout(1000);
        if (await page.locator('[role="dialog"]').count()) await scan(page, `${route} [dialog:${label}]`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      } catch { await page.keyboard.press('Escape').catch(() => {}); }
    }
    flush(route, errs);
  });
}

function flush(route: string, errs: string[]) {
  for (const e of [...new Set(errs)].slice(0, 3)) findings.push({ where: route, kind: 'CONSOLE_ERROR', detail: e });
  if (findings.length) fs.appendFileSync(OUT, findings.map(f => JSON.stringify(f)).join('\n') + '\n');
  console.log(`  ${route}: ${findings.length} findings`);
}
