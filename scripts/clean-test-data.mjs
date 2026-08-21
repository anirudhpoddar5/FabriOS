#!/usr/bin/env node
/**
 * Removes companies and logins created by end-to-end runs.
 *
 * The pipeline spec signs up a fresh user and company on every run. Left alone that
 * refills the database with junk — it had reached 20 companies, 18 of them from old
 * runs. Run this after any full-pipeline session.
 *
 * KEEPS exactly: Poddar Exports (live) and FabriOS Test Co (the seeded test company).
 * Everything else in this project is treated as disposable, so do not point it at a
 * database where that is not true.
 *
 * Usage: npm run clean:test          (dry run — prints what it would remove)
 *        npm run clean:test -- --execute
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const strip = s => s.trim().replace(/^["']|["']$/g, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  || (fs.existsSync('.env.local') && fs.readFileSync('.env.local', 'utf8').match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]);
if (!key) { console.error('SUPABASE_SERVICE_ROLE_KEY not found'); process.exit(1); }
const db = createClient('https://ejebukxlwgwebjgdicyb.supabase.co', strip(key), { auth: { persistSession: false } });

const KEEP = ['Poddar Exports', 'FabriOS Test Co'];
const JUNK_EMAIL = /@(fabrios-e2e|fabrios-test)\.com$/i;
const DRY = !process.argv.includes('--execute');

const { data: cos, error } = await db.from('companies').select('id,name');
if (error) { console.error(error.message); process.exit(1); }
const junk = cos.filter(c => !KEEP.includes(c.name));
console.log(DRY ? 'DRY RUN — nothing will be deleted\n' : 'EXECUTING\n');
console.log('keeping :', KEEP.join(', '));
console.log('removing:', junk.length ? junk.map(c => c.name).join(', ') : '(none)');

const ids = junk.map(c => c.id);
const childIds = async (table, col, vals) => vals.length
  ? ((await db.from(table).select('id').in(col, vals)).data ?? []).map(r => r.id) : [];

if (ids.length) {
  const orders = await childIds('order_headers', 'company_id', ids);
  const rows   = await childIds('order_rows', 'order_id', orders);
  const facs   = await childIds('factories', 'company_id', ids);
  const boms   = await childIds('bom_headers', 'company_id', ids);
  const pos    = await childIds('purchase_orders', 'company_id', ids);
  const grns   = await childIds('grn_headers', 'company_id', ids);
  const quos   = await childIds('quotations', 'company_id', ids);
  const prods  = await childIds('printing_products', 'company_id', ids);

  // children before parents; several company_id FKs do not cascade
  const steps = [
    ['production_material_consumptions','company_id',ids], ['production_entries','company_id',ids],
    ['material_issues','company_id',ids], ['attendance','company_id',ids],
    ['dispatch_records','company_id',ids], ['invoices','company_id',ids],
    ['subcontract_jobs','company_id',ids], ['stock_transactions','company_id',ids],
    ['grn_lines','grn_id',grns], ['grn_headers','company_id',ids],
    ['purchase_order_lines','po_id',pos], ['purchase_orders','company_id',ids],
    ['bom_lines','bom_id',boms], ['bom_headers','company_id',ids],
    ['quotation_lines','quotation_id',quos], ['quotations','company_id',ids],
    ['order_colourways','order_row_id',rows], ['order_rows','order_id',orders],
    ['order_headers','company_id',ids], ['stock_jobs','company_id',ids],
    ['inventory_items','company_id',ids], ['workers','company_id',ids],
    ['rate_masters','company_id',ids], ['shifts','factory_id',facs],
    ['printing_tables','factory_id',facs], ['stitching_lines','factory_id',facs],
    ['worker_types','company_id',ids], ['printing_product_fabrics','printing_product_id',prods],
    ['printing_products','company_id',ids], ['stitching_products','company_id',ids],
    ['factories','company_id',ids], ['buyers','company_id',ids], ['fabrics','company_id',ids],
    ['vendors','company_id',ids], ['onboarding_progress','company_id',ids],
    ['profiles','company_id',ids], ['companies','id',ids],
  ];
  let total = 0;
  for (const [t, col, vals] of steps) {
    if (!vals.length) continue;
    const q = DRY
      ? await db.from(t).select('id', { count: 'exact', head: true }).in(col, vals)
      : await db.from(t).delete({ count: 'exact' }).in(col, vals);
    if (q.error) { console.error(`  ! ${t}: ${q.error.message}`); process.exit(1); }
    if (q.count) { console.log(`  ${t.padEnd(32)} ${q.count}`); total += q.count; }
  }
  console.log(`\n${DRY ? 'would remove' : 'removed'}: ${total} rows`);
}

const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const junkUsers = users.users.filter(u => JUNK_EMAIL.test(u.email || ''));
console.log(`${DRY ? 'would remove' : 'removed'}: ${junkUsers.length} test logins`);
if (!DRY) for (const u of junkUsers) await db.auth.admin.deleteUser(u.id);

if (!DRY) {
  const { data: after } = await db.from('companies').select('name').order('name');
  console.log('companies now:', after.map(c => c.name).join(' | '));
}
