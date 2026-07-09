/**
 * Seed Demo Data — creates a coherent business dataset for all features
 *
 * Usage: node scripts/seed-demo-data.mjs
 *
 * Creates:
 * - 1 factory (mixed), 1 shift, 1 printing table, 1 stitching line
 * - 1 buyer, 1 fabric
 * - 2 orders (1 printing, 1 stitching) with colourways
 * - 3 workers (with worker type)
 * - 1 rate master
 * - Production entries (5 days)
 * - Attendance records (3 workers × 5 days)
 * - 1 material issue
 * - 1 quotation with line items
 * - 1 dispatch record
 * - 1 invoice
 * - 1 subcontract job
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

// Read env
function getEnv(key) {
  if (!existsSync(envPath)) return process.env[key];
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    const m = l.match(new RegExp(`^${key}=(.+)`));
    if (m) return m[1].trim();
  }
  return process.env[key];
}

const KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const URL = getEnv('VITE_SUPABASE_URL') || 'https://ejebukxlwgwebjgdicyb.supabase.co';

// Debug: show what we're connecting to
console.log('Connecting to:', URL);
console.log('Key length:', KEY ? KEY.length : 0);

const admin = createClient(URL, KEY);

function uid() { return crypto.randomUUID(); }
function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

async function seed() {
  console.log('=== FabriOS Demo Data Seeder ===\n');

  // Find test user
  const { data: profile } = await admin.from('profiles').select('id, company_id').eq('email', 'test@fabrios-e2e.com').single();
  if (!profile) { console.error('No test user found'); process.exit(1); }
  const cid = profile.company_id;
  console.log('Company:', cid);

  // Clean existing data for this company (newer features first)
  const tables = ['invoices', 'subcontract_jobs', 'quotations', 'quotation_lines', 'material_issues', 'attendance', 'production_entries', 'dispatch_records', 'order_colourways', 'order_rows', 'order_headers', 'workers', 'buyers', 'fabrics', 'rate_masters', 'worker_types', 'printing_tables', 'stitching_lines', 'shifts', 'factories'];
  for (const t of tables) {
    try { await admin.from(t).delete().eq('company_id', cid); } catch {}
  }
  // Clean non-company-scoped tables
  try { await admin.from('shifts').delete().in('factory_id', (await admin.from('factories').select('id').eq('company_id', cid)).data?.map(f => f.id) || []); } catch {}
  try { await admin.from('printing_tables').delete().in('factory_id', (await admin.from('factories').select('id').eq('company_id', cid)).data?.map(f => f.id) || []); } catch {}
  try { await admin.from('stitching_lines').delete().in('factory_id', (await admin.from('factories').select('id').eq('company_id', cid)).data?.map(f => f.id) || []); } catch {}
  try { await admin.from('factories').delete().eq('company_id', cid); } catch {}
  console.log('  Cleaned existing data\n');

  // 1. FACTORY
  const factoryId = uid();
  const factory2Id = uid();
  await admin.from('factories').insert([
    { id: factoryId, company_id: cid, code: 'F-01', name: 'Main Factory', type: 'mixed', is_active: true },
    { id: factory2Id, company_id: cid, code: 'F-02', name: 'Unit 2', type: 'mixed', is_active: true },
  ]);
  console.log('  1. Factories: Main Factory + Unit 2');

  // 2. SHIFT
  const shiftId = uid();
  await admin.from('shifts').insert({ id: shiftId, factory_id: factoryId, code: 'S1', name: 'General', start_time: '09:00', end_time: '18:00', is_active: true });
  console.log('  2. Shift: General (09:00-18:00)');

  // 3. PRINTING TABLE + STITCHING LINE
  const tableId = uid();
  const lineId = uid();
  await admin.from('printing_tables').insert({ id: tableId, factory_id: factoryId, code: 'PT-01', name: 'Print Table 1', size: 'Large', is_active: true });
  await admin.from('stitching_lines').insert({ id: lineId, factory_id: factoryId, code: 'SL-01', name: 'Stitch Line 1', machines: 10, is_active: true });
  console.log('  3. Resources: Print Table 1 + Stitch Line 1');

  // 4. BUYER
  const buyerId = uid();
  await admin.from('buyers').insert({ id: buyerId, company_id: cid, code: 'BUY-001', name: 'Acme Corp', contact_person: 'John Doe', country: 'USA', phone: '+1-555-0100', email: 'john@acme.com', is_active: true });
  console.log('  4. Buyer: Acme Corp');

  // 5. FABRIC
  const fabricId = uid();
  await admin.from('fabrics').insert({ id: fabricId, company_id: cid, name: 'Cotton 180 GSM', short_form: 'CT180', gsm: 180, is_active: true });
  console.log('  5. Fabric: Cotton 180 GSM');

  // 6. WORKER TYPE + RATE MASTER
  const wtId = uid();
  await admin.from('worker_types').insert({ id: wtId, company_id: cid, name: 'Printer', module: 'printing', is_active: true });
  const rmId = uid();
  await admin.from('rate_masters').insert({ id: rmId, company_id: cid, factory_id: factoryId, shift_id: shiftId, worker_type_id: wtId, rate_basis: 'per_person_per_shift', rate_value: 500, effective_from: '2026-01-01', is_active: true });
  console.log('  6. Worker Type: Printer @ $500/shift');

  // 7. WORKERS
  const workers = [];
  for (let i = 1; i <= 3; i++) {
    const w = { id: uid(), company_id: cid, factory_id: factoryId, employee_code: `EMP-00${i}`, name: `Worker ${['Amit','Bala','Chen'][i-1]}`, worker_type_id: wtId, phone: `555-010${i}`, hourly_rate: 62.5, is_active: true };
    workers.push(w);
    await admin.from('workers').insert(w);
  }
  console.log(`  7. Workers: ${workers.map(w => w.name).join(', ')}`);

  // 8. ORDER HEADERS + ROWS + COLOURWAYS
  const order1Id = uid();
  await admin.from('order_headers').insert({ id: order1Id, company_id: cid, module: 'printing', internal_po: 'PO-P-0001', buyer_id: buyerId, style: 'T-Shirt Classic', currency: 'USD', target_end_date: daysAgo(-7), buyer_delivery_date: daysAgo(-3), status: 'Started', remarks: 'Rush order' });
  const row1Id = uid();
  await admin.from('order_rows').insert({ id: row1Id, order_id: order1Id, product_id: null, fabric_id: fabricId, order_qty: 5000, uom: 'pcs', rate_per_item: 12.50, no_of_colours: 2 });
  const cw1Id = uid(), cw2Id = uid();
  await admin.from('order_colourways').insert([
    { id: cw1Id, order_row_id: row1Id, colour_name: 'Navy Blue', ordered_qty: 2500, uom: 'pcs', sort_order: 0 },
    { id: cw2Id, order_row_id: row1Id, colour_name: 'White', ordered_qty: 2500, uom: 'pcs', sort_order: 1 },
  ]);

  const order2Id = uid();
  await admin.from('order_headers').insert({ id: order2Id, company_id: cid, module: 'stitching', internal_po: 'PO-S-0001', buyer_id: buyerId, style: 'Polo Shirt', currency: 'USD', target_end_date: daysAgo(-14), buyer_delivery_date: daysAgo(-10), status: 'Started' });
  const row2Id = uid();
  await admin.from('order_rows').insert({ id: row2Id, order_id: order2Id, product_id: null, fabric_id: fabricId, order_qty: 3000, uom: 'pcs', rate_per_item: 8.75, no_of_colours: 3 });
  const cw3Id = uid(), cw4Id = uid(), cw5Id = uid();
  await admin.from('order_colourways').insert([
    { id: cw3Id, order_row_id: row2Id, colour_name: 'Red', ordered_qty: 1000, uom: 'pcs', sort_order: 0 },
    { id: cw4Id, order_row_id: row2Id, colour_name: 'Blue', ordered_qty: 1000, uom: 'pcs', sort_order: 1 },
    { id: cw5Id, order_row_id: row2Id, colour_name: 'Black', ordered_qty: 1000, uom: 'pcs', sort_order: 2 },
  ]);
  console.log('  8. Orders: PO-P-0001 (Printing, 5000pcs) + PO-S-0001 (Stitching, 3000pcs)');

  // 9. PRODUCTION ENTRIES (5 days × 2 orders × some colourways)
  const entryData = [];
  for (let d = 4; d >= 0; d--) {
    const date = daysAgo(d);
    // Printing entries
    entryData.push({ company_id: cid, date, module: 'printing', order_id: order1Id, colourway_id: Math.random() > 0.5 ? cw1Id : cw2Id, factory_id: factoryId, shift_id: shiftId, resource_id: tableId, worker_type_id: wtId, persons_used: 3 + Math.floor(Math.random() * 3), output_qty: 150 + Math.floor(Math.random() * 200), output_uom: 'pcs', rate_master_id: rmId, rate_basis: 'per_person_per_shift', rate_value: 500, cost_amount: 1500 + Math.floor(Math.random() * 1000), notes: 'Morning shift' });
    // Stitching entries
    entryData.push({ company_id: cid, date, module: 'stitching', order_id: order2Id, colourway_id: Math.random() > 0.5 ? cw3Id : cw4Id, factory_id: factoryId, shift_id: shiftId, resource_id: lineId, worker_type_id: wtId, persons_used: 2 + Math.floor(Math.random() * 2), output_qty: 80 + Math.floor(Math.random() * 150), output_uom: 'pcs', rate_master_id: rmId, rate_basis: 'per_person_per_shift', rate_value: 500, cost_amount: 1000 + Math.floor(Math.random() * 800), notes: 'Evening shift' });
  }
  for (const e of entryData) { e.id = uid(); await admin.from('production_entries').insert(e); }
  console.log(`  9. Production Entries: ${entryData.length} entries across 5 days`);

  // 10. ATTENDANCE (3 workers × 5 days)
  for (const w of workers) {
    for (let d = 4; d >= 0; d--) {
      const date = daysAgo(d);
      const status = d === 2 ? 'absent' : (d === 4 && w === workers[2]) ? 'leave' : 'present';
      const aId = uid();
      await admin.from('attendance').insert({ id: aId, company_id: cid, worker_id: w.id, date, shift_id: shiftId, hours_worked: status === 'present' ? 8 : 0, overtime_hours: status === 'present' && Math.random() > 0.7 ? 1 : 0, status, notes: '' });
    }
  }
  console.log('  10. Attendance: 15 records (3 workers × 5 days, incl. absent/leave)');

  // 11. MATERIAL ISSUES
  const miId = uid();
  await admin.from('material_issues').insert({ id: miId, company_id: cid, order_id: order1Id, item_name: 'Cotton 180 GSM', uom: 'meters', qty_issued: 520, qty_consumed: 500, date: daysAgo(2), notes: 'For Navy Blue' });
  const mi2Id = uid();
  await admin.from('material_issues').insert({ id: mi2Id, company_id: cid, order_id: order2Id, item_name: 'Cotton 180 GSM', uom: 'meters', qty_issued: 300, qty_consumed: 300, date: daysAgo(1), notes: 'Full consumption' });
  console.log('  11. Material Issues: 2 records (1 with waste, 1 clean)');

  // 12. QUOTATION + LINES
  const qId = uid();
  await admin.from('quotations').insert({ id: qId, company_id: cid, quotation_number: 'Q-0001', buyer_id: buyerId, date: daysAgo(10), valid_until: daysAgo(30), currency: 'USD', subtotal: 43750, tax_percent: 10, status: 'draft' });
  await admin.from('quotation_lines').insert([
    { quotation_id: qId, description: 'Premium Cotton T-Shirts', qty: 2500, uom: 'pcs', rate: 12.50, sort_order: 0 },
    { quotation_id: qId, description: 'Classic Polo Shirts', qty: 1000, uom: 'pcs', rate: 15.00, sort_order: 1 },
    { quotation_id: qId, description: 'Canvas Tote Bags', qty: 500, uom: 'pcs', rate: 7.50, sort_order: 2 },
  ]);
  console.log('  12. Quotation: Q-0001 ($43,750 + 10% tax)');

  // 13. DISPATCH RECORD
  const dispId = uid();
  await admin.from('dispatch_records').insert({ id: dispId, company_id: cid, dispatch_date: daysAgo(1), order_id: order1Id, buyer_id: buyerId, qty: 2000, uom: 'pcs', product_name: 'Navy Blue T-Shirts', colour: 'Navy Blue', vehicle_number: 'KA-01-AB-1234', challan_number: 'CH-001', dispatch_type: 'order' });
  console.log('  13. Dispatch: 2000 pcs Navy Blue T-Shirts');

  // 14. INVOICE
  const invId = uid();
  await admin.from('invoices').insert({ id: invId, company_id: cid, invoice_number: 'INV-2026-001', buyer_id: buyerId, order_id: order1Id, dispatch_id: dispId, invoice_date: daysAgo(1), due_date: daysAgo(29), currency: 'USD', subtotal: 25000, tax_percent: 10, status: 'sent', notes: 'Against dispatch CH-001' });
  console.log('  14. Invoice: INV-2026-001 ($25,000 + 10% tax, due in 30d)');

  // 15. SUBCONTRACT JOB
  const scId = uid();
  await admin.from('subcontract_jobs').insert({ id: scId, company_id: cid, job_number: 'SC-001', order_id: order2Id, process: 'stitching', product_description: 'Polo Shirts - Red', qty_sent: 500, qty_received: 200, rate: 3.50, send_date: daysAgo(5), expected_return_date: daysAgo(2), status: 'partial', notes: 'Partial received' });
  console.log('  15. Subcontract: SC-001 (500 sent, 200 received, partial)\n');

  console.log('=== Seed Complete ===');
  console.log('\nBusiness Dataset Summary:');
  console.log('  Factory: Main Factory (mixed) + Unit 2');
  console.log('  Buyer: Acme Corp (USA)');
  console.log('  Orders:');
  console.log('    PO-P-0001: 5000 pcs T-Shirts (Navy+White) @ $12.50 — Started, overdue');
  console.log('    PO-S-0001: 3000 pcs Polo Shirts (Red+Blue+Black) @ $8.75 — Started, overdue');
  console.log('  Production: 10 entries across 5 days (~680 pcs/day avg)');
  console.log('  Workers: Amit, Bala, Chen (3 people, 5 days attendance)');
  console.log('  Material: 800m consumed (20m waste on order 1)');
  console.log('  Quotation: Q-0001 (draft, $48,125 grand total)');
  console.log('  Dispatch: 2000 pcs shipped to Acme Corp');
  console.log('  Invoice: INV-2026-001 ($27,500 total, due in 30d, status: sent)');
  console.log('  Subcontract: SC-001 (500 sent to vendor, 200 received back)');
}

seed().catch(console.error);
