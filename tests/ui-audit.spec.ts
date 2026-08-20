import { test, expect } from '@playwright/test';

/**
 * Mechanical UI audit across every page.
 *
 * Hand-written functional tests did NOT catch the Office Grid bug: the field
 * accepted input and the state was correct, so every behavioural assertion
 * passed — the value was simply drawn outside a box too small to show it.
 * Only measuring the rendered geometry finds that class of defect.
 *
 * This walks each route and inspects every element for defects a user would
 * describe as "it's broken" but a functional test reports as passing.
 *
 * Reports rather than asserts, so one bad page cannot mask the rest.
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

type Finding = { route: string; kind: string; detail: string };
const findings: Finding[] = [];

/** Runs in the page. Returns defects, not opinions. */
const AUDIT = () => {
  const out: { kind: string; detail: string }[] = [];
  const seen = new Set<string>();
  const push = (kind: string, detail: string) => {
    const k = kind + '|' + detail;
    if (!seen.has(k)) { seen.add(k); out.push({ kind, detail }); }
  };
  const describe = (el: Element) => {
    const e = el as HTMLElement;
    const label = e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('name')
      || (e.closest('td,th') ? `col ${Array.from(e.closest('tr')?.children || []).indexOf(e.closest('td,th') as Element) + 1}` : '')
      || (e.textContent || '').trim().slice(0, 30);
    return `<${e.tagName.toLowerCase()}${(e as any).type ? ` type=${(e as any).type}` : ''}> ${label || '(unlabelled)'}`;
  };
  const onScreen = (e: HTMLElement) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };

  // 1. Inputs with too little room to show what you type — the Office Grid class
  document.querySelectorAll('input, textarea, select').forEach(el => {
    const e = el as HTMLInputElement;
    if (!onScreen(e)) return;
    if (['checkbox', 'radio', 'hidden', 'file'].includes(e.type)) return;
    const cs = getComputedStyle(e);
    const usable = e.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
    const spinner = e.type === 'number' && cs.appearance !== 'textfield' ? 16 : 0;
    if (usable - spinner < 28) push('INPUT_TOO_NARROW', `${describe(e)} — ${Math.round(usable - spinner)}px usable`);
    if (e.scrollWidth > e.clientWidth + 1 && e.value) push('INPUT_TEXT_CLIPPED', `${describe(e)} value="${e.value.slice(0, 20)}"`);
    if (parseFloat(cs.fontSize) < 11) push('INPUT_FONT_TINY', `${describe(e)} — ${cs.fontSize}`);
  });

  // 2. Interactive things you cannot actually hit or identify
  document.querySelectorAll('button, [role=button], a[href]').forEach(el => {
    const e = el as HTMLElement;
    if (!onScreen(e)) return;
    const r = e.getBoundingClientRect();
    if (r.width < 16 || r.height < 16) push('CONTROL_TOO_SMALL', `${describe(e)} — ${Math.round(r.width)}x${Math.round(r.height)}`);
    const name = (e.getAttribute('aria-label') || e.textContent || '').trim();
    if (!name && !e.querySelector('svg,img')) push('CONTROL_NO_LABEL', describe(e));
  });

  // 3. Table cells whose content is cut off
  document.querySelectorAll('td, th').forEach(el => {
    const e = el as HTMLElement;
    if (!onScreen(e)) return;
    if (e.scrollWidth > e.clientWidth + 2 && (e.textContent || '').trim().length > 0) {
      push('CELL_TEXT_CLIPPED', `${describe(e)} "${(e.textContent || '').trim().slice(0, 25)}"`);
    }
  });

  // 4. Table rows whose cell count does not match the header — broken colSpans
  document.querySelectorAll('table').forEach((t, ti) => {
    const head = t.querySelector('thead tr');
    if (!head) return;
    const cols = Array.from(head.children).reduce((n, c) => n + ((c as HTMLTableCellElement).colSpan || 1), 0);
    t.querySelectorAll('tbody tr').forEach((tr, ri) => {
      const n = Array.from(tr.children).reduce((a, c) => a + ((c as HTMLTableCellElement).colSpan || 1), 0);
      if (n !== cols) push('TABLE_COLSPAN_MISMATCH', `table ${ti + 1} row ${ri + 1}: ${n} cells vs ${cols} header cols`);
    });
  });

  // 5. Raw junk values rendered to the user
  const body = document.body.innerText || '';
  for (const bad of ['undefined', 'NaN', '[object Object]', 'null null']) {
    if (body.includes(bad)) {
      const line = body.split('\n').find(l => l.includes(bad)) || '';
      push('RAW_VALUE_SHOWN', `"${bad}" in: ${line.trim().slice(0, 60)}`);
    }
  }
  return out;
};

test('UI audit across every page', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors: Record<string, string[]> = {};

  for (const route of ROUTES) {
    const errs: string[] = [];
    const onErr = (m: any) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); };
    page.on('console', onErr);
    try {
      await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(1200);
    } catch {
      findings.push({ route, kind: 'PAGE_LOAD_FAILED', detail: 'navigation timed out' });
      page.off('console', onErr);
      continue;
    }
    if (/\/login/.test(page.url()) && route !== '/login') {
      findings.push({ route, kind: 'REDIRECTED_TO_LOGIN', detail: 'session lost' });
      page.off('console', onErr);
      continue;
    }
    for (const f of await page.evaluate(AUDIT)) findings.push({ route, ...f });
    page.off('console', onErr);
    if (errs.length) consoleErrors[route] = [...new Set(errs)];
  }

  const byKind: Record<string, Finding[]> = {};
  for (const f of findings) (byKind[f.kind] ||= []).push(f);

  console.log('\n================ UI AUDIT ================');
  console.log(`routes scanned: ${ROUTES.length}   findings: ${findings.length}\n`);
  for (const kind of Object.keys(byKind).sort((a, b) => byKind[b].length - byKind[a].length)) {
    console.log(`## ${kind} (${byKind[kind].length})`);
    for (const f of byKind[kind].slice(0, 25)) console.log(`   ${f.route.padEnd(32)} ${f.detail}`);
    if (byKind[kind].length > 25) console.log(`   ... ${byKind[kind].length - 25} more`);
    console.log('');
  }
  console.log('## CONSOLE ERRORS');
  for (const [r, e] of Object.entries(consoleErrors)) console.log(`   ${r.padEnd(32)} ${e[0]}`);
  console.log('==========================================\n');
});
