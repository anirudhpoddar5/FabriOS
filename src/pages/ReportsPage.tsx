import { useState, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, TrendingUp, DollarSign, AlertTriangle, Package, ShoppingCart, BarChart3, CheckCircle2, Users, ClipboardList, Truck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { exportPDF } from '@/lib/pdf-export';
import * as XLSX from 'xlsx';
import { ExplainerTip } from '@/components/ExplainerTip';

function exportCSV(headers: string[], rows: any[][], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function exportExcel(headers: string[], rows: any[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename.replace(/\.csv$/, '.xlsx'));
}

const QUICK_DATES = [
  { label: 'Yesterday', fn: () => { const d = new Date(); d.setDate(d.getDate()-1); const s = d.toISOString().slice(0,10); return { from: s, to: s }; }},
  { label: 'Last 7 days', fn: () => { const d = new Date(); d.setDate(d.getDate()-7); return { from: d.toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) }; }},
  { label: 'This month', fn: () => { const d = new Date(); return { from: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, to: d.toISOString().slice(0,10) }; }},
  { label: 'Last month', fn: () => { const d = new Date(); d.setMonth(d.getMonth()-1); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const last = new Date(y, d.getMonth()+1, 0).getDate(); return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` }; }},
];

function getOrderHealth(order: any, entries: any[], today: string): 'on-time' | 'delayed' | 'not-started' | 'wip' {
  if (order.status === 'Completed' || order.status === 'Shipped') return 'on-time';
  if (order.status === 'Cancelled') return 'on-time';
  const orderEntries = entries.filter((e: any) => e.orderId === order.id);
  if (orderEntries.length === 0) return 'not-started';
  if (order.targetEndDate && order.targetEndDate < today) return 'delayed';
  return 'wip';
}

export default function ReportsPage() {
  const { data } = useData();
  const { profile, currentModule } = useAuth();
  const companyId = profile?.company_id;
  const [tab, setTab] = useState('order-status');
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [filters, setFilters] = useState({ dateFrom: thirtyAgo, dateTo: todayStr, module: 'all', buyerId: 'all', status: 'all' });
  const set = (k: string, v: string) => setFilters(p => ({ ...p, [k]: v }));

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatch_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('dispatch_records').select('*, buyers(name)').eq('company_id', companyId); return data || [];
    }, enabled: !!companyId,
  });
  const { data: pos = [] } = useQuery({
    queryKey: ['po_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('purchase_orders').select('*, vendors(name)').eq('company_id', companyId); return data || [];
    }, enabled: !!companyId,
  });
  const { data: poLines = [] } = useQuery({
    queryKey: ['polines_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('purchase_order_lines').select('*, purchase_orders(po_number, vendor_id, po_date, status, vendors(name))').limit(1000); return data || [];
    }, enabled: !!companyId,
  });
  const { data: invItems = [] } = useQuery({
    queryKey: ['inv_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('inventory_items').select('*').eq('company_id', companyId); return data || [];
    }, enabled: !!companyId,
  });
  const { data: stockTxns = [] } = useQuery({
    queryKey: ['stxn_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('stock_transactions').select('*, inventory_items(name, code)').eq('company_id', companyId).order('txn_date', { ascending: false }).limit(500); return data || [];
    }, enabled: !!companyId,
  });
  const { data: materialIssues = [] } = useQuery({
    queryKey: ['material_issues_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('material_issues').select('*').eq('company_id', companyId); return data || [];
    }, enabled: !!companyId,
  });
  // Per-order material rates: BOM line rate for the item, keyed by `${orderId}|${itemId}` (plan: "use the rate from the BOM line that matches the item")
  const { data: bomHeaders = [] } = useQuery({
    queryKey: ['bom_headers_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('bom_headers').select('order_id, bom_lines(item_id, rate)').eq('company_id', companyId).not('order_id', 'is', null);
      return data || [];
    }, enabled: !!companyId,
  });
  const bomRateByOrderItem = useMemo(() => {
    const map = new Map<string, number>();
    bomHeaders.forEach((h: any) => (h.bom_lines || []).forEach((l: any) => {
      if (h.order_id && l.item_id && l.rate != null) map.set(`${h.order_id}|${l.item_id}`, Number(l.rate));
    }));
    return map;
  }, [bomHeaders]);
  // Full BOM headers+lines for the Consumption vs BOM report (needs title/category/quantity/uom, not just rate)
  const { data: bomHeadersFull = [] } = useQuery({
    queryKey: ['bom_headers_full_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('bom_headers').select('id, title, order_id, bom_lines(*)').eq('company_id', companyId);
      return data || [];
    }, enabled: !!companyId,
  });

  const lookup = useMemo(() => ({
    buyer: (id: string) => { const b = data.buyers.find((x: any) => x.id === id); return b ? `${b.code}${b.name ? ' - ' + b.name : ''}` : '-'; },
    factory: (id: string) => data.factories.find((f: any) => f.id === id)?.name || '-',
    resource: (id: string) => {
      const pt = data.printingTables.find((t: any) => t.id === id);
      if (pt) return (pt.code || '') + ' ' + pt.name;
      const sl = data.stitchingLines.find((l: any) => l.id === id);
      return sl ? (sl.code || '') + ' ' + sl.name : '-';
    },
    orderPO: (id: string) => {
      const po = data.printingOrders.find((o: any) => o.id === id);
      if (po) return po.internalPO;
      const so = data.stitchingOrders.find((o: any) => o.id === id);
      return so ? so.internalPO : '-';
    },
    colour: (id: string) => {
      const pc = data.printingColourways.find((c: any) => c.id === id);
      if (pc) return pc.colourName;
      const sc = data.stitchingColourways.find((c: any) => c.id === id);
      return sc ? sc.colourName : '-';
    },
    shift: (id: string) => data.shifts.find((s: any) => s.id === id)?.name || '-',
  }), [data]);

  const allOrders = useMemo(() => [
    ...data.printingOrders.map((o: any) => ({ ...o, module: 'printing' })),
    ...data.stitchingOrders.map((o: any) => ({ ...o, module: 'stitching' })),
  ].filter((o: any) => {
    if (filters.module !== 'all' && o.module !== filters.module) return false;
    if (filters.buyerId !== 'all' && o.buyerId !== filters.buyerId) return false;
    if (filters.status !== 'all' && o.status !== filters.status) return false;
    return true;
  }), [data, filters]);

  const allColourways = useMemo(() => [...data.printingColourways, ...data.stitchingColourways], [data]);

  const filteredEntries = useMemo(() => data.entries.filter((e: any) => {
    if (filters.module !== 'all' && e.module !== filters.module) return false;
    if (filters.dateFrom && e.date < filters.dateFrom) return false;
    if (filters.dateTo && e.date > filters.dateTo) return false;
    return true;
  }), [data, filters]);

  const FilterBar = () => (
    <div className="flex flex-wrap gap-2 mb-3 items-end">
      {QUICK_DATES.map(q => (
        <Button key={q.label} size="sm" variant="outline" className="text-[10px] h-7" onClick={() => { const d = q.fn(); set('dateFrom', d.from); set('dateTo', d.to); }}>{q.label}</Button>
      ))}
      <div className="space-y-0.5"><Label className="text-[10px]">From</Label><Input type="date" className="h-8 w-[120px] text-xs" value={filters.dateFrom} onChange={e => set('dateFrom', e.target.value)} /></div>
      <div className="space-y-0.5"><Label className="text-[10px]">To</Label><Input type="date" className="h-8 w-[120px] text-xs" value={filters.dateTo} onChange={e => set('dateTo', e.target.value)} /></div>
      <div className="space-y-0.5"><Label className="text-[10px]">Module</Label>
        <Select value={filters.module} onValueChange={v => set('module', v)}><SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="printing">Printing</SelectItem><SelectItem value="stitching">Stitching</SelectItem></SelectContent></Select>
      </div>
      <div className="space-y-0.5"><Label className="text-[10px]">Buyer</Label>
        <Select value={filters.buyerId} onValueChange={v => set('buyerId', v)}><SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All</SelectItem>{data.buyers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="space-y-0.5"><Label className="text-[10px]">Status</Label>
        <Select value={filters.status} onValueChange={v => set('status', v)}><SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="Started">Started</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem><SelectItem value="Shipped">Shipped</SelectItem></SelectContent></Select>
      </div>
    </div>
  );

  const orderStatusRows = useMemo(() => allOrders.flatMap((o: any) => {
    const cws = allColourways.filter((c: any) => c.orderId === o.id);
    return cws.map((c: any) => {
      const produced = data.entries.filter((e: any) => e.orderId === o.id && e.colourwayId === c.id).reduce((s: number, e: any) => s + e.outputQty, 0);
      const dispatched = dispatches.filter((d: any) => d.order_id === o.id).reduce((s: number, d: any) => s + Number(d.qty), 0);
      const pct = c.orderedQty > 0 ? (produced / c.orderedQty) * 100 : 0;
      const health = getOrderHealth(o, data.entries, todayStr);
      const isDelayed = health === 'delayed';
      return { module: o.module, buyer: lookup.buyer(o.buyerId), style: o.style, po: o.internalPO, colour: c.colourName, ordered: c.orderedQty, produced, dispatched, balanceProd: c.orderedQty - produced, balanceShip: produced - dispatched, pct, target: o.targetEndDate, status: o.status, isDelayed };
    });
  }), [allOrders, allColourways, data.entries, dispatches, lookup, todayStr]);

  const productionSummary = useMemo(() => {
    const byDate: Record<string, { date: string; output: number; cost: number; entries: number }> = {};
    filteredEntries.forEach((e: any) => {
      if (!byDate[e.date]) byDate[e.date] = { date: e.date, output: 0, cost: 0, entries: 0 };
      byDate[e.date].output += e.outputQty;
      byDate[e.date].cost += e.costAmount;
      byDate[e.date].entries += 1;
    });
    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredEntries]);

  const dispatchRows = useMemo(() => dispatches.filter((d: any) => (!filters.dateFrom || d.dispatch_date >= filters.dateFrom) && (!filters.dateTo || d.dispatch_date <= filters.dateTo)), [dispatches, filters]);

  // Factory output: same output/cost/entries sums as productionSummary above, bucketed by factory_id
  // instead of by date. Respects the same filteredEntries (module/date filters) as the Production and
  // Monthly Trend tabs — factory names come from data.factories via lookup.factory(), already loaded in AppData.
  const factorySummary = useMemo(() => {
    const map: Record<string, { name: string; output: number; cost: number; entries: number }> = {};
    filteredEntries.forEach((e: any) => {
      const key = e.factoryId || 'unassigned';
      const name = e.factoryId ? lookup.factory(e.factoryId) : 'Unassigned';
      if (!map[key]) map[key] = { name, output: 0, cost: 0, entries: 0 };
      map[key].output += e.outputQty;
      map[key].cost += e.costAmount;
      map[key].entries += 1;
    });
    return Object.values(map).sort((a, b) => b.output - a.output);
  }, [filteredEntries, lookup]);

  // Monthly trend: same output/cost/entries sums as productionSummary above, bucketed by month (e.date.slice(0,7))
  // instead of by exact date. Respects the same filteredEntries (module/date filters) as the Production tab —
  // the original 5f51b7c version read unfiltered data.entries while still rendering <FilterBar />, which was
  // inconsistent; matching the Production tab's already-fixed convention here instead.
  const monthlyTrend = useMemo(() => {
    const byMonth: Record<string, { month: string; output: number; cost: number; entries: number }> = {};
    filteredEntries.forEach((e: any) => {
      const month = e.date ? e.date.slice(0, 7) : '';
      if (!month) return;
      if (!byMonth[month]) byMonth[month] = { month, output: 0, cost: 0, entries: 0 };
      byMonth[month].output += e.outputQty;
      byMonth[month].cost += e.costAmount;
      byMonth[month].entries += 1;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredEntries]);

  const profitLossData = useMemo(() => allOrders.map((o: any) => {
    const labourCost = data.entries.filter((e: any) => e.orderId === o.id).reduce((s: number, e: any) => s + e.costAmount, 0);
    const matIssues = materialIssues.filter((i: any) => i.order_id === o.id);
    // materialCost only sums lines with a resolvable BOM rate; unresolved lines contribute 0 rather than a fabricated rate
    const materialCost = matIssues.reduce((s: number, i: any) => {
      const rate = bomRateByOrderItem.get(`${o.id}|${i.item_id}`);
      return s + (rate != null ? Number(i.qty_consumed || 0) * rate : 0);
    }, 0);
    // true only when material was issued but no BOM rate could be resolved for any line (cost is unknown, not zero)
    const materialCostUnknown = matIssues.length > 0 && !matIssues.some((i: any) => bomRateByOrderItem.has(`${o.id}|${i.item_id}`));
    // Order value: sum of order_rows (rate_per_item * order_qty), same source/pattern as OrderDetailPage's order value calc
    const orderRowsForOrder = data.orderRows.filter((r: any) => r.orderId === o.id);
    const rowValue = orderRowsForOrder.reduce((s: number, r: any) => s + (r.orderQty || 0) * (r.ratePerItem || 0), 0);
    const qty = orderRowsForOrder.reduce((s: number, r: any) => s + (r.orderQty || 0), 0);
    const orderInvoices = data.invoices.filter((i: any) => i.orderId === o.id);
    const revenue = orderInvoices.length > 0
      ? orderInvoices.reduce((s: number, i: any) => s + i.grandTotal, 0)
      : rowValue;
    const totalCost = labourCost + materialCost;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return {
      module: o.module, po: o.internalPO, buyer: lookup.buyer(o.buyerId), style: o.style,
      qty, revenue, labourCost, materialCost, materialCostUnknown, totalCost, profit, margin, status: o.status,
    };
  }), [allOrders, data.orderRows, data.entries, data.invoices, materialIssues, bomRateByOrderItem, lookup]);

  const filterObj = { From: filters.dateFrom, To: filters.dateTo, Module: filters.module, Status: filters.status };

  const tabs = [
    { id: 'order-status', label: 'Order Status' },
    { id: 'production', label: 'Production' },
    { id: 'daily', label: 'Daily Detail' },
    { id: 'factory', label: 'Factory Output' },
    { id: 'delayed', label: 'Delayed' },
    { id: 'dispatch', label: 'Dispatch' },
    { id: 'po-status', label: 'PO Status' },
    { id: 'pending-purchase', label: 'Pending Purchase' },
    { id: 'grn-pending', label: 'GRN Pending' },
    { id: 'bill-tracking', label: 'Bill Tracking' },
    { id: 'stock', label: 'Stock On Hand' },
    { id: 'shortage', label: 'Shortage' },
    { id: 'inward-outward', label: 'Inward/Outward' },
    { id: 'consumption', label: 'Consumption vs BOM' },
    { id: 'vendor-perf', label: 'Vendor Performance' },
    { id: 'buyer-summary', label: 'By Buyer' },
    { id: 'profit-loss', label: 'Profit/Loss' },
    { id: 'monthly-trend', label: 'Monthly Trend' },
  ];

  const ExportBtns = ({ csvHeaders, csvRows, csvFile, pdfTitle, pdfHeaders, pdfRows }: any) => (
    <div className="flex justify-end gap-2 mb-2">
      <Button size="sm" variant="outline" onClick={() => exportExcel(csvHeaders, csvRows, csvFile)}><Download className="h-3.5 w-3.5 mr-1" /> Excel</Button>
      <Button size="sm" variant="outline" onClick={() => exportCSV(csvHeaders, csvRows, csvFile)}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
      <Button size="sm" variant="outline" onClick={() => exportPDF(pdfTitle, pdfHeaders || csvHeaders, pdfRows || csvRows, filterObj)}><FileText className="h-3.5 w-3.5 mr-1" /> PDF</Button>
    </div>
  );

  const ReportTable = ({ headers, rows, emptyMsg }: { headers: string[]; rows: React.ReactNode[][]; emptyMsg?: string }) => (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>{headers.map(h => <TableHead key={h} className="text-[10px] h-8 whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-sm text-muted-foreground">{emptyMsg || 'No data'}</TableCell></TableRow>
          : rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className="text-xs py-1.5 whitespace-nowrap">{c}</TableCell>)}</TableRow>)}
        </TableBody>
      </Table>
    </CardContent></Card>
  );

  const orderSummary = useMemo(() => {
    const totalOrders = allOrders.length;
    const totalOrdered = allOrders.reduce((s: number, o: any) => s + (o.orderQty || 0), 0);
    const totalProduced = data.entries.filter((e: any) => allOrders.some((o: any) => o.id === e.orderId)).reduce((s: number, e: any) => s + e.outputQty, 0);
    const completed = allOrders.filter((o: any) => o.status === 'Completed' || o.status === 'Shipped').length;
    return { totalOrders, totalOrdered, totalProduced, completed, pct: totalOrders > 0 ? (completed / totalOrders) * 100 : 0 };
  }, [allOrders, data.entries]);

  const prodSummary = useMemo(() => {
    const totalEntries = filteredEntries.length;
    const totalOutput = filteredEntries.reduce((s: number, e: any) => s + e.outputQty, 0);
    const totalCost = filteredEntries.reduce((s: number, e: any) => s + e.costAmount, 0);
    return { totalEntries, totalOutput, totalCost };
  }, [filteredEntries]);

  const delayedSummary = useMemo(() => {
    const delayed = orderStatusRows.filter(r => r.isDelayed);
    const totalOverdue = delayed.reduce((s: number, r: any) => s + r.balanceProd, 0);
    return { count: delayed.length, overdueQty: totalOverdue };
  }, [orderStatusRows]);

  const dispatchSummary = useMemo(() => {
    const totalDispatch = dispatchRows.length;
    const totalQty = dispatchRows.reduce((s: number, d: any) => s + (d.qty || 0), 0);
    const uniqueBuyers = new Set(dispatchRows.map((d: any) => (d as any).buyers?.name)).size;
    return { count: totalDispatch, qty: totalQty, buyers: uniqueBuyers };
  }, [dispatchRows]);

  const poSummary = useMemo(() => {
    const totalPOs = pos.length;
    const totalAmt = pos.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
    const pending = pos.filter((p: any) => p.status === 'draft' || p.status === 'sent' || p.status === 'partial').length;
    return { count: totalPOs, amount: totalAmt, pending };
  }, [pos]);

  const pendingPurchase = useMemo(() => pos.filter((p: any) => p.status !== 'closed' && p.status !== 'cancelled' && p.status !== 'received'), [pos]);
  const pendingPurchaseSummary = useMemo(() => ({
    count: pendingPurchase.length,
    amount: pendingPurchase.reduce((s: number, p: any) => s + (p.total_amount || 0), 0),
  }), [pendingPurchase]);

  const grnPendingData = useMemo(() => {
    return poLines.map((pl: any) => {
      const po = (pl as any).purchase_orders;
      const vendorName = po?.vendors?.name || '-';
      const ordered = Number(pl.qty_ordered) || 0;
      const received = Number(pl.qty_received) || 0;
      const pending = ordered - received;
      return { poNumber: po?.po_number || '-', vendor: vendorName, item: pl.item_name, uom: pl.uom, ordered, received, pending, poDate: po?.po_date || '-', poStatus: po?.status || '-' };
    }).filter((r: any) => r.pending > 0);
  }, [poLines]);
  const grnPendingSummary = useMemo(() => ({
    lines: grnPendingData.length,
    pendingQty: grnPendingData.reduce((s: number, r: any) => s + r.pending, 0),
    pos: new Set(grnPendingData.map((r: any) => r.poNumber)).size,
  }), [grnPendingData]);

  // Bill tracking: PO amount vs invoice amount raised against it (purchase_orders.invoice_number/invoice_amount/payment_status,
  // same columns already displayed read-only on the po-status/pending-purchase tabs and PODetailPage — no page currently writes
  // them, so most POs will show invoice fields blank/pending, matching those already-restored tabs).
  const billTrackingData = useMemo(() => pos.map((p: any) => ({
    poNumber: p.po_number, vendor: (p as any).vendors?.name || '-', poDate: p.po_date,
    totalAmount: Number(p.total_amount) || 0, invoiceNumber: p.invoice_number || '-',
    invoiceDate: p.invoice_date || '-', invoiceAmount: Number(p.invoice_amount) || 0,
    paymentStatus: p.payment_status || 'pending',
    pendingValue: (Number(p.total_amount) || 0) - (Number(p.invoice_amount) || 0),
  })), [pos]);
  const billTrackingSummary = useMemo(() => ({
    count: billTrackingData.length,
    pendingValue: billTrackingData.reduce((s: number, r: any) => s + Math.max(r.pendingValue, 0), 0),
  }), [billTrackingData]);

  const stockSummary = useMemo(() => {
    const totalItems = invItems.length;
    const lowStock = invItems.filter((i: any) => i.reorder_level > 0 && i.opening_stock <= i.reorder_level).length;
    return { totalItems, lowStock };
  }, [invItems]);

  // Shortage: inventory_items whose on-hand qty (opening_stock) has fallen to/below its static reorder_level.
  // Same filter as stockSummary.lowStock above (5f51b7c's original formula) — this is a reorder-point check
  // against inventory_items, not a BOM-required-vs-available projection or a check against in-transit POs.
  const lowStockItems = useMemo(() => invItems.filter((i: any) => i.reorder_level > 0 && i.opening_stock <= i.reorder_level), [invItems]);

  const inwardOutwardSummary = useMemo(() => {
    const inward = stockTxns.filter((t: any) => t.txn_type === 'inward');
    const outward = stockTxns.filter((t: any) => t.txn_type === 'outward');
    const inwardQty = inward.reduce((s: number, t: any) => s + Number(t.qty || 0), 0);
    const outwardQty = outward.reduce((s: number, t: any) => s + Number(t.qty || 0), 0);
    return { inwardCount: inward.length, outwardCount: outward.length, inwardQty, outwardQty };
  }, [stockTxns]);

  // Consumption vs BOM: planned qty per BOM line vs actual material_issues.qty_consumed for the same order+item.
  // Matched by order_id + item_name (same matching convention MaterialIssuesPage's "BOM vs Actual" tab already uses).
  const consumptionData = useMemo(() => {
    const rows: any[] = [];
    bomHeadersFull.forEach((bom: any) => {
      (bom.bom_lines || []).forEach((line: any) => {
        const plannedQty = Number(line.quantity ?? 0) * (Number(line.avg_consumption) || 1) * (1 + (Number(line.extra_pct) || 0) / 100);
        const consumed = bom.order_id
          ? materialIssues
              .filter((i: any) => i.order_id === bom.order_id && i.item_name === line.item_name)
              .reduce((s: number, i: any) => s + Number(i.qty_consumed || 0), 0)
          : 0;
        rows.push({
          bomTitle: bom.title || '-',
          orderRef: bom.order_id ? lookup.orderPO(bom.order_id) : '-',
          item: line.item_name || '-',
          category: line.category || '-',
          planned: Math.round(plannedQty * 100) / 100,
          consumed: Math.round(consumed * 100) / 100,
          balance: Math.round((plannedQty - consumed) * 100) / 100,
          variance: consumed - plannedQty,
          uom: line.uom || '',
        });
      });
    });
    return rows;
  }, [bomHeadersFull, materialIssues, lookup]);
  const consumptionSummary = useMemo(() => ({
    count: consumptionData.length,
    planned: consumptionData.reduce((s: number, r: any) => s + r.planned, 0),
    consumed: consumptionData.reduce((s: number, r: any) => s + r.consumed, 0),
    overCount: consumptionData.filter((r: any) => r.variance > 0).length,
  }), [consumptionData]);

  // Vendor performance: PO count / total ordered / received / pending value per vendor.
  // Same 'received'|'closed'|'cancelled' status vocabulary as pendingPurchase above — no on-time/delay
  // calc exists anywhere else in the codebase (checked VendorsPage/PurchaseOrdersPage/GRNPage) to cross-check against,
  // so this matches the original 5f51b7c formula as-is rather than inventing a new one.
  const vendorPerfData = useMemo(() => {
    const vendorMap: Record<string, { name: string; poCount: number; totalOrdered: number; totalReceived: number; pendingValue: number }> = {};
    pos.forEach((p: any) => {
      const vName = (p as any).vendors?.name || 'Unknown';
      if (!vendorMap[vName]) vendorMap[vName] = { name: vName, poCount: 0, totalOrdered: 0, totalReceived: 0, pendingValue: 0 };
      vendorMap[vName].poCount += 1;
      vendorMap[vName].totalOrdered += Number(p.total_amount) || 0;
      if (p.status === 'received' || p.status === 'closed') vendorMap[vName].totalReceived += Number(p.total_amount) || 0;
      if (p.status !== 'received' && p.status !== 'closed' && p.status !== 'cancelled') vendorMap[vName].pendingValue += Number(p.total_amount) || 0;
    });
    return Object.values(vendorMap);
  }, [pos]);

  // Buyer-wise summary: order count / ordered qty (from colourways) / dispatched qty / revenue per buyer.
  // Revenue uses order_rows (rate_per_item * order_qty) — same source/pattern as profitLossData's rowValue,
  // not the order header (order_headers has no ratePerItem/orderQty; that was the P&L bug, not repeating it here).
  // Dispatch buyer is keyed by dispatch_records.buyer_id via lookup.buyer() (not the raw dispatches.buyers?.name
  // join) so it lands in the same map bucket as the order-derived buyer key ("CODE - Name" format).
  const buyerSummary = useMemo(() => {
    const map: Record<string, { name: string; orders: number; orderedQty: number; dispatchedQty: number; revenue: number }> = {};
    allOrders.forEach((o: any) => {
      const buyerName = lookup.buyer(o.buyerId);
      if (!map[buyerName]) map[buyerName] = { name: buyerName, orders: 0, orderedQty: 0, dispatchedQty: 0, revenue: 0 };
      map[buyerName].orders += 1;
      const cws = allColourways.filter((c: any) => c.orderId === o.id);
      map[buyerName].orderedQty += cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0);
      const rowValue = data.orderRows.filter((r: any) => r.orderId === o.id).reduce((s: number, r: any) => s + (r.orderQty || 0) * (r.ratePerItem || 0), 0);
      map[buyerName].revenue += rowValue;
    });
    dispatches.forEach((d: any) => {
      const buyerName = lookup.buyer(d.buyer_id);
      if (!map[buyerName]) map[buyerName] = { name: buyerName, orders: 0, orderedQty: 0, dispatchedQty: 0, revenue: 0 };
      map[buyerName].dispatchedQty += Number(d.qty) || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [allOrders, allColourways, dispatches, data.orderRows, lookup]);

  const profitSummary = useMemo(() => {
    const totalRevenue = profitLossData.reduce((s: number, r: any) => s + r.revenue, 0);
    const totalLabour = profitLossData.reduce((s: number, r: any) => s + r.labourCost, 0);
    const totalMaterial = profitLossData.reduce((s: number, r: any) => s + r.materialCost, 0);
    const totalCost = profitLossData.reduce((s: number, r: any) => s + r.totalCost, 0);
    const totalProfit = profitLossData.reduce((s: number, r: any) => s + r.profit, 0);
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return { revenue: totalRevenue, labour: totalLabour, material: totalMaterial, cost: totalCost, profit: totalProfit, margin };
  }, [profitLossData]);

  const SummaryCards = ({ cards }: { cards: { label: string; value: string; icon: any; color: string }[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      {cards.map((c, i) => (
        <Card key={i} className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/30">
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg ${c.color} flex items-center justify-center shrink-0`}>
              <c.icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground truncate">{c.label}</p>
              <p className="text-sm font-semibold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div>
      <h1 className="text-lg font-semibold mb-3 flex items-center gap-2">Reports <ExplainerTip text="8 report views: order status, production, delayed orders, dispatch, PO status, stock on hand, inward/outward, profit/loss. Export any to Excel, CSV, or PDF. Filter by date/module/buyer/status." /></h1>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto mb-3">
          <TabsList className="inline-flex min-w-max">
            {tabs.map(t => <TabsTrigger key={t.id} value={t.id} className="text-[10px] px-2">{t.label}</TabsTrigger>)}
          </TabsList>
        </div>

        <TabsContent value="order-status">
          <FilterBar />
          <ExportBtns csvHeaders={['Module','Buyer','Style','PO','Colour','Ordered','Produced','Dispatched','Bal Prod','Bal Ship','%','Target','Status']} csvRows={orderStatusRows.map(r => [r.module,r.buyer,r.style,r.po,r.colour,r.ordered,r.produced,r.dispatched,r.balanceProd,r.balanceShip,r.pct.toFixed(1),r.target,r.status])} csvFile="order_status.csv" pdfTitle="Buyer Order Status" />
          <SummaryCards cards={[
            { label: 'Total Orders', value: String(orderSummary.totalOrders), icon: BarChart3, color: 'bg-blue-600' },
            { label: 'Total Qty', value: orderSummary.totalOrdered.toLocaleString(), icon: Package, color: 'bg-indigo-600' },
            { label: 'Total Produced', value: orderSummary.totalProduced.toLocaleString(), icon: TrendingUp, color: 'bg-emerald-600' },
            { label: 'Completion Rate', value: `${orderSummary.pct.toFixed(0)}%`, icon: CheckCircle2, color: 'bg-teal-600' },
          ]} />
          <ReportTable headers={['Module','Buyer','PO','Colour','Ordered','Produced','Dispatched','Bal Prod','%','Target','Status']}
            rows={orderStatusRows.map(r => [r.module, r.buyer, r.po, r.colour, String(r.ordered), String(r.produced), String(r.dispatched), String(r.balanceProd),
              <div className="flex items-center gap-1"><Progress value={Math.min(r.pct, 100)} className="h-1 w-10" /><span className="text-[9px]">{r.pct.toFixed(0)}%</span></div>,
              r.target || '-',
              <Badge key="s" variant={r.isDelayed ? 'destructive' : 'outline'} className="text-[9px]">{r.status}{r.isDelayed ? ' ⚠' : ''}</Badge>,
            ])} />
        </TabsContent>

        <TabsContent value="production">
          <FilterBar />
          <ExportBtns csvHeaders={['Date','Entries','Output','Cost']} csvRows={productionSummary.map(r => [r.date, r.entries, r.output, r.cost.toFixed(2)])} csvFile="production_summary.csv" pdfTitle="Production Summary" />
          <SummaryCards cards={[
            { label: 'Total Entries', value: String(prodSummary.totalEntries), icon: ClipboardList, color: 'bg-blue-600' },
            { label: 'Total Output', value: prodSummary.totalOutput.toLocaleString(), icon: TrendingUp, color: 'bg-emerald-600' },
            { label: 'Total Cost', value: `₹${prodSummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-amber-600' },
            { label: 'Avg Cost/Entry', value: prodSummary.totalEntries > 0 ? `₹${(prodSummary.totalCost / prodSummary.totalEntries).toFixed(0)}` : '—', icon: BarChart3, color: 'bg-purple-600' },
          ]} />
          <ReportTable headers={['Date','Entries','Total Output','Total Cost']}
            rows={productionSummary.map(r => [r.date, String(r.entries), String(r.output), `₹${r.cost.toFixed(0)}`])} />
        </TabsContent>

        <TabsContent value="daily">
          <FilterBar />
          <ExportBtns csvHeaders={['Date','Module','Order','Colour','Factory','Resource','Persons','Output','Cost']} csvRows={filteredEntries.map((e: any) => [e.date,e.module,lookup.orderPO(e.orderId),lookup.colour(e.colourwayId),lookup.factory(e.factoryId),lookup.resource(e.resourceId),e.personsUsed,e.outputQty,e.costAmount.toFixed(2)])} csvFile="daily_production.csv" pdfTitle="Daily Production Detail" />
          <SummaryCards cards={[
            { label: 'Total Entries', value: String(prodSummary.totalEntries), icon: ClipboardList, color: 'bg-blue-600' },
            { label: 'Total Output', value: prodSummary.totalOutput.toLocaleString(), icon: TrendingUp, color: 'bg-emerald-600' },
            { label: 'Total Cost', value: `₹${prodSummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-amber-600' },
          ]} />
          <ReportTable headers={['Date','Module','Order','Colour','Factory','Resource','Persons','Output','Cost']}
            rows={filteredEntries.map((e: any) => [e.date, e.module, lookup.orderPO(e.orderId), lookup.colour(e.colourwayId), lookup.factory(e.factoryId), lookup.resource(e.resourceId), String(e.personsUsed), String(e.outputQty), `₹${e.costAmount.toFixed(0)}`])} />
        </TabsContent>

        <TabsContent value="factory">
          <FilterBar />
          <ExportBtns csvHeaders={['Factory','Entries','Output','Cost']} csvRows={factorySummary.map(r => [r.name, r.entries, r.output, r.cost.toFixed(2)])} csvFile="factory_output.csv" pdfTitle="Factory Output Summary" />
          <SummaryCards cards={[
            { label: 'Factories', value: String(factorySummary.length), icon: BarChart3, color: 'bg-blue-600' },
            { label: 'Total Entries', value: String(prodSummary.totalEntries), icon: ClipboardList, color: 'bg-indigo-600' },
            { label: 'Total Output', value: prodSummary.totalOutput.toLocaleString(), icon: TrendingUp, color: 'bg-emerald-600' },
            { label: 'Total Cost', value: `₹${prodSummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-amber-600' },
          ]} />
          <ReportTable headers={['Factory','Entries','Total Output','Total Cost']}
            rows={factorySummary.map(r => [r.name, String(r.entries), String(r.output), `₹${r.cost.toFixed(0)}`])} emptyMsg="No production data. Log entries to see factory output." />
        </TabsContent>

        <TabsContent value="delayed">
          <FilterBar />
          {(() => {
            const delayed = orderStatusRows.filter(r => r.isDelayed);
            return <>
              <ExportBtns csvHeaders={['Module','Buyer','PO','Colour','Ordered','Produced','Balance','Target']} csvRows={delayed.map(r => [r.module,r.buyer,r.po,r.colour,r.ordered,r.produced,r.balanceProd,r.target])} csvFile="delayed_orders.csv" pdfTitle="Delayed Orders" />
              <SummaryCards cards={[
                { label: 'Delayed Orders', value: String(delayedSummary.count), icon: AlertTriangle, color: 'bg-red-600' },
                { label: 'Overdue Qty', value: delayedSummary.overdueQty.toLocaleString(), icon: Package, color: 'bg-orange-600' },
              ]} />
              <ReportTable headers={['Module','Buyer','PO','Colour','Ordered','Produced','Balance','Target']}
                rows={delayed.map(r => [r.module, r.buyer, r.po, r.colour, String(r.ordered), String(r.produced), String(r.balanceProd), r.target || '-'])} emptyMsg="No delayed orders" />
            </>;
          })()}
        </TabsContent>

        <TabsContent value="dispatch">
          <FilterBar />
          <ExportBtns csvHeaders={['Date','Buyer','Type','Product','Colour','Qty','UOM','Challan','Vehicle']} csvRows={dispatchRows.map((d: any) => [d.dispatch_date,(d as any).buyers?.name||'',d.dispatch_type,d.product_name||'',d.colour||'',d.qty,d.uom||'',d.challan_number||'',d.vehicle_number||''])} csvFile="dispatch_register.csv" pdfTitle="Dispatch Register" />
          <SummaryCards cards={[
            { label: 'Total Dispatches', value: String(dispatchSummary.count), icon: Truck, color: 'bg-blue-600' },
            { label: 'Total Qty', value: dispatchSummary.qty.toLocaleString(), icon: Package, color: 'bg-indigo-600' },
            { label: 'Buyers Served', value: String(dispatchSummary.buyers), icon: Users, color: 'bg-emerald-600' },
          ]} />
          <ReportTable headers={['Date','Buyer','Type','Product','Colour','Qty','Challan','Vehicle']}
            rows={dispatchRows.map((d: any) => [d.dispatch_date, (d as any).buyers?.name || '-', d.dispatch_type, d.product_name || '-', d.colour || '-', `${d.qty} ${d.uom || ''}`, d.challan_number || '-', d.vehicle_number || '-'])} />
        </TabsContent>

        <TabsContent value="po-status">
          <ExportBtns csvHeaders={['PO#','Vendor','Date','Status','Amount','Invoice#','Invoice Amt','Payment']} csvRows={pos.map((p: any) => [p.po_number,(p as any).vendors?.name||'',p.po_date,p.status,p.total_amount||0,p.invoice_number||'',p.invoice_amount||'',p.payment_status||''])} csvFile="po_status.csv" pdfTitle="PO Status" />
          <SummaryCards cards={[
            { label: 'Total POs', value: String(poSummary.count), icon: ShoppingCart, color: 'bg-blue-600' },
            { label: 'Total Amount', value: `₹${poSummary.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-emerald-600' },
            { label: 'Pending', value: String(poSummary.pending), icon: AlertTriangle, color: 'bg-amber-600' },
          ]} />
          <ReportTable headers={['PO#','Vendor','Date','Status','Amount','Invoice#','Payment']}
            rows={pos.map((p: any) => [p.po_number, (p as any).vendors?.name || '-', p.po_date, <Badge key="s" variant="outline" className="text-[9px]">{p.status}</Badge>, `₹${p.total_amount || 0}`, p.invoice_number || '-', <Badge key="p" variant="outline" className="text-[9px]">{p.payment_status || 'pending'}</Badge>])} />
        </TabsContent>

        <TabsContent value="pending-purchase">
          <ExportBtns csvHeaders={['PO#','Vendor','Date','Status','Amount','Invoice#','Payment']} csvRows={pendingPurchase.map((p: any) => [p.po_number,(p as any).vendors?.name||'',p.po_date,p.status,p.total_amount||0,p.invoice_number||'',p.payment_status||''])} csvFile="pending_purchase.csv" pdfTitle="Pending Purchase" />
          <SummaryCards cards={[
            { label: 'Pending POs', value: String(pendingPurchaseSummary.count), icon: AlertTriangle, color: 'bg-amber-600' },
            { label: 'Pending Amount', value: `₹${pendingPurchaseSummary.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-orange-600' },
          ]} />
          <ReportTable headers={['PO#','Vendor','Date','Status','Amount','Invoice','Payment']}
            rows={pendingPurchase.map((p: any) => [p.po_number, (p as any).vendors?.name || '-', p.po_date, <Badge key="s" variant="outline" className="text-[9px]">{p.status}</Badge>, `₹${p.total_amount || 0}`, p.invoice_number || '-', <Badge key="p" variant="outline" className="text-[9px]">{p.payment_status || 'pending'}</Badge>])} emptyMsg="No pending purchases" />
        </TabsContent>

        <TabsContent value="grn-pending">
          <ExportBtns csvHeaders={['PO#','Vendor','Item','UOM','Ordered','Received','Pending','PO Date','Status']} csvRows={grnPendingData.map((r: any) => [r.poNumber,r.vendor,r.item,r.uom,r.ordered,r.received,r.pending,r.poDate,r.poStatus])} csvFile="grn_pending.csv" pdfTitle="GRN Pending Report" />
          <SummaryCards cards={[
            { label: 'Pending Lines', value: String(grnPendingSummary.lines), icon: ClipboardList, color: 'bg-amber-600' },
            { label: 'Pending Qty', value: grnPendingSummary.pendingQty.toLocaleString(), icon: Package, color: 'bg-orange-600' },
            { label: 'POs Affected', value: String(grnPendingSummary.pos), icon: ShoppingCart, color: 'bg-blue-600' },
          ]} />
          <ReportTable headers={['PO#','Vendor','Item','UOM','Ordered','Received','Pending','PO Date','Status']}
            rows={grnPendingData.map((r: any) => [r.poNumber, r.vendor, r.item, r.uom, String(r.ordered), String(r.received), <span key="p" className="text-destructive font-medium">{r.pending}</span>, r.poDate, <Badge key="s" variant="outline" className="text-[9px]">{r.poStatus}</Badge>])} emptyMsg="No pending GRN items" />
        </TabsContent>

        <TabsContent value="bill-tracking">
          <ExportBtns csvHeaders={['PO#','Vendor','PO Date','PO Amount','Invoice#','Inv Date','Inv Amount','Pending Value','Payment Status']} csvRows={billTrackingData.map(r => [r.poNumber,r.vendor,r.poDate,r.totalAmount,r.invoiceNumber,r.invoiceDate,r.invoiceAmount,r.pendingValue.toFixed(2),r.paymentStatus])} csvFile="bill_tracking.csv" pdfTitle="Bill Tracking Report" />
          <SummaryCards cards={[
            { label: 'POs Tracked', value: String(billTrackingSummary.count), icon: ShoppingCart, color: 'bg-blue-600' },
            { label: 'Pending Bill Value', value: `₹${billTrackingSummary.pendingValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: billTrackingSummary.pendingValue > 0 ? 'bg-red-600' : 'bg-emerald-600' },
          ]} />
          <ReportTable headers={['PO#','Vendor','PO Date','PO Amount','Invoice#','Inv Date','Inv Amount','Pending','Payment']}
            rows={billTrackingData.map(r => [r.poNumber, r.vendor, r.poDate, `₹${r.totalAmount}`, r.invoiceNumber, r.invoiceDate, `₹${r.invoiceAmount}`,
              <span key="pv" className={r.pendingValue > 0 ? 'text-destructive font-medium' : ''}>{r.pendingValue > 0 ? `₹${r.pendingValue.toFixed(0)}` : '—'}</span>,
              <Badge key="ps" variant="outline" className="text-[9px]">{r.paymentStatus}</Badge>])} emptyMsg="No purchase orders to track" />
        </TabsContent>

        <TabsContent value="stock">
          <ExportBtns csvHeaders={['Code','Name','Category','UOM','On Hand','Reorder']} csvRows={invItems.map((i: any) => [i.code,i.name,i.category,i.uom,i.opening_stock,i.reorder_level||0])} csvFile="stock_on_hand.csv" pdfTitle="Stock On Hand" />
          <SummaryCards cards={[
            { label: 'Total Items', value: String(stockSummary.totalItems), icon: Package, color: 'bg-blue-600' },
            { label: 'Low Stock Items', value: String(stockSummary.lowStock), icon: AlertTriangle, color: stockSummary.lowStock > 0 ? 'bg-red-600' : 'bg-emerald-600' },
          ]} />
          <ReportTable headers={['Code','Name','Category','UOM','On Hand','Reorder']}
            rows={invItems.map((i: any) => {
              const low = i.reorder_level > 0 && i.opening_stock <= i.reorder_level;
              return [i.code, i.name, i.category, i.uom, <span key="q" className={low ? 'text-destructive font-medium' : ''}>{i.opening_stock}</span>, String(i.reorder_level || '-')];
            })} />
        </TabsContent>

        <TabsContent value="shortage">
          <ExportBtns csvHeaders={['Code','Name','Category','On Hand','Reorder','Shortage']} csvRows={lowStockItems.map((i: any) => [i.code,i.name,i.category,i.opening_stock,i.reorder_level,i.reorder_level-i.opening_stock])} csvFile="shortage.csv" pdfTitle="Shortage Report" />
          <SummaryCards cards={[
            { label: 'Items Short', value: String(lowStockItems.length), icon: AlertTriangle, color: lowStockItems.length > 0 ? 'bg-red-600' : 'bg-emerald-600' },
            { label: 'Total Shortage Qty', value: lowStockItems.reduce((s: number, i: any) => s + (i.reorder_level - i.opening_stock), 0).toLocaleString(), icon: Package, color: 'bg-orange-600' },
          ]} />
          <ReportTable headers={['Code','Name','Category','On Hand','Reorder','Shortage']}
            rows={lowStockItems.map((i: any) => [i.code, i.name, i.category, String(i.opening_stock), String(i.reorder_level), <span key="s" className="text-destructive font-medium">{i.reorder_level - i.opening_stock}</span>])} emptyMsg="No items below reorder level" />
        </TabsContent>

        <TabsContent value="inward-outward">
          <ExportBtns csvHeaders={['Date','Item','Type','Qty','Lot','Batch','Remarks']} csvRows={stockTxns.map((t: any) => [t.txn_date,(t as any).inventory_items?.name||'',t.txn_type,t.qty,t.lot_number||'',t.batch_number||'',t.remarks||''])} csvFile="inward_outward.csv" pdfTitle="Inward / Outward Register" />
          <SummaryCards cards={[
            { label: 'Inward Txns', value: String(inwardOutwardSummary.inwardCount), icon: Package, color: 'bg-emerald-600' },
            { label: 'Inward Qty', value: inwardOutwardSummary.inwardQty.toLocaleString(), icon: TrendingUp, color: 'bg-teal-600' },
            { label: 'Outward Txns', value: String(inwardOutwardSummary.outwardCount), icon: Truck, color: 'bg-blue-600' },
            { label: 'Outward Qty', value: inwardOutwardSummary.outwardQty.toLocaleString(), icon: ClipboardList, color: 'bg-indigo-600' },
          ]} />
          <ReportTable headers={['Date','Item','Type','Qty','Lot','Batch','Remarks']}
            rows={stockTxns.map((t: any) => [t.txn_date, (t as any).inventory_items?.name || '-', <Badge key="t" variant={t.txn_type === 'inward' ? 'default' : 'secondary'} className="text-[9px]">{t.txn_type}</Badge>, String(t.qty), t.lot_number || '-', t.batch_number || '-', t.remarks || '-'])}
            emptyMsg="No inward/outward transactions logged." />
        </TabsContent>

        <TabsContent value="consumption">
          <ExportBtns csvHeaders={['BOM','Order','Item','Category','Planned','Consumed','Balance','Variance','UOM']} csvRows={consumptionData.map((r: any) => [r.bomTitle,r.orderRef,r.item,r.category,r.planned,r.consumed,r.balance,r.variance.toFixed(2),r.uom])} csvFile="consumption_vs_bom.csv" pdfTitle="Material Consumption vs BOM" />
          <SummaryCards cards={[
            { label: 'BOM Lines', value: String(consumptionSummary.count), icon: ClipboardList, color: 'bg-blue-600' },
            { label: 'Total Planned', value: consumptionSummary.planned.toLocaleString(undefined, { maximumFractionDigits: 1 }), icon: Package, color: 'bg-indigo-600' },
            { label: 'Total Consumed', value: consumptionSummary.consumed.toLocaleString(undefined, { maximumFractionDigits: 1 }), icon: TrendingUp, color: 'bg-emerald-600' },
            { label: 'Over-consumed Lines', value: String(consumptionSummary.overCount), icon: AlertTriangle, color: consumptionSummary.overCount > 0 ? 'bg-red-600' : 'bg-teal-600' },
          ]} />
          <ReportTable headers={['BOM','Order','Item','Category','Planned','Consumed','Balance','Variance','UOM']}
            rows={consumptionData.map((r: any) => [
              r.bomTitle, r.orderRef, r.item, r.category, r.planned.toLocaleString(), r.consumed.toLocaleString(), r.balance.toLocaleString(),
              <span key="v" className={r.variance > 0 ? 'text-destructive font-medium' : 'text-green-600'}>{r.variance > 0 ? '+' : ''}{r.variance.toFixed(2)}</span>,
              r.uom,
            ])} emptyMsg="No BOM data. Create BOMs and record material issues to see consumption variance." />
        </TabsContent>

        <TabsContent value="vendor-perf">
          <ExportBtns csvHeaders={['Vendor','PO Count','Total Ordered','Total Received','Pending Value']} csvRows={vendorPerfData.map(r => [r.name,r.poCount,r.totalOrdered.toFixed(2),r.totalReceived.toFixed(2),r.pendingValue.toFixed(2)])} csvFile="vendor_performance.csv" pdfTitle="Vendor Delivery Performance" />
          <ReportTable headers={['Vendor','PO Count','Total Ordered','Received Value','Pending Value']}
            rows={vendorPerfData.map(r => [r.name, String(r.poCount), `₹${r.totalOrdered.toFixed(0)}`, `₹${r.totalReceived.toFixed(0)}`,
              <span key="pv" className={r.pendingValue > 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>{r.pendingValue > 0 ? `₹${r.pendingValue.toFixed(0)}` : 'Clear'}</span>])} emptyMsg="No vendor data" />
        </TabsContent>

        <TabsContent value="buyer-summary">
          <ExportBtns csvHeaders={['Buyer','Orders','Ordered Qty','Dispatched Qty','Balance','Revenue']}
            csvRows={buyerSummary.map(r => [r.name, r.orders, r.orderedQty, r.dispatchedQty, r.orderedQty - r.dispatchedQty, r.revenue.toFixed(2)])}
            csvFile="buyer_summary.csv" pdfTitle="Buyer-wise Summary" />
          <ReportTable headers={['Buyer','Orders','Ordered','Dispatched','Balance','Revenue']}
            rows={buyerSummary.map(r => [
              r.name, String(r.orders), String(r.orderedQty), String(r.dispatchedQty),
              <span key="b" className={r.orderedQty - r.dispatchedQty > 0 ? '' : 'text-green-600'}>{r.orderedQty - r.dispatchedQty}</span>,
              `₹${r.revenue.toFixed(0)}`,
            ])} emptyMsg="No buyer data. Create orders to see buyer summary." />
        </TabsContent>

        <TabsContent value="profit-loss">
          <ExportBtns csvHeaders={['Module','PO','Buyer','Style','Qty','Revenue','Labour Cost','Material Cost','Total Cost','Profit','Margin','Status']}
            csvRows={profitLossData.map(r => [r.module,r.po,r.buyer,r.style,r.qty,r.revenue.toFixed(2),r.labourCost.toFixed(2),r.materialCostUnknown ? 'N/A' : r.materialCost.toFixed(2),r.totalCost.toFixed(2),r.profit.toFixed(2),r.margin.toFixed(1)+'%',r.status])}
            csvFile="profit_loss.csv" pdfTitle="Profit & Loss by Order" />
          <SummaryCards cards={[
            { label: 'Total Revenue', value: `$${profitSummary.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-emerald-600' },
            { label: 'Labour Cost', value: `$${profitSummary.labour.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-blue-600' },
            { label: 'Material Cost', value: `$${profitSummary.material.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: Package, color: 'bg-amber-600' },
            { label: 'Net Profit', value: `$${profitSummary.profit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: TrendingUp, color: profitSummary.profit >= 0 ? 'bg-emerald-600' : 'bg-red-600' },
            { label: 'Margin', value: `${profitSummary.margin >= 0 ? '+' : ''}${profitSummary.margin.toFixed(1)}%`, icon: BarChart3, color: profitSummary.margin >= 0 ? 'bg-blue-600' : 'bg-red-600' },
          ]} />
          <ReportTable headers={['Module','PO','Buyer','Style','Qty','Revenue','Labour','Material','Cost','Profit','Margin','Status']}
            rows={profitLossData.map(r => [
              r.module, r.po, r.buyer, r.style, String(r.qty),
              `$${r.revenue.toFixed(0)}`, `$${r.labourCost.toFixed(0)}`, r.materialCostUnknown ? '—' : `$${r.materialCost.toFixed(0)}`,
              `$${r.totalCost.toFixed(0)}`,
              <span key="p" className={r.profit >= 0 ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                {r.profit >= 0 ? '+' : ''}${r.profit.toFixed(0)}
              </span>,
              <span key="m" className={r.margin >= 0 ? 'text-green-600' : 'text-destructive'}>{r.margin >= 0 ? '+' : ''}{r.margin.toFixed(1)}%</span>,
              <Badge key="s" variant="outline" className="text-[9px]">{r.status}</Badge>,
            ])} />
        </TabsContent>

        <TabsContent value="monthly-trend">
          <FilterBar />
          <ExportBtns csvHeaders={['Month','Entries','Total Output','Total Cost']}
            csvRows={monthlyTrend.map(r => [r.month, r.entries, r.output, r.cost.toFixed(2)])}
            csvFile="monthly_trend.csv" pdfTitle="Monthly Production Trend" />
          <SummaryCards cards={[
            { label: 'Total Entries', value: String(prodSummary.totalEntries), icon: ClipboardList, color: 'bg-blue-600' },
            { label: 'Total Output', value: prodSummary.totalOutput.toLocaleString(), icon: TrendingUp, color: 'bg-emerald-600' },
            { label: 'Total Cost', value: `₹${prodSummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'bg-amber-600' },
            { label: 'Months Covered', value: String(monthlyTrend.length), icon: BarChart3, color: 'bg-purple-600' },
          ]} />
          <ReportTable headers={['Month','Entries','Total Output','Total Cost','Visual']}
            rows={monthlyTrend.map(r => {
              const maxOut = Math.max(...monthlyTrend.map(m => m.output), 1);
              const barW = (r.output / maxOut) * 100;
              return [
                r.month, String(r.entries), String(r.output), `₹${r.cost.toFixed(0)}`,
                <div key="b" className="flex items-center gap-1">
                  <div className="h-2 bg-primary rounded" style={{ width: `${Math.max(barW, 2)}%`, minWidth: 4 }} />
                  <span className="text-[9px] text-muted-foreground">{barW.toFixed(0)}%</span>
                </div>,
              ];
            })} emptyMsg="No production data. Log entries to see trends." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
