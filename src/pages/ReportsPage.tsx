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
import { Download, FileText } from 'lucide-react';
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
  const { data: grnHeaders = [] } = useQuery({
    queryKey: ['grn_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('grn_headers').select('*, vendors(name)').eq('company_id', companyId); return data || [];
    }, enabled: !!companyId,
  });
  const { data: grnLines = [] } = useQuery({
    queryKey: ['grnlines_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const grnIds = grnHeaders.map((g: any) => g.id);
      if (grnIds.length === 0) return [];
      const { data } = await supabase.from('grn_lines').select('*').in('grn_id', grnIds); return data || [];
    }, enabled: !!companyId && grnHeaders.length > 0,
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
  const { data: bomHeaders = [] } = useQuery({
    queryKey: ['bom_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('bom_headers').select('*').eq('company_id', companyId); return data || [];
    }, enabled: !!companyId,
  });
  const { data: bomLines = [] } = useQuery({
    queryKey: ['bomlines_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const bomIds = bomHeaders.map((b: any) => b.id);
      if (bomIds.length === 0) return [];
      const { data } = await supabase.from('bom_lines').select('*').in('bom_id', bomIds); return data || [];
    }, enabled: !!companyId && bomHeaders.length > 0,
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

  const factorySummary = useMemo(() => {
    const map: Record<string, { name: string; output: number; cost: number; entries: number }> = {};
    filteredEntries.forEach((e: any) => {
      const name = lookup.factory(e.factoryId);
      if (!map[e.factoryId]) map[e.factoryId] = { name, output: 0, cost: 0, entries: 0 };
      map[e.factoryId].output += e.outputQty;
      map[e.factoryId].cost += e.costAmount;
      map[e.factoryId].entries += 1;
    });
    return Object.values(map);
  }, [filteredEntries, lookup]);

  const pendingPurchase = useMemo(() => pos.filter((p: any) => p.status !== 'closed' && p.status !== 'cancelled' && p.status !== 'received'), [pos]);
  const dispatchRows = useMemo(() => dispatches.filter((d: any) => (!filters.dateFrom || d.dispatch_date >= filters.dateFrom) && (!filters.dateTo || d.dispatch_date <= filters.dateTo)), [dispatches, filters]);
  const lowStockItems = useMemo(() => invItems.filter((i: any) => i.reorder_level > 0 && i.opening_stock <= i.reorder_level), [invItems]);

  // Consumption vs BOM
  const consumptionData = useMemo(() => {
    return bomLines.map((line: any) => {
      const bom = bomHeaders.find((b: any) => b.id === line.bom_id);
      const plannedQty = Number(line.quantity ?? 0) * (1 + (Number(line.extra_pct) || 0) / 100);
      const bomOrderId = bom?.order_id;
      const consumed = bomOrderId
        ? stockTxns
            .filter((t: any) => t.txn_type === 'outward' && t.order_id === bomOrderId)
            .reduce((s: number, t: any) => s + Number(t.qty ?? 0), 0)
        : 0;
      return {
        bomTitle: bom?.title || '-',
        orderRef: bomOrderId ? lookup.orderPO(bomOrderId) : '-',
        item: line.item_name || '-',
        category: line.category || '-',
        planned: Math.round(plannedQty * 100) / 100,
        consumed,
        balance: Math.round((plannedQty - consumed) * 100) / 100,
        variance: consumed - plannedQty,
        uom: line.uom || '',
      };
    });
  }, [bomLines, bomHeaders, stockTxns, lookup]);

  // Profit/Loss by order
  const profitLossData = useMemo(() => allOrders.map((o: any) => {
    const orderCost = data.entries.filter((e: any) => e.orderId === o.id).reduce((s: number, e: any) => s + e.costAmount, 0);
    const cws = allColourways.filter((c: any) => c.orderId === o.id);
    const qty = cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0) || o.orderQty || 0;
    const rate = o.ratePerItem || 0;
    const revenue = qty * rate;
    const profit = revenue - orderCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return {
      module: o.module, po: o.internalPO, buyer: lookup.buyer(o.buyerId), style: o.style,
      qty, rate: rate, revenue, cost: orderCost, profit, margin, status: o.status,
    };
  }), [allOrders, allColourways, data.entries, lookup]);

  // Monthly production trend
  const monthlyTrend = useMemo(() => {
    const byMonth: Record<string, { month: string; output: number; cost: number; entries: number }> = {};
    data.entries.forEach((e: any) => {
      const month = e.date ? e.date.slice(0, 7) : '';
      if (!month) return;
      if (!byMonth[month]) byMonth[month] = { month, output: 0, cost: 0, entries: 0 };
      byMonth[month].output += e.outputQty;
      byMonth[month].cost += e.costAmount;
      byMonth[month].entries += 1;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }, [data.entries]);

  // Buyer-wise summary
  const buyerSummary = useMemo(() => {
    const map: Record<string, { name: string; orders: number; orderedQty: number; dispatchedQty: number; revenue: number }> = {};
    allOrders.forEach((o: any) => {
      const buyerName = lookup.buyer(o.buyerId);
      if (!map[buyerName]) map[buyerName] = { name: buyerName, orders: 0, orderedQty: 0, dispatchedQty: 0, revenue: 0 };
      map[buyerName].orders += 1;
      const cws = allColourways.filter((c: any) => c.orderId === o.id);
      const orderQty = cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0) || o.orderQty || 0;
      map[buyerName].orderedQty += orderQty;
      map[buyerName].revenue += orderQty * (o.ratePerItem || 0);
    });
    dispatches.forEach((d: any) => {
      const buyerName = (d as any).buyers?.name || '-';
      if (!map[buyerName]) map[buyerName] = { name: buyerName, orders: 0, orderedQty: 0, dispatchedQty: 0, revenue: 0 };
      map[buyerName].dispatchedQty += Number(d.qty) || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [allOrders, allColourways, dispatches, lookup]);

  // Operator productivity
  const operatorProductivity = useMemo(() => {
    const map: Record<string, { workerTypeId: string; name: string; entries: number; totalOutput: number; totalPersons: number; totalCost: number }> = {};
    filteredEntries.forEach((e: any) => {
      const wt = data.workerTypes.find((w: any) => w.id === e.workerTypeId);
      const name = wt?.name || e.workerTypeId?.slice(0, 8) || 'Unknown';
      if (!map[e.workerTypeId]) map[e.workerTypeId] = { workerTypeId: e.workerTypeId, name, entries: 0, totalOutput: 0, totalPersons: 0, totalCost: 0 };
      map[e.workerTypeId].entries += 1;
      map[e.workerTypeId].totalOutput += e.outputQty;
      map[e.workerTypeId].totalPersons += e.personsUsed || 0;
      map[e.workerTypeId].totalCost += e.costAmount;
    });
    return Object.values(map).sort((a, b) => b.totalOutput - a.totalOutput);
  }, [filteredEntries, data.workerTypes]);

  const filterObj = { From: filters.dateFrom, To: filters.dateTo, Module: filters.module, Status: filters.status };

  // GRN Pending report data
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

  // Bill tracking report data
  const billTrackingData = useMemo(() => {
    return pos.map((p: any) => ({
      poNumber: p.po_number, vendor: (p as any).vendors?.name || '-', poDate: p.po_date,
      totalAmount: Number(p.total_amount) || 0, invoiceNumber: p.invoice_number || '-',
      invoiceDate: p.invoice_date || '-', invoiceAmount: Number(p.invoice_amount) || 0,
      paymentStatus: p.payment_status || 'pending', status: p.status,
      pendingValue: (Number(p.total_amount) || 0) - (Number(p.invoice_amount) || 0),
    }));
  }, [pos]);

  // Capacity vs demand
  const capacityDemandData = useMemo(() => {
    const printingTables = data.printingTables.filter((t: any) => t.isActive !== false);
    const stitchingLines = data.stitchingLines.filter((l: any) => l.isActive !== false);
    const printingCapacity = printingTables.length;
    const stitchingCapacity = stitchingLines.length;
    const printingDemand = allOrders.filter((o: any) => o.module === 'printing' && o.status === 'Started').length;
    const stitchingDemand = allOrders.filter((o: any) => o.module === 'stitching' && o.status === 'Started').length;
    return {
      printing: { capacity: printingCapacity, demand: printingDemand, load: printingCapacity > 0 ? Math.round((printingDemand / printingCapacity) * 100) : 0 },
      stitching: { capacity: stitchingCapacity, demand: stitchingDemand, load: stitchingCapacity > 0 ? Math.round((stitchingDemand / stitchingCapacity) * 100) : 0 },
    };
  }, [data, allOrders]);

  // Vendor performance
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
    { id: 'capacity', label: 'Capacity vs Demand' },
    { id: 'vendor-perf', label: 'Vendor Performance' },
    { id: 'stock', label: 'Stock On Hand' },
    { id: 'shortage', label: 'Shortage' },
    { id: 'inward-outward', label: 'Inward/Outward' },
    { id: 'consumption', label: 'Consumption vs BOM' },
    { id: 'profit-loss', label: 'Profit/Loss' },
    { id: 'monthly-trend', label: 'Monthly Trend' },
    { id: 'buyer-summary', label: 'By Buyer' },
    { id: 'operator-productivity', label: 'Operator Productivity' },
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

  return (
    <div>
      <h1 className="text-lg font-semibold mb-3 flex items-center gap-2">Reports <ExplainerTip text="20+ report views covering order status, production, dispatch, purchase, inventory, and financial analysis. Export any report to CSV, Excel, or PDF. Use the filter bar to narrow results by date, module, buyer, or status." /></h1>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto mb-3">
          <TabsList className="inline-flex min-w-max">
            {tabs.map(t => <TabsTrigger key={t.id} value={t.id} className="text-[10px] px-2">{t.label}</TabsTrigger>)}
          </TabsList>
        </div>

        <TabsContent value="order-status">
          <FilterBar />
          <ExportBtns csvHeaders={['Module','Buyer','Style','PO','Colour','Ordered','Produced','Dispatched','Bal Prod','Bal Ship','%','Target','Status']} csvRows={orderStatusRows.map(r => [r.module,r.buyer,r.style,r.po,r.colour,r.ordered,r.produced,r.dispatched,r.balanceProd,r.balanceShip,r.pct.toFixed(1),r.target,r.status])} csvFile="order_status.csv" pdfTitle="Buyer Order Status" />
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
          <ReportTable headers={['Date','Entries','Total Output','Total Cost']}
            rows={productionSummary.map(r => [r.date, String(r.entries), String(r.output), `₹${r.cost.toFixed(0)}`])} />
        </TabsContent>

        <TabsContent value="daily">
          <FilterBar />
          <ExportBtns csvHeaders={['Date','Module','Order','Colour','Factory','Resource','Persons','Output','Cost']} csvRows={filteredEntries.map((e: any) => [e.date,e.module,lookup.orderPO(e.orderId),lookup.colour(e.colourwayId),lookup.factory(e.factoryId),lookup.resource(e.resourceId),e.personsUsed,e.outputQty,e.costAmount.toFixed(2)])} csvFile="daily_production.csv" pdfTitle="Daily Production Detail" />
          <ReportTable headers={['Date','Module','Order','Colour','Factory','Resource','Persons','Output','Cost']}
            rows={filteredEntries.map((e: any) => [e.date, e.module, lookup.orderPO(e.orderId), lookup.colour(e.colourwayId), lookup.factory(e.factoryId), lookup.resource(e.resourceId), String(e.personsUsed), String(e.outputQty), `₹${e.costAmount.toFixed(0)}`])} />
        </TabsContent>

        <TabsContent value="factory">
          <FilterBar />
          <ExportBtns csvHeaders={['Factory','Entries','Output','Cost']} csvRows={factorySummary.map(r => [r.name, r.entries, r.output, r.cost.toFixed(2)])} csvFile="factory_output.csv" pdfTitle="Factory Output Summary" />
          <ReportTable headers={['Factory','Entries','Total Output','Total Cost']}
            rows={factorySummary.map(r => [r.name, String(r.entries), String(r.output), `₹${r.cost.toFixed(0)}`])} />
        </TabsContent>

        <TabsContent value="delayed">
          <FilterBar />
          {(() => {
            const delayed = orderStatusRows.filter(r => r.isDelayed);
            return <>
              <ExportBtns csvHeaders={['Module','Buyer','PO','Colour','Ordered','Produced','Balance','Target']} csvRows={delayed.map(r => [r.module,r.buyer,r.po,r.colour,r.ordered,r.produced,r.balanceProd,r.target])} csvFile="delayed_orders.csv" pdfTitle="Delayed Orders" />
              <ReportTable headers={['Module','Buyer','PO','Colour','Ordered','Produced','Balance','Target']}
                rows={delayed.map(r => [r.module, r.buyer, r.po, r.colour, String(r.ordered), String(r.produced), String(r.balanceProd), r.target || '-'])} emptyMsg="No delayed orders" />
            </>;
          })()}
        </TabsContent>

        <TabsContent value="dispatch">
          <FilterBar />
          <ExportBtns csvHeaders={['Date','Buyer','Type','Product','Colour','Qty','UOM','Challan','Vehicle']} csvRows={dispatchRows.map((d: any) => [d.dispatch_date,(d as any).buyers?.name||'',d.dispatch_type,d.product_name||'',d.colour||'',d.qty,d.uom||'',d.challan_number||'',d.vehicle_number||''])} csvFile="dispatch_register.csv" pdfTitle="Dispatch Register" />
          <ReportTable headers={['Date','Buyer','Type','Product','Colour','Qty','Challan','Vehicle']}
            rows={dispatchRows.map((d: any) => [d.dispatch_date, (d as any).buyers?.name || '-', d.dispatch_type, d.product_name || '-', d.colour || '-', `${d.qty} ${d.uom || ''}`, d.challan_number || '-', d.vehicle_number || '-'])} />
        </TabsContent>

        <TabsContent value="po-status">
          <ExportBtns csvHeaders={['PO#','Vendor','Date','Status','Amount','Invoice#','Invoice Amt','Payment']} csvRows={pos.map((p: any) => [p.po_number,(p as any).vendors?.name||'',p.po_date,p.status,p.total_amount||0,p.invoice_number||'',p.invoice_amount||'',p.payment_status||''])} csvFile="po_status.csv" pdfTitle="PO Status" />
          <ReportTable headers={['PO#','Vendor','Date','Status','Amount','Invoice#','Payment']}
            rows={pos.map((p: any) => [p.po_number, (p as any).vendors?.name || '-', p.po_date, <Badge key="s" variant="outline" className="text-[9px]">{p.status}</Badge>, `₹${p.total_amount || 0}`, p.invoice_number || '-', <Badge key="p" variant="outline" className="text-[9px]">{p.payment_status || 'pending'}</Badge>])} />
        </TabsContent>

        <TabsContent value="pending-purchase">
          <ExportBtns csvHeaders={['PO#','Vendor','Date','Status','Amount','Invoice#','Payment']} csvRows={pendingPurchase.map((p: any) => [p.po_number,(p as any).vendors?.name||'',p.po_date,p.status,p.total_amount||0,p.invoice_number||'',p.payment_status||''])} csvFile="pending_purchase.csv" pdfTitle="Pending Purchase" />
          <ReportTable headers={['PO#','Vendor','Date','Status','Amount','Invoice','Payment']}
            rows={pendingPurchase.map((p: any) => [p.po_number, (p as any).vendors?.name || '-', p.po_date, p.status, `₹${p.total_amount || 0}`, p.invoice_number || '-', p.payment_status || 'pending'])} emptyMsg="No pending purchases" />
        </TabsContent>

        <TabsContent value="grn-pending">
          <ExportBtns csvHeaders={['PO#','Vendor','Item','UOM','Ordered','Received','Pending','PO Date','Status']} csvRows={grnPendingData.map((r: any) => [r.poNumber,r.vendor,r.item,r.uom,r.ordered,r.received,r.pending,r.poDate,r.poStatus])} csvFile="grn_pending.csv" pdfTitle="GRN Pending Report" />
          <ReportTable headers={['PO#','Vendor','Item','UOM','Ordered','Received','Pending','PO Date','Status']}
            rows={grnPendingData.map((r: any) => [r.poNumber, r.vendor, r.item, r.uom, String(r.ordered), String(r.received), <span key="p" className="text-destructive font-medium">{r.pending}</span>, r.poDate, <Badge key="s" variant="outline" className="text-[9px]">{r.poStatus}</Badge>])} emptyMsg="No pending GRN items" />
        </TabsContent>

        <TabsContent value="bill-tracking">
          <ExportBtns csvHeaders={['PO#','Vendor','PO Date','PO Amount','Invoice#','Inv Date','Inv Amount','Pending Value','Payment Status']} csvRows={billTrackingData.map(r => [r.poNumber,r.vendor,r.poDate,r.totalAmount,r.invoiceNumber,r.invoiceDate,r.invoiceAmount,r.pendingValue.toFixed(2),r.paymentStatus])} csvFile="bill_tracking.csv" pdfTitle="Bill Tracking Report" />
          <ReportTable headers={['PO#','Vendor','PO Date','PO Amount','Invoice#','Inv Date','Inv Amount','Pending','Payment']}
            rows={billTrackingData.map(r => [r.poNumber, r.vendor, r.poDate, `₹${r.totalAmount}`, r.invoiceNumber, r.invoiceDate, `₹${r.invoiceAmount}`,
              <span key="pv" className={r.pendingValue > 0 ? 'text-destructive font-medium' : ''}>{r.pendingValue > 0 ? `₹${r.pendingValue.toFixed(0)}` : '—'}</span>,
              <Badge key="ps" variant="outline" className="text-[9px]">{r.paymentStatus}</Badge>])} />
        </TabsContent>

        <TabsContent value="capacity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Card><CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">Printing</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Available Tables</span><span className="font-medium">{capacityDemandData.printing.capacity}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Active Orders</span><span className="font-medium">{capacityDemandData.printing.demand}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Load</span>
                  <Badge variant={capacityDemandData.printing.load > 100 ? 'destructive' : capacityDemandData.printing.load > 80 ? 'secondary' : 'outline'} className="text-[10px]">
                    {capacityDemandData.printing.load}%{capacityDemandData.printing.load > 100 ? ' Overloaded' : capacityDemandData.printing.load > 80 ? ' High' : ' Normal'}
                  </Badge>
                </div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">Stitching</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Available Lines</span><span className="font-medium">{capacityDemandData.stitching.capacity}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Active Orders</span><span className="font-medium">{capacityDemandData.stitching.demand}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Load</span>
                  <Badge variant={capacityDemandData.stitching.load > 100 ? 'destructive' : capacityDemandData.stitching.load > 80 ? 'secondary' : 'outline'} className="text-[10px]">
                    {capacityDemandData.stitching.load}%{capacityDemandData.stitching.load > 100 ? ' Overloaded' : capacityDemandData.stitching.load > 80 ? ' High' : ' Normal'}
                  </Badge>
                </div>
              </div>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="vendor-perf">
          <ExportBtns csvHeaders={['Vendor','PO Count','Total Ordered','Total Received','Pending Value']} csvRows={vendorPerfData.map(r => [r.name,r.poCount,r.totalOrdered.toFixed(2),r.totalReceived.toFixed(2),r.pendingValue.toFixed(2)])} csvFile="vendor_performance.csv" pdfTitle="Vendor Delivery Performance" />
          <ReportTable headers={['Vendor','PO Count','Total Ordered','Received Value','Pending Value']}
            rows={vendorPerfData.map(r => [r.name, String(r.poCount), `₹${r.totalOrdered.toFixed(0)}`, `₹${r.totalReceived.toFixed(0)}`,
              <span key="pv" className={r.pendingValue > 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>{r.pendingValue > 0 ? `₹${r.pendingValue.toFixed(0)}` : 'Clear'}</span>])} emptyMsg="No vendor data" />
        </TabsContent>

        <TabsContent value="stock-on-hand">
          <ExportBtns csvHeaders={['Code','Name','Category','UOM','On Hand','Reorder']} csvRows={invItems.map((i: any) => [i.code,i.name,i.category,i.uom,i.opening_stock,i.reorder_level||0])} csvFile="stock_on_hand.csv" pdfTitle="Stock On Hand" />
          <ReportTable headers={['Code','Name','Category','UOM','On Hand','Reorder']}
            rows={invItems.map((i: any) => {
              const low = i.reorder_level > 0 && i.opening_stock <= i.reorder_level;
              return [i.code, i.name, i.category, i.uom, <span key="q" className={low ? 'text-destructive font-medium' : ''}>{i.opening_stock}</span>, String(i.reorder_level || '-')];
            })} />
        </TabsContent>

        <TabsContent value="shortage">
          <ExportBtns csvHeaders={['Code','Name','Category','On Hand','Reorder','Shortage']} csvRows={lowStockItems.map((i: any) => [i.code,i.name,i.category,i.opening_stock,i.reorder_level,i.reorder_level-i.opening_stock])} csvFile="shortage.csv" pdfTitle="Shortage Report" />
          <ReportTable headers={['Code','Name','Category','On Hand','Reorder','Shortage']}
            rows={lowStockItems.map((i: any) => [i.code, i.name, i.category, String(i.opening_stock), String(i.reorder_level), <span key="s" className="text-destructive font-medium">{i.reorder_level - i.opening_stock}</span>])} emptyMsg="No shortage items" />
        </TabsContent>

        <TabsContent value="inward-outward">
          <ExportBtns csvHeaders={['Date','Item','Type','Qty','Lot','Batch','Remarks']} csvRows={stockTxns.map((t: any) => [t.txn_date,(t as any).inventory_items?.name||'',t.txn_type,t.qty,t.lot_number||'',t.batch_number||'',t.remarks||''])} csvFile="inward_outward.csv" pdfTitle="Inward / Outward Register" />
          <ReportTable headers={['Date','Item','Type','Qty','Lot','Batch','Remarks']}
            rows={stockTxns.map((t: any) => [t.txn_date, (t as any).inventory_items?.name || '-', <Badge key="t" variant={t.txn_type === 'inward' ? 'default' : 'secondary'} className="text-[9px]">{t.txn_type}</Badge>, String(t.qty), t.lot_number || '-', t.batch_number || '-', t.remarks || '-'])} />
        </TabsContent>

        <TabsContent value="consumption">
          <ExportBtns csvHeaders={['BOM','Order','Item','Category','Planned','Consumed','Balance','Variance','UOM']} csvRows={consumptionData.map(r => [r.bomTitle,r.orderRef,r.item,r.category,r.planned,r.consumed,r.balance,r.variance.toFixed(2),r.uom])} csvFile="consumption_vs_bom.csv" pdfTitle="Material Consumption vs BOM" />
          <ReportTable headers={['BOM','Order','Item','Category','Planned','Consumed','Balance','Variance','UOM']}
            rows={consumptionData.length === 0 ? [] : consumptionData.map(r => [
              r.bomTitle, r.orderRef, r.item, r.category, String(r.planned), String(r.consumed), String(r.balance),
              <span key="v" className={r.variance > 0 ? 'text-destructive font-medium' : r.variance < 0 ? 'text-green-600 font-medium' : ''}>{r.variance > 0 ? `+${r.variance.toFixed(1)}` : r.variance.toFixed(1)}</span>,
              r.uom,
            ])} emptyMsg="No BOM data. Create BOMs to see consumption variance." />
        </TabsContent>

        <TabsContent value="profit-loss">
          <ExportBtns csvHeaders={['Module','PO','Buyer','Style','Qty','Rate','Revenue','Cost','Profit','Margin','Status']}
            csvRows={profitLossData.map(r => [r.module,r.po,r.buyer,r.style,r.qty,r.rate,r.revenue.toFixed(2),r.cost.toFixed(2),r.profit.toFixed(2),r.margin.toFixed(1)+'%',r.status])}
            csvFile="profit_loss.csv" pdfTitle="Profit & Loss by Order" />
          <ReportTable headers={['Module','PO','Buyer','Style','Qty','Revenue','Cost','Profit','Margin','Status']}
            rows={profitLossData.map(r => [
              r.module, r.po, r.buyer, r.style, String(r.qty),
              `₹${r.revenue.toFixed(0)}`, `₹${r.cost.toFixed(0)}`,
              <span key="p" className={r.profit >= 0 ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                {r.profit >= 0 ? '+' : ''}₹{r.profit.toFixed(0)}
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

        <TabsContent value="operator-productivity">
          <FilterBar />
          <ExportBtns csvHeaders={['Worker Type','Entries','Total Output','Total Persons','Avg Output/Entry','Total Cost']}
            csvRows={operatorProductivity.map(r => [r.name, r.entries, r.totalOutput, r.totalPersons, r.entries > 0 ? (r.totalOutput / r.entries).toFixed(1) : '0', r.totalCost.toFixed(2)])}
            csvFile="operator_productivity.csv" pdfTitle="Operator Productivity Report" />
          <ReportTable headers={['Worker Type','Entries','Total Output','Total Persons','Avg/Entry','Total Cost']}
            rows={operatorProductivity.map(r => [
              r.name, String(r.entries), String(r.totalOutput), String(r.totalPersons),
              r.entries > 0 ? (r.totalOutput / r.entries).toFixed(1) : '0',
              `₹${r.totalCost.toFixed(0)}`,
            ])} emptyMsg="No entry data. Log production entries to see operator productivity." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
