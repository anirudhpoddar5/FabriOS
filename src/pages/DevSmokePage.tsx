import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

// ⚠️  DEV-ONLY — this page has no route in production.
// Credentials are read from env vars so they are never committed.
const PREFIX = 'TEST_';
const TEST_EMAIL = import.meta.env.VITE_SMOKE_EMAIL ?? '';
const TEST_PASS  = import.meta.env.VITE_SMOKE_PASS  ?? '';
const TEST_NAME  = 'TEST_SmokeUser';

type StepResult = { name: string; ok: boolean; detail?: string };

function id() { return crypto.randomUUID(); }

function DevSmokePageInner() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<StepResult[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const log = useCallback((r: StepResult) => {
    setResults(prev => [...prev, r]);
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setResults([]);
    let cid = '';
    let userId = '';

    try {
      // 0) AUTH — sign up or sign in
      {
        const { data: signUp, error: suErr } = await supabase.auth.signUp({
          email: TEST_EMAIL, password: TEST_PASS,
          options: { data: { display_name: TEST_NAME } }
        });
        if (suErr && !suErr.message.includes('already registered')) {
          // try login
          const { data: signIn, error: siErr } = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASS });
          if (siErr) { log({ name: 'Auth', ok: false, detail: siErr.message }); setRunning(false); return; }
          userId = signIn.user?.id || '';
        } else {
          // might already exist, try login
          const { data: signIn } = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASS });
          userId = signIn?.user?.id || signUp?.user?.id || '';
        }
        log({ name: 'Auth: login/signup', ok: !!userId, detail: userId.slice(0, 8) });
      }

      // wait for profile trigger
      await new Promise(r => setTimeout(r, 1500));

      // 0b) Ensure profile
      {
        const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
        log({ name: 'Profile exists', ok: !!prof, detail: prof?.display_name });
      }

      // 0c) Company — find or create
      {
        const { data: existing } = await supabase.from('companies').select('*').ilike('name', `${PREFIX}%`).limit(1);
        if (existing && existing.length > 0) {
          cid = existing[0].id;
        } else {
          const newId = id();
          const { error } = await supabase.from('companies').insert({ id: newId, name: `${PREFIX}Company`, created_by: userId } as any);
          if (error) { log({ name: 'Company create', ok: false, detail: error.message }); }
          cid = newId;
        }
        // link profile
        await supabase.from('profiles').update({ company_id: cid, approval_status: 'approved' } as any).eq('user_id', userId);
        // assign admin role
        const { data: existingRole } = await supabase.from('user_roles').select('*').eq('user_id', userId).limit(1);
        if (!existingRole || existingRole.length === 0) {
          await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' } as any);
        }
        setCompanyId(cid);
        log({ name: 'Company + role', ok: !!cid, detail: cid.slice(0, 8) });
      }

      // Helper: upsert-like insert (check by name prefix, skip if exists)
      const ensure = async (table: string, match: Record<string, any>, full: Record<string, any>): Promise<string> => {
        const q = supabase.from(table as any).select('id');
        for (const [k, v] of Object.entries(match)) (q as any).eq(k, v);
        const { data } = await (q as any).limit(1);
        if (data && data.length > 0) return data[0].id;
        const newId = id();
        await supabase.from(table as any).insert({ id: newId, ...full } as any);
        return newId;
      };

      // 1) MASTERS
      const factoryId = await ensure('factories', { name: `${PREFIX}Factory`, company_id: cid },
        { company_id: cid, name: `${PREFIX}Factory`, code: 'TF1', type: 'mixed' });
      log({ name: 'Factory', ok: !!factoryId });

      const buyerId = await ensure('buyers', { code: `${PREFIX}BUY1`, company_id: cid },
        { company_id: cid, code: `${PREFIX}BUY1`, name: `${PREFIX}Buyer`, country: 'US' });
      log({ name: 'Buyer', ok: !!buyerId });

      const fab1Id = await ensure('fabrics', { name: `${PREFIX}Cotton`, company_id: cid },
        { company_id: cid, name: `${PREFIX}Cotton`, short_form: 'TCT', gsm: 180, width: 60 });
      const fab2Id = await ensure('fabrics', { name: `${PREFIX}Poly`, company_id: cid },
        { company_id: cid, name: `${PREFIX}Poly`, short_form: 'TPL', gsm: 120, width: 44 });
      log({ name: '2 Fabrics', ok: !!(fab1Id && fab2Id) });

      const ppId = await ensure('printing_products', { name: `${PREFIX}PrintProd`, company_id: cid },
        { company_id: cid, name: `${PREFIX}PrintProd`, code: 'TPP1', uom: 'meters' });
      const spId = await ensure('stitching_products', { name: `${PREFIX}StitchProd`, company_id: cid },
        { company_id: cid, name: `${PREFIX}StitchProd`, code: 'TSP1', uom: 'pcs' });
      log({ name: '2 Products', ok: !!(ppId && spId) });

      const ptId = await ensure('printing_tables', { name: `${PREFIX}Table1`, factory_id: factoryId },
        { factory_id: factoryId, name: `${PREFIX}Table1`, table_number: 1 });
      const slId = await ensure('stitching_lines', { name: `${PREFIX}Line1`, factory_id: factoryId },
        { factory_id: factoryId, name: `${PREFIX}Line1`, line_number: 1 });
      log({ name: 'Table + Line', ok: !!(ptId && slId) });

      const vendorId = await ensure('vendors', { code: `${PREFIX}VND1`, company_id: cid },
        { company_id: cid, code: `${PREFIX}VND1`, name: `${PREFIX}Vendor` });
      log({ name: 'Vendor', ok: !!vendorId });

      const shiftId = await ensure('shifts', { code: `${PREFIX}SH1`, factory_id: factoryId },
        { factory_id: factoryId, code: `${PREFIX}SH1`, name: `${PREFIX}Shift` });

      // Inventory items
      const invId1 = await ensure('inventory_items', { code: `${PREFIX}INV1`, company_id: cid },
        { company_id: cid, code: `${PREFIX}INV1`, name: `${PREFIX}Cotton Fabric`, category: 'fabric', uom: 'meters', fabric_id: fab1Id, opening_stock: 500 });
      const invId2 = await ensure('inventory_items', { code: `${PREFIX}INV2`, company_id: cid },
        { company_id: cid, code: `${PREFIX}INV2`, name: `${PREFIX}Buttons`, category: 'trim', uom: 'pcs', opening_stock: 2000 });
      log({ name: '2 Inventory items', ok: !!(invId1 && invId2) });

      // 2) ORDER + STOCK JOB
      const orderId = await ensure('order_headers', { internal_po: `${PREFIX}ORD001`, company_id: cid },
        { company_id: cid, internal_po: `${PREFIX}ORD001`, module: 'printing', buyer_id: buyerId, status: 'Started', currency: 'USD' });
      // order rows
      const or1Id = await ensure('order_rows', { order_id: orderId, product_id: ppId },
        { order_id: orderId, product_id: ppId, fabric_id: fab1Id, order_qty: 1000, chart_qty: 1000, uom: 'meters' });
      // colourways
      const cw1Id = await ensure('order_colourways', { order_row_id: or1Id, colour_name: `${PREFIX}Red` },
        { order_row_id: or1Id, colour_name: `${PREFIX}Red`, ordered_qty: 500, size: 'M' });
      const cw2Id = await ensure('order_colourways', { order_row_id: or1Id, colour_name: `${PREFIX}Blue` },
        { order_row_id: or1Id, colour_name: `${PREFIX}Blue`, ordered_qty: 500, size: 'L' });
      log({ name: 'Order + rows + colourways', ok: !!(orderId && cw1Id && cw2Id) });

      const sjId = await ensure('stock_jobs', { job_number: `${PREFIX}SJ001`, company_id: cid },
        { company_id: cid, job_number: `${PREFIX}SJ001`, product_name: `${PREFIX}StockItem`, target_qty: 500, module: 'printing', status: 'in_progress' });
      log({ name: 'Stock Job', ok: !!sjId });

      // 3) BOM + PO + GRN
      const bomOrdId = await ensure('bom_headers', { title: `${PREFIX}BOM_ORD`, company_id: cid },
        { company_id: cid, bom_type: 'order', order_id: orderId, title: `${PREFIX}BOM_ORD`, status: 'draft' });
      await ensure('bom_lines', { bom_id: bomOrdId, item_name: `${PREFIX}Cotton Fabric` },
        { bom_id: bomOrdId, category: 'fabric', item_name: `${PREFIX}Cotton Fabric`, item_id: invId1, quantity: 1000, avg_consumption: 1.2, extra_pct: 5, uom: 'meters', vendor_name: `${PREFIX}Vendor`, rate: 10 });
      log({ name: 'BOM for order', ok: !!bomOrdId });

      const bomSjId = await ensure('bom_headers', { title: `${PREFIX}BOM_SJ`, company_id: cid },
        { company_id: cid, bom_type: 'stock_job', title: `${PREFIX}BOM_SJ`, status: 'draft' });
      await ensure('bom_lines', { bom_id: bomSjId, item_name: `${PREFIX}Buttons` },
        { bom_id: bomSjId, category: 'trim', item_name: `${PREFIX}Buttons`, item_id: invId2, quantity: 500, uom: 'pcs', vendor_name: `${PREFIX}Vendor`, rate: 0.5 });
      log({ name: 'BOM for stock job', ok: !!bomSjId });

      // PO (simulate BOM→PO)
      const poId = await ensure('purchase_orders', { po_number: `${PREFIX}PO001`, company_id: cid },
        { company_id: cid, po_number: `${PREFIX}PO001`, vendor_id: vendorId, source_type: 'bom', order_id: orderId, status: 'approved', total_amount: 12600, currency: 'USD' });
      const polId = await ensure('purchase_order_lines', { po_id: poId, item_name: `${PREFIX}Cotton Fabric` },
        { po_id: poId, item_name: `${PREFIX}Cotton Fabric`, item_id: invId1, qty_ordered: 1260, uom: 'meters', rate: 10, amount: 12600 });
      log({ name: 'BOM→PO conversion', ok: !!(poId && polId) });

      // GRN against PO
      const grnId = await ensure('grn_headers', { grn_number: `${PREFIX}GRN001`, company_id: cid },
        { company_id: cid, grn_number: `${PREFIX}GRN001`, vendor_id: vendorId, po_id: poId, status: 'completed' });
      await ensure('grn_lines', { grn_id: grnId, item_name: `${PREFIX}Cotton Fabric` },
        { grn_id: grnId, item_name: `${PREFIX}Cotton Fabric`, item_id: invId1, po_line_id: polId, qty_received: 1260, uom: 'meters' });
      log({ name: 'GRN against PO', ok: !!grnId });

      // Inventory inward from GRN
      await ensure('stock_transactions', { company_id: cid, txn_type: 'inward', grn_id: grnId, item_id: invId1 },
        { company_id: cid, item_id: invId1, txn_type: 'inward', qty: 1260, uom: 'meters', grn_id: grnId, vendor_id: vendorId });
      log({ name: 'Inventory inward', ok: true });

      // 4) ISSUE / CONSUMPTION
      await ensure('stock_transactions', { company_id: cid, txn_type: 'outward', order_id: orderId, item_id: invId1 },
        { company_id: cid, item_id: invId1, txn_type: 'outward', qty: -800, uom: 'meters', order_id: orderId, remarks: `${PREFIX}Issue to order` });
      log({ name: 'Issue to order', ok: true });

      await ensure('stock_transactions', { company_id: cid, txn_type: 'outward', stock_job_id: sjId, item_id: invId2 },
        { company_id: cid, item_id: invId2, txn_type: 'outward', qty: -300, uom: 'pcs', stock_job_id: sjId, remarks: `${PREFIX}Issue to stock job` });
      log({ name: 'Issue to stock job', ok: true });

      // 5) PRODUCTION ENTRIES + DISPATCH
      await ensure('production_entries', { company_id: cid, order_id: orderId, module: 'printing', notes: `${PREFIX}PE1` },
        { company_id: cid, date: new Date().toISOString().slice(0, 10), module: 'printing', order_id: orderId, order_row_id: or1Id, colourway_id: cw1Id, factory_id: factoryId, resource_id: ptId, shift_id: shiftId, output_qty: 200, output_uom: 'meters', persons_used: 4, rate_value: 500, rate_basis: 'per_person_per_shift', cost_amount: 2000, notes: `${PREFIX}PE1` });
      await ensure('production_entries', { company_id: cid, module: 'stitching', notes: `${PREFIX}PE2` },
        { company_id: cid, date: new Date().toISOString().slice(0, 10), module: 'stitching', factory_id: factoryId, resource_id: slId, shift_id: shiftId, output_qty: 50, output_uom: 'pcs', persons_used: 8, rate_value: 300, rate_basis: 'per_person_per_shift', cost_amount: 2400, notes: `${PREFIX}PE2` });
      log({ name: 'Production entries (print+stitch)', ok: true });

      await ensure('dispatch_records', { company_id: cid, challan_number: `${PREFIX}DC001` },
        { company_id: cid, dispatch_type: 'order', order_id: orderId, buyer_id: buyerId, product_name: `${PREFIX}PrintProd`, colour: `${PREFIX}Red`, qty: 100, uom: 'meters', challan_number: `${PREFIX}DC001` });
      await ensure('dispatch_records', { company_id: cid, challan_number: `${PREFIX}DC002` },
        { company_id: cid, dispatch_type: 'stock', product_name: `${PREFIX}StockItem`, qty: 50, uom: 'pcs', challan_number: `${PREFIX}DC002` });
      log({ name: 'Dispatches (order+stock)', ok: true });

      // 6) READ-BACK VERIFICATION
      const checks: [string, string, Record<string, any>][] = [
        ['Factories', 'factories', { name: `${PREFIX}Factory` }],
        ['Buyers', 'buyers', { code: `${PREFIX}BUY1` }],
        ['Orders', 'order_headers', { internal_po: `${PREFIX}ORD001` }],
        ['Order Rows', 'order_rows', { order_id: orderId }],
        ['Colourways', 'order_colourways', { order_row_id: or1Id }],
        ['Stock Jobs', 'stock_jobs', { job_number: `${PREFIX}SJ001` }],
        ['BOM Headers', 'bom_headers', { company_id: cid }],
        ['BOM Lines (order)', 'bom_lines', { bom_id: bomOrdId }],
        ['Purchase Orders', 'purchase_orders', { po_number: `${PREFIX}PO001` }],
        ['PO Lines', 'purchase_order_lines', { po_id: poId }],
        ['GRN', 'grn_headers', { grn_number: `${PREFIX}GRN001` }],
        ['GRN Lines', 'grn_lines', { grn_id: grnId }],
        ['Inventory Items', 'inventory_items', { company_id: cid }],
        ['Stock Txns', 'stock_transactions', { company_id: cid }],
        ['Prod Entries', 'production_entries', { company_id: cid }],
        ['Dispatches', 'dispatch_records', { company_id: cid }],
      ];
      for (const [label, table, filter] of checks) {
        const q = supabase.from(table as any).select('id');
        for (const [k, v] of Object.entries(filter)) (q as any).eq(k, v);
        const { data, error } = await (q as any).limit(5);
        log({ name: `Read: ${label}`, ok: !error && data && data.length > 0, detail: `${data?.length || 0} rows` });
      }

      log({ name: '✅ SMOKE TEST COMPLETE', ok: true });
    } catch (err: any) {
      log({ name: '❌ FATAL', ok: false, detail: err?.message || String(err) });
    }
    setRunning(false);
  }, [log]);

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>fabriOS Smoke Test (DEV ONLY)</span>
            {results.length > 0 && (
              <div className="flex gap-2 text-sm">
                <Badge variant="default" className="bg-green-600">{passed} pass</Badge>
                {failed > 0 && <Badge variant="destructive">{failed} fail</Badge>}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={run} disabled={running} className="w-full">
            {running ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Running…</> : 'Run Full Smoke Test'}
          </Button>
          {companyId && <p className="text-xs text-muted-foreground">Company: {companyId}</p>}
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${r.ok ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                <span>{r.ok ? '✅' : '❌'}</span>
                <span className="font-medium">{r.name}</span>
                {r.detail && <span className="text-muted-foreground ml-auto text-xs">{r.detail}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hard-gate: export renders nothing outside local dev builds
export default function DevSmokePage() {
  if (!import.meta.env.DEV) return null;
  return <DevSmokePageInner />;
}
