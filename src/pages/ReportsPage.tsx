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
  const { data: invItems = [] } = useQuery({
    queryKey: ['inv_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('inventory_items').select('*').eq('company_id', companyId); return data || [];
    }, enabled: !!companyId,
  });
  const { data: materialIssues = [] } = useQuery({
    queryKey: ['material_issues_rpt', companyId], queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('material_issues').select('*').eq('company_id', companyId); return data || [];
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

  const profitLossData = useMemo(() => allOrders.map((o: any) => {
    const labourCost = data.entries.filter((e: any) => e.orderId === o.id).reduce((s: number, e: any) => s + e.costAmount, 0);
    const matIssues = materialIssues.filter((i: any) => i.order_id === o.id);
    const materialQty = matIssues.reduce((s: number, i: any) => s + Number(i.qty_consumed || 0), 0);
    const materialCost = matIssues.reduce((s: number, i: any) => s + Number(i.qty_consumed || 0) * 1, 0);
    const cws = allColourways.filter((c: any) => c.orderId === o.id);
    const qty = cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0) || o.orderQty || 0;
    const rate = o.ratePerItem || 0;
    const orderInvoices = data.invoices.filter((i: any) => i.orderId === o.id);
    const revenue = orderInvoices.length > 0
      ? orderInvoices.reduce((s: number, i: any) => s + i.grandTotal, 0)
      : qty * rate;
    const totalCost = labourCost + materialCost;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return {
      module: o.module, po: o.internalPO, buyer: lookup.buyer(o.buyerId), style: o.style,
      qty, rate, revenue, labourCost, materialCost, totalCost, profit, margin, status: o.status,
    };
  }), [allOrders, allColourways, data.entries, data.invoices, materialIssues, lookup]);

  const filterObj = { From: filters.dateFrom, To: filters.dateTo, Module: filters.module, Status: filters.status };

  const tabs = [
    { id: 'order-status', label: 'Order Status' },
    { id: 'production', label: 'Production' },
    { id: 'delayed', label: 'Delayed' },
    { id: 'dispatch', label: 'Dispatch' },
    { id: 'po-status', label: 'PO Status' },
    { id: 'stock', label: 'Stock On Hand' },
    { id: 'profit-loss', label: 'Profit/Loss' },
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

  const stockSummary = useMemo(() => {
    const totalItems = invItems.length;
    const lowStock = invItems.filter((i: any) => i.reorder_level > 0 && i.opening_stock <= i.reorder_level).length;
    return { totalItems, lowStock };
  }, [invItems]);

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
      <h1 className="text-lg font-semibold mb-3 flex items-center gap-2">Reports <ExplainerTip text="7 report views: order status, production, delayed orders, dispatch, PO status, stock on hand, profit/loss. Export any to Excel, CSV, or PDF. Filter by date/module/buyer/status." /></h1>
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

        <TabsContent value="profit-loss">
          <ExportBtns csvHeaders={['Module','PO','Buyer','Style','Qty','Revenue','Labour Cost','Material Cost','Total Cost','Profit','Margin','Status']}
            csvRows={profitLossData.map(r => [r.module,r.po,r.buyer,r.style,r.qty,r.revenue.toFixed(2),r.labourCost.toFixed(2),r.materialCost.toFixed(2),r.totalCost.toFixed(2),r.profit.toFixed(2),r.margin.toFixed(1)+'%',r.status])}
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
              `$${r.revenue.toFixed(0)}`, `$${r.labourCost.toFixed(0)}`, `$${r.materialCost.toFixed(0)}`,
              `$${r.totalCost.toFixed(0)}`,
              <span key="p" className={r.profit >= 0 ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                {r.profit >= 0 ? '+' : ''}${r.profit.toFixed(0)}
              </span>,
              <span key="m" className={r.margin >= 0 ? 'text-green-600' : 'text-destructive'}>{r.margin >= 0 ? '+' : ''}{r.margin.toFixed(1)}%</span>,
              <Badge key="s" variant="outline" className="text-[9px]">{r.status}</Badge>,
            ])} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
