#!/usr/bin/env node
/**
 * Creates (or refreshes) the isolated company the Playwright suite runs against, and
 * points the test account at it. Live data is never involved — the live company is
 * hard-coded below purely as a guard.
 *
 * Safe to re-run: it wipes and recreates the test company's masters each time.
 *
 * Usage: npm run seed:test
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env.local, and .env.test for the account email.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const strip = s => s.trim().replace(/^["']|["']$/g, '');
const readEnv = (file, key) => fs.existsSync(file)
  ? strip(fs.readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '') : '';

const key = process.env.SUPABASE_SERVICE_ROLE_KEY || readEnv('.env.local', 'SUPABASE_SERVICE_ROLE_KEY');
if (!key) { console.error('SUPABASE_SERVICE_ROLE_KEY not found'); process.exit(1); }
const db = createClient('https://ejebukxlwgwebjgdicyb.supabase.co', strip(key), { auth: { persistSession: false } });

const LIVE_COMPANY = 'Poddar Exports';   // guard — must never be the seed target
export const TEST_COMPANY = 'FabriOS Test Co';
const TEST_EMAIL = process.env.FABRIOS_TEST_EMAIL || readEnv('.env.test', 'FABRIOS_TEST_EMAIL');
if (!TEST_EMAIL) { console.error('FABRIOS_TEST_EMAIL not found (.env.test)'); process.exit(1); }
if (TEST_COMPANY === LIVE_COMPANY) { console.error('GUARD: refusing to seed over the live company'); process.exit(1); }

const die = (label, error) => { if (error) { console.error(`${label}: ${error.message}`); process.exit(1); } };

// ---- wipe any previous test company (never touches the live one) ----
const { data: existing } = await db.from('companies').select('id,name').eq('name', TEST_COMPANY);
for (const c of existing ?? []) {
  const { data: orders } = await db.from('order_headers').select('id').eq('company_id', c.id);
  const orderIds = (orders ?? []).map(o => o.id);
  if (orderIds.length) {
    const { data: rows } = await db.from('order_rows').select('id').in('order_id', orderIds);
    const rowIds = (rows ?? []).map(r => r.id);
    if (rowIds.length) await db.from('order_colourways').delete().in('order_row_id', rowIds);
    await db.from('order_rows').delete().in('order_id', orderIds);
  }
  for (const t of ['production_entries', 'order_headers', 'rate_masters', 'worker_types',
                   'printing_products', 'stitching_products', 'buyers', 'fabrics', 'onboarding_progress']) {
    await db.from(t).delete().eq('company_id', c.id);
  }
  const { data: facs } = await db.from('factories').select('id').eq('company_id', c.id);
  const facIds = (facs ?? []).map(f => f.id);
  if (facIds.length) {
    await db.from('shifts').delete().in('factory_id', facIds);
    await db.from('printing_tables').delete().in('factory_id', facIds);
    await db.from('stitching_lines').delete().in('factory_id', facIds);
  }
  await db.from('factories').delete().eq('company_id', c.id);
  await db.from('profiles').update({ company_id: null }).eq('company_id', c.id);
  await db.from('companies').delete().eq('id', c.id);
  console.log('removed previous test company');
}

// ---- create fresh ----
const ins = async (table, row, label) => {
  const { data, error } = await db.from(table).insert(row).select('id').single();
  die(label ?? table, error);
  return data.id;
};

const companyId = await ins('companies', { name: TEST_COMPANY, legal_name: `${TEST_COMPANY} Pvt Ltd`, is_active: true, working_days: [1,2,3,4,5,6] });
const factoryId = await ins('factories', { company_id: companyId, code: 'TF1', name: 'Test Factory', type: 'mixed', is_active: true });
const shiftId   = await ins('shifts',    { factory_id: factoryId, code: 'S1', name: 'Day Shift', start_time: '09:00', end_time: '18:00', is_active: true });
const factory2  = await ins('factories', { company_id: companyId, code: 'TF2', name: 'Second Factory', type: 'printing', is_active: true });
await ins('shifts', { factory_id: factory2, code: 'S1', name: 'Day Shift', start_time: '09:00', end_time: '18:00', is_active: true });

// two factories, interleaved tables — this is what the grouping test proves is fixed
for (const [i, fid] of [factoryId, factory2, factoryId, factory2].entries()) {
  await ins('printing_tables', { factory_id: fid, code: `PT${i + 1}`, name: `Table ${i + 1}`, size: `${8 + i}`, supervisor_name: i % 2 ? 'Umakant' : 'Master', is_active: true });
}

const workerTypeId = await ins('worker_types', { company_id: companyId, name: 'Printer', module: 'printing', is_active: true });
const rateId = await ins('rate_masters', { company_id: companyId, factory_id: factoryId, shift_id: shiftId, worker_type_id: workerTypeId, rate_basis: 'per_person_per_shift', rate_value: 500, effective_from: '2020-01-01', is_active: true });
const buyerId = await ins('buyers', { company_id: companyId, code: 'TB1', name: 'Test Buyer', country: 'India', is_active: true });
const fabricId = await ins('fabrics', { company_id: companyId, name: 'Test Cotton', short_form: 'TC', gsm: 120, width: 44, width_unit: 'inch', is_active: true });
const productId = await ins('printing_products', { company_id: companyId, code: 'TP1', name: 'Test Bedsheet', size: 'Queen', uom: 'meters', is_active: true });
await ins('stitching_products', { company_id: companyId, code: 'TS1', name: 'Test Kurta', size_spec: 'M', uom: 'pcs', is_active: true });

// ---- point the test account at it ----
const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const user = users.users.find(u => u.email === TEST_EMAIL);
if (!user) { console.error(`auth user ${TEST_EMAIL} not found`); process.exit(1); }
const { data: prof } = await db.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
if (prof) {
  die('profile update', (await db.from('profiles').update({ company_id: companyId, approval_status: 'approved', is_active: true }).eq('id', prof.id)).error);
} else {
  die('profile insert', (await db.from('profiles').insert({ user_id: user.id, email: TEST_EMAIL, display_name: 'FabriOS Tester', company_id: companyId, approval_status: 'approved', is_active: true }).select('id').single()).error);
}
await db.from('onboarding_progress').insert({ company_id: companyId, wizard_completed: true }).select('id').single().then(r => r.error && null);

console.log(JSON.stringify({ company: TEST_COMPANY, companyId, factoryId, shiftId, workerTypeId, rateId, buyerId, fabricId, productId, account: TEST_EMAIL }, null, 2));
