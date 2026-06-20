import { useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Package, DollarSign, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { getOrderBadge } from '@/lib/order-status';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useData();

  const isPrinting = location.pathname.startsWith('/printing-orders');
  const module = isPrinting ? 'printing' : 'stitching';

  const order = useMemo(() => {
    if (isPrinting) return data.printingOrders.find(o => o.id === id);
    return data.stitchingOrders.find(o => o.id === id);
  }, [data, id, isPrinting]);

  const colourways = useMemo(() => {
    if (!order) return [];
    return isPrinting
      ? data.printingColourways.filter(c => c.orderId === order.id)
      : data.stitchingColourways.filter(c => c.orderId === order.id);
  }, [data, order, isPrinting]);

  const entries = useMemo(() => {
    if (!order) return [];
    return data.entries.filter(e => e.orderId === order.id);
  }, [data, order]);

  const buyer = useMemo(() => {
    if (!order) return null;
    return data.buyers.find(b => b.id === order.buyerId);
  }, [data, order]);

  const productName = useMemo(() => {
    if (!order) return '';
    if (isPrinting) {
      const p = data.printingProducts.find(x => x.id === (order as any).printingProductId);
      return p ? `${p.code} - ${p.name}` : '';
    }
    const p = data.stitchingProducts.find(x => x.id === (order as any).stitchingProductId);
    return p ? `${p.code} - ${p.name}` : '';
  }, [data, order, isPrinting]);

  const fabricName = useMemo(() => {
    if (!order) return '';
    const fId = isPrinting ? (order as any).fabricId : (order as any).fabricId;
    if (!fId) return 'N/A';
    const f = data.fabrics.find(x => x.id === fId);
    return f ? `${f.shortForm} - ${f.name}` : '';
  }, [data, order, isPrinting]);

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const totalOrdered = colourways.reduce((s, c) => s + c.orderedQty, 0);
  const totalProduced = entries.reduce((s, e) => s + e.outputQty, 0);
  const totalCost = entries.reduce((s, e) => s + e.costAmount, 0);
  const progressPct = totalOrdered > 0 ? Math.min((totalProduced / totalOrdered) * 100, 100) : 0;
  const derivedStatus = getOrderBadge(order.status, entries.length, order.targetEndDate);

  const colourwayStats = colourways.map(cw => {
    const cwEntries = entries.filter(e => e.colourwayId === cw.id);
    const produced = cwEntries.reduce((s, e) => s + e.outputQty, 0);
    const cost = cwEntries.reduce((s, e) => s + e.costAmount, 0);
    const pct = cw.orderedQty > 0 ? (produced / cw.orderedQty) * 100 : 0;
    return { ...cw, produced, balance: cw.orderedQty - produced, cost, pct };
  });

  const orderValue = (order as any).ratePerItem && order.orderQty
    ? (order as any).ratePerItem * order.orderQty
    : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(isPrinting ? '/printing-orders' : '/stitching-orders')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-semibold">{order.internalPO}</h1>
        <Badge className={`${derivedStatus.color} text-xs`}>{derivedStatus.label}</Badge>
        <Badge variant="outline" className="text-xs capitalize">{module}</Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="bg-gradient-to-br from-primary/10 to-info/10 border-primary/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Package className="h-3.5 w-3.5" /> Total Output</div>
            <div className="text-xl font-bold">{totalProduced} <span className="text-xs font-normal text-muted-foreground">/ {totalOrdered}</span></div>
            <Progress value={progressPct} className="h-2 mt-2" />
            <div className="text-[10px] text-muted-foreground mt-1">{progressPct.toFixed(1)}% complete</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/10 to-accent/10 border-success/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3.5 w-3.5" /> Total Cost</div>
            <div className="text-xl font-bold">₹{totalCost.toFixed(0)}</div>
            {totalProduced > 0 && <div className="text-[10px] text-muted-foreground mt-1">Avg: ₹{(totalCost / totalProduced).toFixed(2)}/unit</div>}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-info/10 to-primary/10 border-info/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="h-3.5 w-3.5" /> Order Value</div>
            <div className="text-xl font-bold">{(order as any).currency || 'INR'} {orderValue.toFixed(0)}</div>
            {(order as any).ratePerItem > 0 && <div className="text-[10px] text-muted-foreground mt-1">Rate: {(order as any).currency} {(order as any).ratePerItem}/item</div>}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-warning/10 to-accent/10 border-warning/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="h-3.5 w-3.5" /> Entries</div>
            <div className="text-xl font-bold">{entries.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Production entries logged</div>
          </CardContent>
        </Card>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Internal PO</span><span className="font-mono">{order.internalPO}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Buyer PO</span><span>{order.buyerPO || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Buyer</span><span>{buyer ? `${buyer.code}${buyer.name ? ' - ' + buyer.name : ''}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Style</span><span>{order.style}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span>{productName || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fabric</span><span>{fabricName}</span></div>
            {isPrinting && (order as any).fabricWidth && <div className="flex justify-between"><span className="text-muted-foreground">Width</span><span>{(order as any).fabricWidth}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">UOM</span><span>{order.uom}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={`text-[10px] ${derivedStatus.className}`}>{derivedStatus.label}</Badge></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Quantities & Dates</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Order Qty</span><span className="font-semibold">{order.orderQty}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Chart Qty</span><span>{(order as any).chartQty || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Produced</span><span className="font-semibold text-success">{totalProduced}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span className={totalOrdered - totalProduced < 0 ? 'text-warning font-semibold' : 'font-semibold'}>{totalOrdered - totalProduced}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Target End</span><span>{order.targetEndDate || '—'}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Buyer Delivery</span>
              <span className="flex items-center gap-1">
                {order.buyerDeliveryDate || '—'}
                {order.buyerDeliveryDate && order.buyerDeliveryDate < new Date().toISOString().slice(0, 10) && order.status === 'Started' && (
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                )}
              </span>
            </div>
            {order.remarks && <div className="flex justify-between"><span className="text-muted-foreground">Remarks</span><span>{order.remarks}</span></div>}
          </CardContent>
        </Card>
      </div>

      {/* Colourway Progress */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Colourway Progress</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">Colour</TableHead>
                  <TableHead className="text-xs h-8">Ordered</TableHead>
                  <TableHead className="text-xs h-8">Produced</TableHead>
                  <TableHead className="text-xs h-8">Balance</TableHead>
                  <TableHead className="text-xs h-8">Cost</TableHead>
                  <TableHead className="text-xs h-8 min-w-[120px]">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colourwayStats.map(cw => (
                  <TableRow key={cw.id}>
                    <TableCell className="text-sm py-2 font-medium">{cw.colourName}</TableCell>
                    <TableCell className="text-sm py-2">{cw.orderedQty}</TableCell>
                    <TableCell className="text-sm py-2 font-semibold">{cw.produced}</TableCell>
                    <TableCell className={`text-sm py-2 ${cw.balance < 0 ? 'text-warning font-semibold' : ''}`}>{cw.balance}</TableCell>
                    <TableCell className="text-sm py-2 font-mono">₹{cw.cost.toFixed(0)}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(cw.pct, 100)} className="h-2 flex-1" />
                        <span className={`text-[10px] font-medium ${cw.pct >= 100 ? 'text-success' : cw.pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                          {cw.pct.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {colourwayStats.length > 1 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell className="text-xs py-2">Total</TableCell>
                    <TableCell className="text-xs py-2">{totalOrdered}</TableCell>
                    <TableCell className="text-xs py-2">{totalProduced}</TableCell>
                    <TableCell className="text-xs py-2">{totalOrdered - totalProduced}</TableCell>
                    <TableCell className="text-xs py-2 font-mono">₹{totalCost.toFixed(0)}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={progressPct} className="h-2 flex-1" />
                        <span className="text-[10px]">{progressPct.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
