import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Printer, Scissors, ClipboardList, DollarSign, Package, AlertTriangle,
  Truck, ShoppingCart, Warehouse, Factory, Plus, TrendingUp, Clock, Layers, Building2, Droplets,
  ArrowLeftRight, Circle, IndianRupee
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { GuidedTour } from '@/components/GuidedTour';
import { getOrderHealth, type OrderHealthState } from '@/lib/order-health';
import { getOrderDelay } from '@/lib/order-delay';

const ORDER_HEALTH_CONFIG: Record<OrderHealthState, { label: string; badge: string; bg: string; border: string; text: string; dot: string }> = {
  red: { label: 'Late', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', bg: 'bg-red-50/40 dark:bg-red-950/10', border: 'border-red-200 dark:border-red-900', text: 'text-red-600', dot: 'bg-red-500' },
  amber: { label: 'At Risk', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', bg: 'bg-amber-50/40 dark:bg-amber-950/10', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600', dot: 'bg-amber-500' },
  grey: { label: 'Not Started', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400', bg: 'bg-gray-50/40 dark:bg-gray-900/10', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-500', dot: 'bg-gray-400' },
  green: { label: 'On Track', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', bg: 'bg-green-50/40 dark:bg-green-950/10', border: 'border-green-200 dark:border-green-800', text: 'text-green-600', dot: 'bg-green-500' },
};

export default function DashboardPage() {
  return (
    <>
      <GuidedTour />
      <DashboardContent />
    </>
  );
}

function DashboardContent() {
  const { data, currentFactoryId, setCurrentFactoryId } = useData();
  const { currentModule, profile } = useAuth();
  const navigate = useNavigate();
  const companyId = profile?.company_id;
  const today = new Date().toISOString().slice(0, 10);
  const [filterHealthState, setFilterHealthState] = useState<OrderHealthState | null>(null);

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const { data: stockJobs = [] } = useQuery({
    queryKey: ['stock_jobs_dash', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('stock_jobs').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatch_dash', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('dispatch_records').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['po_dash', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('purchase_orders').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: invItems = [] } = useQuery({
    queryKey: ['inv_dash', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('inventory_items').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: materialIssues = [] } = useQuery({
    queryKey: ['mat_dash', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('material_issues').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: costSummaries = [] } = useQuery({
    queryKey: ['cost_summary_dash', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('order_cost_summary').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: companySettings } = useQuery({
    queryKey: ['company_dash', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase.from('companies').select('working_days').eq('id', companyId).single();
      return data;
    },
    enabled: !!companyId,
  });

  const workingDays: number[] = (companySettings as { working_days?: number[] } | null)?.working_days ?? [1, 2, 3, 4, 5, 6];

  const showP = currentModule === 'printing' || currentModule === 'both';
  const showS = currentModule === 'stitching' || currentModule === 'both';

  const factories = data.factories.filter((f: any) =>
    f.active !== false && (f.type === currentModule || f.type === 'mixed' || !currentModule)
  );

  const selectedFactory = useMemo(() => {
    if (!currentFactoryId) return null;
    return data.factories.find((f: any) => f.id === currentFactoryId) || null;
  }, [currentFactoryId, data.factories]);

  // Map resource IDs (tables/lines) to their factory
  const resourceFactoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    data.printingTables.forEach((t: any) => { map[t.id] = t.factoryId; });
    data.stitchingLines.forEach((l: any) => { map[l.id] = l.factoryId; });
    return map;
  }, [data.printingTables, data.stitchingLines]);

  // Filter entries by current factory
  const filteredEntries = useMemo(() => {
    if (!currentFactoryId) return data.entries;
    return data.entries.filter((e: any) => resourceFactoryMap[e.resourceId] === currentFactoryId);
  }, [data.entries, currentFactoryId, resourceFactoryMap]);

  // Orders that have production in this factory
  const factoryOrderIds = useMemo(() => {
    if (!currentFactoryId) return null;
    return new Set(filteredEntries.map((e: any) => e.orderId));
  }, [currentFactoryId, filteredEntries]);

  const filterOrders = (orders: any[]) => {
    if (!currentFactoryId || !factoryOrderIds) return orders;
    return orders.filter((o: any) => factoryOrderIds.has(o.id));
  };

  const printingOrders = useMemo(() => filterOrders(data.printingOrders), [data.printingOrders, currentFactoryId, factoryOrderIds]);
  const stitchingOrders = useMemo(() => filterOrders(data.stitchingOrders), [data.stitchingOrders, currentFactoryId, factoryOrderIds]);

  const stats = useMemo(() => {
    // KPI counts (Active Orders, Overdue/Due, Needs Attention) must reflect ALL
    // company orders — including "Not Started" ones with zero entries logged yet —
    // not just orders that already have production at the selected factory. Uses
    // the same unfiltered data.printingOrders/data.stitchingOrders source as the
    // Order Visibility Board below. "Active" = status is Started (not yet
    // Completed/Shipped/Cancelled); "Overdue" = past target/delivery date and still
    // Started.
    const allActiveOrders = [
      ...(showP ? data.printingOrders : []),
      ...(showS ? data.stitchingOrders : []),
    ].filter((o: any) => o.status === 'Started');

    const activePrinting = showP ? data.printingOrders.filter((o: any) => o.status === 'Started').length : 0;
    const activeStitching = showS ? data.stitchingOrders.filter((o: any) => o.status === 'Started').length : 0;
    const activeOrders = activePrinting + activeStitching;

    // allStarted stays factory-scoped: it feeds "In Production" and the overall
    // production-progress bar below, which are intentionally scoped to whatever
    // factory is selected (see "Showing orders with production at X" caption).
    const allStarted = [
      ...(showP ? printingOrders : []),
      ...(showS ? stitchingOrders : []),
    ].filter((o: any) => o.status === 'Started');

    const delayedOrders = allActiveOrders.filter((o: any) => {
      const pastTarget = o.targetEndDate && o.targetEndDate < today;
      const pastDelivery = o.buyerDeliveryDate && o.buyerDeliveryDate < today;
      return pastTarget || pastDelivery;
    }).length;
    const dueToday = allActiveOrders.filter((o: any) => o.buyerDeliveryDate === today).length;

    const todayEntries = filteredEntries.filter((e: any) => e.date === today);
    const openStockJobs = stockJobs.filter((j: any) => j.status === 'planned' || j.status === 'in_progress').length;
    const pendingPOs = pos.filter((p: any) => p.status === 'draft' || p.status === 'sent' || p.status === 'partial').length;
    const lowStockItems = invItems.filter((i: any) => i.reorder_level > 0 && i.opening_stock <= i.reorder_level).length;
    const todayDispatches = dispatches.filter((d: any) => d.dispatch_date === today).length;
    const overdueInvoices = data.invoices.filter((i: any) =>
      i.status !== 'paid' && i.status !== 'cancelled' && i.dueDate < today
    );
    const overdueTotal = overdueInvoices.reduce((s: number, i: any) => s + i.grandTotal, 0);
    const activeSubcontract = data.subcontractJobs.filter((j: any) => j.status === 'sent' || j.status === 'partial').length;

    const allCws = [...data.printingColourways, ...data.stitchingColourways];
    let totalOrdered = 0, totalProduced = 0;
    allStarted.forEach((o: any) => {
      const cws = allCws.filter((c: any) => c.orderId === o.id);
      totalOrdered += cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0);
      totalProduced += filteredEntries.filter((e: any) => e.orderId === o.id).reduce((s: number, e: any) => s + e.outputQty, 0);
    });

    const priorityOrders = allActiveOrders.filter((o: any) =>
      o.buyerDeliveryDate && o.buyerDeliveryDate <= today
    ).sort((a: any, b: any) => a.buyerDeliveryDate.localeCompare(b.buyerDeliveryDate)).slice(0, 4);

    const last7 = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const weekOutput = filteredEntries.filter((e: any) => last7.includes(e.date)).reduce((s: number, e: any) => s + e.outputQty, 0);

    return {
      activeOrders, activePrinting, activeStitching, delayedOrders, dueToday,
      todayCount: todayEntries.length,
      todayOutput: todayEntries.reduce((s: number, e: any) => s + e.outputQty, 0),
      todayCost: todayEntries.reduce((s: number, e: any) => s + e.costAmount, 0),
      openStockJobs, pendingPOs, lowStockItems, todayDispatches, weekOutput,
      totalOrdered, totalProduced, totalBalance: totalOrdered - totalProduced,
      priorityOrders, allStarted,
      materialWastagePct: materialIssues.reduce((s: number, i: any) => s + (Number(i.qty_issued) || 0), 0) > 0
        ? ((materialIssues.reduce((s: number, i: any) => s + (Number(i.qty_wasted) || 0), 0) / materialIssues.reduce((s: number, i: any) => s + (Number(i.qty_issued) || 0), 0)) * 100).toFixed(1)
        : '0.0',
      overdueInvoices: overdueInvoices.length,
      overdueTotal,
      activeSubcontract,
    };
  }, [filteredEntries, printingOrders, stitchingOrders, data.printingOrders, data.stitchingOrders, today, currentModule, stockJobs, pos, invItems, dispatches, showP, showS, data.printingColourways, data.stitchingColourways, data.invoices, data.subcontractJobs]);

  const overallPct = stats.totalOrdered > 0 ? (stats.totalProduced / stats.totalOrdered) * 100 : 0;

  const bigCards = [
    { label: "Today's Output", value: stats.todayOutput, unit: 'units', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', onClick: () => navigate('/entries') },
    { label: 'Active Orders', value: stats.activeOrders, unit: stats.activePrinting > 0 && stats.activeStitching > 0 ? `${stats.activePrinting}P / ${stats.activeStitching}S` : '', icon: stats.activePrinting > 0 ? Printer : Scissors, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', onClick: () => navigate(stats.activePrinting > 0 ? '/printing-orders' : '/stitching-orders') },
    { label: 'Overdue / Due', value: stats.delayedOrders + stats.dueToday, unit: stats.delayedOrders > 0 ? `${stats.delayedOrders} overdue` : '', icon: AlertTriangle, color: stats.delayedOrders > 0 || stats.dueToday > 0 ? 'text-red-600' : 'text-green-600', bg: stats.delayedOrders > 0 || stats.dueToday > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-green-50 dark:bg-green-950/30', border: stats.delayedOrders > 0 || stats.dueToday > 0 ? 'border-red-200 dark:border-red-800' : 'border-green-200 dark:border-green-800', onClick: () => navigate('/reports') },
    { label: '7-Day Trend', value: stats.weekOutput, unit: 'units this week', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', onClick: () => navigate('/reports') },
  ];

  const quickActions = [
    { label: 'Log Entry', icon: ClipboardList, onClick: () => navigate('/entries'), color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'New Order', icon: Plus, onClick: () => navigate('/printing-orders?action=new'), color: 'bg-amber-600 hover:bg-amber-700' },
    { label: 'New PO', icon: ShoppingCart, onClick: () => navigate('/purchase-orders?action=new'), color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Receive Goods', icon: Truck, onClick: () => navigate('/grn?action=new'), color: 'bg-emerald-600 hover:bg-emerald-700' },
  ];

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{profile?.display_name ? `Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, ${profile.display_name.split(' ')[0]}` : 'Dashboard'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> {dayName}, {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Layers className="h-3 w-3" />
          {currentModule === 'both' ? 'Printing + Stitching' : currentModule === 'printing' ? 'Printing Only' : 'Stitching Only'}
        </div>
      </div>

      {/* Factory filter bar */}
      <div className="flex items-center gap-2 mb-4 p-2.5 bg-muted/30 rounded-lg border border-border/50">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground shrink-0">Factory:</span>
        <Select value={currentFactoryId || 'all'} onValueChange={v => setCurrentFactoryId(v === 'all' ? null : v)}>
          <SelectTrigger className="h-7 text-xs w-[200px]">
            <SelectValue placeholder="All Factories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Factories</SelectItem>
            {factories.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedFactory && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            Showing orders with production at <strong>{selectedFactory.name}</strong> — Active Orders and Overdue/Due below are company-wide (orders aren't linked to a factory until their first entry is logged)
          </span>
        )}
      </div>

      {/* Big metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {bigCards.map(c => (
          <Card key={c.label} className={`cursor-pointer hover:shadow-sm transition-all border ${c.border} ${c.bg}`} onClick={c.onClick}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className={`text-2xl font-bold tracking-tight ${c.color}`}>{c.value}</div>
              {c.unit && <div className="text-[10px] text-muted-foreground mt-0.5">{c.unit}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Priority alerts */}
      {stats.priorityOrders.length > 0 && (
        <Card className="mb-5 border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white">
                <AlertTriangle className="h-3 w-3" />
              </div>
              <span className="text-xs font-semibold text-red-700 dark:text-red-400">Needs Attention</span>
              {stats.delayedOrders > 0 && <Badge variant="destructive" className="text-[9px] h-4">{stats.delayedOrders} overdue</Badge>}
              {stats.dueToday > 0 && <Badge variant="secondary" className="text-[9px] h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">{stats.dueToday} due today</Badge>}
            </div>
            <div className="space-y-1">
              {stats.priorityOrders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between text-xs px-1 py-0.5 rounded hover:bg-red-100/50 dark:hover:bg-red-900/20 cursor-pointer" onClick={() => navigate(`/printing-orders/${o.id}`)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{o.internalPO}</span>
                    <span className="text-muted-foreground truncate">{o.buyerId ? (data.buyers.find((b: any) => b.id === o.buyerId)?.name || '') : ''}</span>
                  </div>
                  <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${o.buyerDeliveryDate < today ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                    {o.buyerDeliveryDate < today ? `${Math.ceil((Date.now() - new Date(o.buyerDeliveryDate).getTime()) / 86400000)}d overdue` : 'Due today'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* In Production + Quick Actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* In Production */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> In Production ({stats.allStarted.length})
              </h2>
              <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => navigate('/order-detail')}>View all</Button>
            </div>
            {stats.allStarted.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No active orders. Create one to get started.</p>
            ) : (
              <div className="space-y-2">
                {stats.allStarted.slice(0, 5).map((o: any) => {
                  const cws = [...data.printingColourways, ...data.stitchingColourways].filter((c: any) => c.orderId === o.id);
                  const orderQty = cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0) || o.orderQty || 0;
                  const produced = filteredEntries.filter((e: any) => e.orderId === o.id).reduce((s: number, e: any) => s + e.outputQty, 0);
                  const pct = orderQty > 0 ? Math.min((produced / orderQty) * 100, 100) : 0;
                  const delayed = o.targetEndDate && o.targetEndDate < today;
                  const dueSoon = o.buyerDeliveryDate === today;
                  const allIncomplete = cws.length > 0 && cws.every((c: any) => {
                    const cwProduced = filteredEntries.filter((e: any) => e.orderId === o.id && e.colourwayId === c.id).reduce((s: number, e: any) => s + e.outputQty, 0);
                    return cwProduced < (c.orderedQty || 0);
                  });
                  const anyOverProduced = cws.some((c: any) => {
                    const cwProduced = filteredEntries.filter((e: any) => e.orderId === o.id && e.colourwayId === c.id).reduce((s: number, e: any) => s + e.outputQty, 0);
                    return cwProduced > (c.orderedQty || 0);
                  });
                  return (
                    <div key={o.id} className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors" onClick={() => navigate(`/printing-orders/${o.id}`)}>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate">{o.internalPO}</span>
                            <span className="text-[9px] text-muted-foreground truncate">{o.style || ''}</span>
                            {delayed && <Badge variant="destructive" className="text-[9px] h-4 px-1">Overdue</Badge>}
                            {dueSoon && <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-amber-100 text-amber-700">Due</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className={`text-[10px] shrink-0 w-8 text-right ${pct >= 100 && anyOverProduced && allIncomplete ? 'text-warning' : pct >= 100 ? 'text-success' : 'text-muted-foreground'}`}>{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-right shrink-0">
                          <div className="font-medium">{produced}/{orderQty}</div>
                          <div className="text-muted-foreground">units</div>
                        </div>
                      </div>
                      {cws.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 mt-1 ml-1">
                          {cws.map((c: any) => {
                            const cwProduced = filteredEntries.filter((e: any) => e.orderId === o.id && e.colourwayId === c.id).reduce((s: number, e: any) => s + e.outputQty, 0);
                            const cwPct = c.orderedQty > 0 ? (cwProduced / c.orderedQty) * 100 : 0;
                            return (
                              <div key={c.id} className="flex items-center gap-1 text-[9px] bg-muted/50 rounded px-1.5 py-0.5">
                                <span className="font-medium truncate max-w-[40px]">{c.colourName}</span>
                                <span className={`${cwPct >= 100 ? 'text-success' : cwPct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{cwPct.toFixed(0)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(a => (
                <Button key={a.label} size="sm" className={`h-16 text-xs ${a.color} text-white flex flex-col gap-1 items-center justify-center`} onClick={a.onClick}>
                  <a.icon className="h-4 w-4" />
                  {a.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Over-Plan Exception */}
      {costSummaries.filter((c: any) =>
        c.produced_qty > 0 &&
        c.actual_cost_per_piece > c.planned_cost_per_piece &&
        c.variance_per_piece >= 1 &&
        c.planned_cost_per_piece > 0 &&
        ((c.actual_cost_per_piece - c.planned_cost_per_piece) / c.planned_cost_per_piece * 100) >= 5
      ).length > 0 && (() => {
        const overPlan = costSummaries
          .filter((c: any) =>
            c.produced_qty > 0 &&
            c.actual_cost_per_piece > c.planned_cost_per_piece &&
            c.variance_per_piece >= 1 &&
            c.planned_cost_per_piece > 0 &&
            ((c.actual_cost_per_piece - c.planned_cost_per_piece) / c.planned_cost_per_piece * 100) >= 5
          )
          .sort((a: any, b: any) => b.variance_per_piece - a.variance_per_piece)
          .slice(0, 5);
        return (
          <Card className="mb-5 border-orange-200 dark:border-orange-900 bg-orange-50/60 dark:bg-orange-950/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white">
                  <IndianRupee className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">Cost Exceptions — Over Plan</span>
                <Badge variant="outline" className="text-[9px] h-4 border-orange-300 text-orange-700">{overPlan.length} orders</Badge>
              </div>
              <div className="space-y-1">
                {overPlan.map((c: any) => {
                  const order = [...data.printingOrders, ...data.stitchingOrders].find((o: any) => o.id === c.order_id);
                  return (
                    <div key={c.order_id} className="flex items-center justify-between text-xs px-1 py-0.5 rounded hover:bg-orange-100/50 dark:hover:bg-orange-900/20 cursor-pointer"
                      onClick={() => { const m = order?.module || 'printing'; navigate(`/${m === 'stitching' ? 'stitching-orders' : 'printing-orders'}/${c.order_id}`); }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{order?.internalPO || c.order_id.slice(0, 8)}</span>
                        <span className="text-muted-foreground">plan: ₹{c.planned_cost_per_piece.toFixed(2)}/pc</span>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                        ₹{c.variance_per_piece.toFixed(2)}/pc over plan
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Order Visibility Board */}
      {(() => {
        const allActiveOrders = [
          ...(showP ? data.printingOrders : []),
          ...(showS ? data.stitchingOrders : []),
        ].filter((o: any) => o.status === 'Started');
        const allCws = [...data.printingColourways, ...data.stitchingColourways];
        const allOrderRows = data.orderRows || [];

        const orderHealthMap = new Map<string, ReturnType<typeof getOrderHealth>>();
        for (const o of allActiveOrders) {
          const health = getOrderHealth(o, allCws, filteredEntries, today);
          orderHealthMap.set(o.id, health);
        }

        const sections: { state: OrderHealthState; orders: any[] }[] = [
          { state: 'red', orders: [] },
          { state: 'amber', orders: [] },
          { state: 'grey', orders: [] },
          { state: 'green', orders: [] },
        ];
        for (const o of allActiveOrders) {
          const h = orderHealthMap.get(o.id)!;
          const section = sections.find(s => s.state === h.state);
          if (section) section.orders.push({ ...o, health: h });
        }

        const activeSections = filterHealthState
          ? sections.filter(s => s.state === filterHealthState)
          : sections.filter(s => s.orders.length > 0);

        if (activeSections.length === 0) return null;

        return (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Order Visibility Board
              </h2>
              {filterHealthState && (
                <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setFilterHealthState(null)}>
                  Clear filter
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {activeSections.map(({ state, orders }) => {
                const cfg = ORDER_HEALTH_CONFIG[state];
                return (
                  <Card key={state} className={`border ${cfg.border} ${cfg.bg}`}>
                    <CardContent className="p-3">
                      <div
                        className="flex items-center gap-2 mb-2 cursor-pointer select-none"
                        onClick={() => setFilterHealthState(filterHealthState === state ? null : state)}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                        <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                        <Badge variant="outline" className="text-[9px] h-4 ml-1">{orders.length}</Badge>
                        <span className="text-[9px] text-muted-foreground ml-auto">
                          {filterHealthState !== state ? 'Click to filter' : 'Showing only this group'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {orders.map((o: any) => {
                          const h = o.health;
                          const rowCount = allOrderRows.filter((r: any) => r.orderId === o.id).length;
                          const colourCount = allCws.filter((c: any) => c.orderId === o.id).length;
                          const pct = h.orderedQty > 0 ? Math.min((h.producedQty / h.orderedQty) * 100, 100) : 0;
                          const daysUntilDue = h.daysUntilDue;
                          const isLate = h.state === 'red';
                          const isDue = daysUntilDue !== null && daysUntilDue <= 0;
                          return (
                            <div
                              key={o.id}
                              className="cursor-pointer rounded-lg border border-border/60 bg-card hover:shadow-sm transition-all p-2.5"
                              onClick={() => navigate(`/${o.module === 'printing' ? 'printing-orders' : 'stitching-orders'}/${o.id}`)}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                  <span className="text-[11px] font-semibold truncate">{o.internalPO}</span>
                                </div>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                                  {daysUntilDue !== null && daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue !== null && daysUntilDue <= 0 ? 'Due today' : daysUntilDue !== null && daysUntilDue <= 2 ? `${daysUntilDue}d left` : daysUntilDue !== null ? `${daysUntilDue}d left` : 'No due date'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-1.5">
                                <span>{rowCount} {rowCount === 1 ? 'item' : 'items'}</span>
                                {colourCount > 0 && <span>{colourCount} {colourCount === 1 ? 'colour' : 'colours'}</span>}
                                {o.buyerPO && <span className="truncate">PO: {o.buyerPO}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={pct} className="h-1.5 flex-1" />
                                <span className={`text-[10px] shrink-0 w-10 text-right font-medium ${
                                  pct >= 100 ? 'text-success' : isLate || isDue ? 'text-destructive' : pct > 0 ? 'text-primary' : 'text-muted-foreground'
                                }`}>
                                  {h.producedQty}/{h.orderedQty}
                                </span>
                              </div>
                              {h.dueDate && (
                                <div className="text-[9px] text-muted-foreground mt-1">
                                  Due: {h.dueDate}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Delay Exceptions */}
      {(() => {
        const allActiveOrders = [
          ...(showP ? printingOrders : []),
          ...(showS ? stitchingOrders : []),
        ].filter((o: any) => o.status === 'Started');
        const allCws = [...data.printingColourways, ...data.stitchingColourways];
        const allEntries = data.entries;

        const now = new Date();
        const delayExceptions = allActiveOrders
          .map((o: any) => {
            const result = getOrderDelay(o, allCws, allEntries, now, workingDays);
            const cws = allCws.filter((c: any) => c.orderId === o.id);
            const orderedQty = cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0) || o.orderQty || 0;
            const producedQty = allEntries.filter((e: any) => e.orderId === o.id).reduce((s: number, e: any) => s + (e.outputQty || 0), 0);
            return { order: o, orderedQty, producedQty, ...result };
          })
          .filter(r => r.exception !== null)
          .sort((a, b) => {
            const order: Record<string, number> = { days_late: 0, no_output: 1, below_target: 2, due_today: 3 };
            return (order[a.exception!] ?? 99) - (order[b.exception!] ?? 99);
          });

        if (delayExceptions.length === 0) return null;

        return (
          <Card className="mb-5 border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white">
                  <AlertTriangle className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">Delay Exceptions</span>
                <Badge variant="destructive" className="text-[9px] h-4">{delayExceptions.length}</Badge>
              </div>
              <div className="space-y-1">
                {delayExceptions.slice(0, 10).map((r: any) => {
                  const orderId = r.order.id;
                  const module = r.order.module || 'printing';
                  return (
                    <div key={orderId} className="flex items-center gap-3 text-xs px-1 py-0.5 rounded hover:bg-red-100/50 dark:hover:bg-red-900/20 cursor-pointer"
                      onClick={() => navigate(`/${module === 'stitching' ? 'stitching-orders' : 'printing-orders'}/${orderId}`)}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium truncate">{r.order.internalPO}</span>
                        <span className="text-muted-foreground truncate">{r.order.buyerId ? (data.buyers.find((b: any) => b.id === r.order.buyerId)?.name || '') : ''}</span>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                        {r.exceptionMessage}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground font-mono">
                        {r.producedQty}/{r.orderedQty}
                      </span>
                      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={e => { e.stopPropagation(); navigate(`/${module === 'stitching' ? 'stitching-orders' : 'printing-orders'}/${orderId}`); }}>
                        Open
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Secondary metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "Today's Cost", value: `₹${stats.todayCost.toFixed(0)}`, icon: DollarSign, onClick: () => navigate('/entries'), color: stats.todayCost > 0 ? '' : 'text-muted-foreground' },
          { label: 'Pending POs', value: stats.pendingPOs, icon: ShoppingCart, onClick: () => navigate('/purchase-orders'), color: stats.pendingPOs > 0 ? 'text-amber-600' : '' },
          { label: 'Stock Jobs', value: stats.openStockJobs, icon: Factory, onClick: () => navigate('/stock-jobs'), color: stats.openStockJobs > 0 ? '' : 'text-muted-foreground' },
          { label: 'Dispatches', value: stats.todayDispatches, icon: Truck, onClick: () => navigate('/dispatch'), color: stats.todayDispatches > 0 ? '' : 'text-muted-foreground' },
          { label: 'Low Stock', value: stats.lowStockItems, icon: Warehouse, onClick: () => navigate('/inventory'), color: stats.lowStockItems > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'WIP Balance', value: stats.totalBalance, icon: Layers, onClick: () => null, color: stats.totalBalance > 0 ? 'text-primary' : 'text-muted-foreground' },
          { label: 'Material Waste', value: `${stats.materialWastagePct}%`, icon: Droplets, onClick: () => navigate('/material-issues'), color: Number(stats.materialWastagePct) > 5 ? 'text-red-600' : 'text-green-600' },
          { label: 'Overdue AR', value: `$${stats.overdueTotal.toFixed(0)}`, icon: DollarSign, onClick: () => navigate('/invoices'), color: stats.overdueTotal > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Subcontract', value: stats.activeSubcontract, icon: ArrowLeftRight, onClick: () => navigate('/subcontract-jobs'), color: stats.activeSubcontract > 0 ? 'text-amber-600' : 'text-muted-foreground' },
        ].map(m => (
          <Card key={m.label} className={`cursor-pointer hover:shadow-sm transition-shadow ${m.onClick ? '' : 'cursor-default'}`} onClick={m.onClick || undefined}>
            <CardContent className="p-2.5 flex flex-col items-center text-center">
              <m.icon className={`h-3.5 w-3.5 mb-1 ${m.color || 'text-muted-foreground'}`} />
              <div className={`text-xs font-semibold ${m.color || ''}`}>{m.value}</div>
              <div className="text-[9px] text-muted-foreground leading-tight">{m.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall progress */}
      {stats.totalOrdered > 0 && (
        <Card className="mt-3">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Overall Production Progress</span>
              <span className="text-[10px] font-medium">{stats.totalProduced} / {stats.totalOrdered} units ({overallPct.toFixed(0)}%)</span>
            </div>
            <Progress value={Math.min(overallPct, 100)} className="h-2" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
