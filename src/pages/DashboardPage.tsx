import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Printer, Scissors, ClipboardList, DollarSign, Package, AlertTriangle, CheckCircle2, Truck, ShoppingCart, Warehouse, Layers, Factory } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { GuidedTour } from '@/components/GuidedTour';

export default function DashboardPage() {
  return (
    <>
      <GuidedTour />
      <DashboardContent />
    </>
  );
}

function DashboardContent() {
  const { data } = useData();
  const { currentModule, profile } = useAuth();
  const navigate = useNavigate();
  const companyId = profile?.company_id;
  const today = new Date().toISOString().slice(0, 10);

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

  const stats = useMemo(() => {
    const showPrinting = currentModule === 'printing' || currentModule === 'both';
    const showStitching = currentModule === 'stitching' || currentModule === 'both';
    const activePrinting = showPrinting ? data.printingOrders.filter((o: any) => o.status === 'Started').length : 0;
    const activeStitching = showStitching ? data.stitchingOrders.filter((o: any) => o.status === 'Started').length : 0;
    const delayedOrders = [
      ...(showPrinting ? data.printingOrders : []),
      ...(showStitching ? data.stitchingOrders : []),
    ].filter((o: any) => o.status === 'Started' && o.targetEndDate && o.targetEndDate < today).length;

    const todayEntries = data.entries.filter((e: any) => e.date === today);
    const openStockJobs = stockJobs.filter((j: any) => j.status === 'planned' || j.status === 'in_progress').length;
    const pendingPOs = pos.filter((p: any) => p.status === 'draft' || p.status === 'sent' || p.status === 'partial').length;
    const pendingPOValue = pos.filter((p: any) => p.status !== 'closed' && p.status !== 'cancelled').reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);
    const lowStockItems = invItems.filter((i: any) => i.reorder_level > 0 && i.opening_stock <= i.reorder_level).length;
    const todayDispatches = dispatches.filter((d: any) => d.dispatch_date === today).length;

    // WIP summary
    const allOrders = [...data.printingOrders, ...data.stitchingOrders].filter((o: any) => o.status === 'Started');
    const allCws = [...data.printingColourways, ...data.stitchingColourways];
    let totalOrdered = 0, totalProduced = 0;
    allOrders.forEach((o: any) => {
      const cws = allCws.filter((c: any) => c.orderId === o.id);
      totalOrdered += cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0);
      totalProduced += data.entries.filter((e: any) => e.orderId === o.id).reduce((s: number, e: any) => s + e.outputQty, 0);
    });

    return {
      activePrinting, activeStitching, delayedOrders,
      todayCount: todayEntries.length,
      todayOutput: todayEntries.reduce((s: number, e: any) => s + e.outputQty, 0),
      todayCost: todayEntries.reduce((s: number, e: any) => s + e.costAmount, 0),
      openStockJobs, pendingPOs, pendingPOValue, lowStockItems, todayDispatches,
      totalOrdered, totalProduced, totalBalance: totalOrdered - totalProduced,
    };
  }, [data, today, currentModule, stockJobs, pos, invItems, dispatches]);

  const showPrinting = currentModule === 'printing' || currentModule === 'both';
  const showStitching = currentModule === 'stitching' || currentModule === 'both';

  const cards = [
    ...(showPrinting ? [{ title: 'Active Printing', value: stats.activePrinting, icon: Printer, onClick: () => navigate('/printing-orders'), color: stats.activePrinting > 0 ? 'text-amber-600' : 'text-muted-foreground', border: 'border-l-amber-400' }] : []),
    ...(showStitching ? [{ title: 'Active Stitching', value: stats.activeStitching, icon: Scissors, onClick: () => navigate('/stitching-orders'), color: stats.activeStitching > 0 ? 'text-amber-600' : 'text-muted-foreground', border: 'border-l-amber-400' }] : []),
    { title: 'Delayed Orders', value: stats.delayedOrders, icon: AlertTriangle, onClick: () => navigate('/production-control'), color: stats.delayedOrders > 0 ? 'text-red-600' : 'text-muted-foreground', border: stats.delayedOrders > 0 ? 'border-l-red-500' : 'border-l-gray-200' },
    { title: 'Open Stock Jobs', value: stats.openStockJobs, icon: Factory, onClick: () => navigate('/stock-jobs'), color: '', border: '' },
    { title: "Today's Entries", value: stats.todayCount, icon: ClipboardList, onClick: () => navigate('/entries'), color: '', border: '' },
    { title: "Today's Output", value: stats.todayOutput, icon: Package, onClick: () => navigate('/reports'), color: '', border: '' },
    { title: "Today's Cost", value: `₹${stats.todayCost.toFixed(0)}`, icon: DollarSign, onClick: () => navigate('/reports'), color: '', border: '' },
    { title: 'Pending POs', value: stats.pendingPOs, icon: ShoppingCart, onClick: () => navigate('/purchase-orders'), color: '', border: '' },
    { title: 'Low Stock Items', value: stats.lowStockItems, icon: Warehouse, onClick: () => navigate('/inventory'), color: stats.lowStockItems > 0 ? 'text-red-600' : 'text-muted-foreground', border: stats.lowStockItems > 0 ? 'border-l-red-500' : '' },
    { title: "Today's Dispatches", value: stats.todayDispatches, icon: Truck, onClick: () => navigate('/dispatch'), color: '', border: '' },
  ];

  const overallPct = stats.totalOrdered > 0 ? (stats.totalProduced / stats.totalOrdered) * 100 : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold">{profile?.display_name ? `Welcome, ${profile.display_name}` : 'Dashboard'}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Here's what's happening today</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {cards.map(c => (
          <Card key={c.title} className={`cursor-pointer hover:shadow-sm transition-shadow border border-l-4 ${c.border || ''}`} onClick={c.onClick}>
            <CardContent className="pt-3 pb-2.5 px-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground leading-tight">{c.title}</span>
                <c.icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              </div>
              <div className={`text-xl font-semibold tracking-tight ${c.color}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Balance visibility */}
      {stats.totalOrdered > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Order Balance Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div><p className="text-[10px] text-muted-foreground">Total Ordered</p><p className="text-lg font-semibold">{stats.totalOrdered}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Total Produced</p><p className="text-lg font-semibold">{stats.totalProduced}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Balance to Produce</p><p className="text-lg font-semibold text-primary">{stats.totalBalance}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={Math.min(overallPct, 100)} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{overallPct.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
