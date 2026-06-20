import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function ProductionControlPage() {
  const { data } = useData();
  const { profile, currentModule } = useAuth();
  const companyId = profile?.company_id;
  const today = new Date().toISOString().slice(0, 10);

  const { data: stockJobs = [] } = useQuery({
    queryKey: ['stock_jobs', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('stock_jobs').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatch_records', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('dispatch_records').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  // WIP stages for orders
  const wipData = useMemo(() => {
    const allOrders = [...data.printingOrders, ...data.stitchingOrders];
    const allColourways = [...data.printingColourways, ...data.stitchingColourways];

    const stages = {
      pendingPrinting: 0, inPrinting: 0, printedPendingStitching: 0,
      inStitching: 0, readyToShip: 0, shipped: 0,
    };

    allOrders.forEach((o: any) => {
      const cws = allColourways.filter((c: any) => c.orderId === o.id);
      const totalOrdered = cws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0);
      const printEntries = data.entries.filter((e: any) => e.orderId === o.id && e.module === 'printing');
      const stitchEntries = data.entries.filter((e: any) => e.orderId === o.id && e.module === 'stitching');
      const printed = printEntries.reduce((s: number, e: any) => s + e.outputQty, 0);
      const stitched = stitchEntries.reduce((s: number, e: any) => s + e.outputQty, 0);
      const dispatched = dispatches.filter((d: any) => d.order_id === o.id).reduce((s: number, d: any) => s + Number(d.qty), 0);

      if (o.status === 'Shipped') { stages.shipped += totalOrdered; return; }
      if (o.status === 'Completed') { stages.readyToShip += totalOrdered - dispatched; stages.shipped += dispatched; return; }

      const isPrinting = data.printingOrders.some((p: any) => p.id === o.id);
      const isStitching = data.stitchingOrders.some((s: any) => s.id === o.id);

      if (isPrinting && printed < totalOrdered) {
        stages.pendingPrinting += totalOrdered - printed;
        stages.inPrinting += printed;
      } else if (isStitching && stitched < totalOrdered) {
        if (isPrinting) stages.printedPendingStitching += totalOrdered - stitched;
        else stages.pendingPrinting += 0;
        stages.inStitching += stitched;
      }
    });

    return stages;
  }, [data, dispatches]);

  // Bottleneck view
  const bottlenecks = useMemo(() => {
    const allOrders = [...data.printingOrders, ...data.stitchingOrders].filter((o: any) => o.status === 'Started');
    return allOrders.map((o: any) => {
      const entries = data.entries.filter((e: any) => e.orderId === o.id);
      const allCws = [...data.printingColourways, ...data.stitchingColourways].filter((c: any) => c.orderId === o.id);
      const totalOrdered = allCws.reduce((s: number, c: any) => s + (c.orderedQty || 0), 0);
      const produced = entries.reduce((s: number, e: any) => s + e.outputQty, 0);
      const pct = totalOrdered > 0 ? (produced / totalOrdered) * 100 : 0;
      const isDelayed = o.targetEndDate && o.targetEndDate < today;
      const isPrinting = data.printingOrders.some((p: any) => p.id === o.id);
      return {
        internalPO: o.internalPO, module: isPrinting ? 'printing' : 'stitching',
        totalOrdered, produced, balance: totalOrdered - produced, pct,
        targetEndDate: o.targetEndDate, isDelayed, status: o.status,
      };
    }).filter(b => b.balance > 0).sort((a, b) => (a.isDelayed === b.isDelayed ? a.pct - b.pct : a.isDelayed ? -1 : 1));
  }, [data, today]);

  // Capacity vs demand
  const capacityView = useMemo(() => {
    const printingDemand = data.printingOrders.filter((o: any) => o.status === 'Started').length;
    const stitchingDemand = data.stitchingOrders.filter((o: any) => o.status === 'Started').length;
    const printingCapacity = data.printingTables.filter((t: any) => t.active !== false).length;
    const stitchingCapacity = data.stitchingLines.filter((l: any) => l.active !== false).length;
    return { printingDemand, printingCapacity, stitchingDemand, stitchingCapacity };
  }, [data]);

  const wipTotal = Object.values(wipData).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Production Control</h1>
      <Tabs defaultValue="wip">
        <TabsList className="mb-3 flex-wrap">
          <TabsTrigger value="wip" className="text-xs"><Layers className="h-3 w-3 mr-1" /> WIP</TabsTrigger>
          <TabsTrigger value="bottleneck" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Bottlenecks</TabsTrigger>
          <TabsTrigger value="capacity" className="text-xs"><TrendingUp className="h-3 w-3 mr-1" /> Capacity</TabsTrigger>
        </TabsList>

        <TabsContent value="wip">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {[
              { label: 'Pending Printing', value: wipData.pendingPrinting, color: 'text-orange-600' },
              { label: 'In Printing', value: wipData.inPrinting, color: 'text-blue-600' },
              { label: 'Printed → Stitching', value: wipData.printedPendingStitching, color: 'text-purple-600' },
              { label: 'In Stitching', value: wipData.inStitching, color: 'text-indigo-600' },
              { label: 'Ready to Ship', value: wipData.readyToShip, color: 'text-green-600' },
              { label: 'Shipped', value: wipData.shipped, color: 'text-muted-foreground' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-3 pb-2 px-3">
                  <p className="text-[10px] text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stock jobs WIP */}
          {stockJobs.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Stock Jobs WIP</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs h-8">Job #</TableHead>
                    <TableHead className="text-xs h-8">Product</TableHead>
                    <TableHead className="text-xs h-8">Module</TableHead>
                    <TableHead className="text-xs h-8 text-right">Target</TableHead>
                    <TableHead className="text-xs h-8 text-right">Produced</TableHead>
                    <TableHead className="text-xs h-8 text-right">Balance</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {stockJobs.filter((j: any) => j.status !== 'completed' && j.status !== 'cancelled').map((j: any) => (
                      <TableRow key={j.id}>
                        <TableCell className="text-sm py-2">{j.job_number}</TableCell>
                        <TableCell className="text-sm py-2">{j.product_name}</TableCell>
                        <TableCell className="text-sm py-2 capitalize">{j.module}</TableCell>
                        <TableCell className="text-sm py-2 text-right">{j.target_qty}</TableCell>
                        <TableCell className="text-sm py-2 text-right">{j.produced_qty}</TableCell>
                        <TableCell className="text-sm py-2 text-right font-medium">{j.target_qty - j.produced_qty}</TableCell>
                        <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{j.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bottleneck">
          {bottlenecks.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No bottlenecks detected. All orders are on track.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs h-8">PO</TableHead>
                  <TableHead className="text-xs h-8">Stage</TableHead>
                  <TableHead className="text-xs h-8 text-right">Ordered</TableHead>
                  <TableHead className="text-xs h-8 text-right">Produced</TableHead>
                  <TableHead className="text-xs h-8 text-right">Pending</TableHead>
                  <TableHead className="text-xs h-8">Progress</TableHead>
                  <TableHead className="text-xs h-8">Target</TableHead>
                  <TableHead className="text-xs h-8">Risk</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bottlenecks.map((b, i) => (
                    <TableRow key={i} className={b.isDelayed ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-sm py-2 font-medium">{b.internalPO}</TableCell>
                      <TableCell className="text-sm py-2 capitalize">{b.module}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{b.totalOrdered}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{b.produced}</TableCell>
                      <TableCell className="text-sm py-2 text-right font-medium">{b.balance}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          <Progress value={Math.min(b.pct, 100)} className="h-1.5 w-16" />
                          <span className="text-[10px]">{b.pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm py-2">{b.targetEndDate || '-'}</TableCell>
                      <TableCell className="py-2">
                        {b.isDelayed ? <Badge variant="destructive" className="text-[10px]">Delayed</Badge> : <Badge variant="outline" className="text-[10px]">On Track</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="capacity">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Printing</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span>Active Tables</span><span className="font-medium">{capacityView.printingCapacity}</span></div>
                  <div className="flex justify-between text-sm"><span>Active Orders</span><span className="font-medium">{capacityView.printingDemand}</span></div>
                  <div className="flex justify-between text-sm">
                    <span>Load</span>
                    <Badge variant={capacityView.printingDemand > capacityView.printingCapacity ? 'destructive' : 'outline'} className="text-[10px]">
                      {capacityView.printingCapacity > 0 ? `${((capacityView.printingDemand / capacityView.printingCapacity) * 100).toFixed(0)}%` : 'N/A'}
                    </Badge>
                  </div>
                  {capacityView.printingDemand > capacityView.printingCapacity && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Overloaded — {capacityView.printingDemand - capacityView.printingCapacity} orders exceed capacity</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Stitching</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span>Active Lines</span><span className="font-medium">{capacityView.stitchingCapacity}</span></div>
                  <div className="flex justify-between text-sm"><span>Active Orders</span><span className="font-medium">{capacityView.stitchingDemand}</span></div>
                  <div className="flex justify-between text-sm">
                    <span>Load</span>
                    <Badge variant={capacityView.stitchingDemand > capacityView.stitchingCapacity ? 'destructive' : 'outline'} className="text-[10px]">
                      {capacityView.stitchingCapacity > 0 ? `${((capacityView.stitchingDemand / capacityView.stitchingCapacity) * 100).toFixed(0)}%` : 'N/A'}
                    </Badge>
                  </div>
                  {capacityView.stitchingDemand > capacityView.stitchingCapacity && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Overloaded — {capacityView.stitchingDemand - capacityView.stitchingCapacity} orders exceed capacity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
