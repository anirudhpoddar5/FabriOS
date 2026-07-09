import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Package, DollarSign, TrendingUp, Calendar, AlertTriangle, Printer, Download } from 'lucide-react';
import { getOrderBadge } from '@/lib/order-status';
import { printDetailPage } from '@/lib/pdf-export';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, getItems } = useData();
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const [rows, setRows] = useState<any[]>([]);

  const isPrinting = location.pathname.startsWith('/printing-orders');
  const module = isPrinting ? 'printing' : 'stitching';

  const order = useMemo(() => {
    if (isPrinting) return data.printingOrders.find(o => o.id === id);
    return data.stitchingOrders.find(o => o.id === id);
  }, [data, id, isPrinting]);

  const colourways = useMemo(() => {
    if (!order) return [];
    return isPrinting
      ? data.printingColourways.filter((c: any) => c.orderId === order.id)
      : data.stitchingColourways.filter((c: any) => c.orderId === order.id);
  }, [data, order, isPrinting]);

  const entries = useMemo(() => {
    if (!order) return [];
    return data.entries.filter((e: any) => e.orderId === order.id);
  }, [data, order]);

  useEffect(() => {
    if (!id || !companyId) return;
    supabase.from('order_rows').select('*').eq('order_id', id).order('sort_order').then(({ data: d }) => {
      if (d) setRows(d);
    });
  }, [id, companyId]);

  const buyer = useMemo(() => {
    if (!order) return null;
    return data.buyers.find((b: any) => b.id === order.buyerId);
  }, [data, order]);

  const enrichRow = (row: any) => {
    const product = isPrinting
      ? data.printingProducts.find((p: any) => p.id === row.product_id)
      : data.stitchingProducts.find((p: any) => p.id === row.product_id);
    const fabric = data.fabrics.find((f: any) => f.id === row.fabric_id);
    const rowColourways = colourways.filter((cw: any) => cw.orderRowId === row.id);
    const rowEntries = entries.filter((e: any) => rowColourways.some((cw: any) => cw.id === e.colourwayId));
    return { ...row, product, fabric, colourways: rowColourways, entries: rowEntries };
  };

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

  const totalOrdered = colourways.reduce((s: number, c: any) => s + c.orderedQty, 0);
  const totalProduced = entries.reduce((s: number, e: any) => s + e.outputQty, 0);
  const totalCost = entries.reduce((s: number, e: any) => s + e.costAmount, 0);
  const progressPct = totalOrdered > 0 ? Math.min((totalProduced / totalOrdered) * 100, 100) : 0;
  const derivedStatus = getOrderBadge(order.status, entries.length, order.targetEndDate, progressPct);

  const enrichedRows = rows.map(enrichRow);

  const handlePrint = () => {
    const sections = [
      { label: 'Internal PO', value: order.internalPO },
      { label: 'Buyer PO', value: order.buyerPO || '—' },
      { label: 'Buyer', value: buyer ? `${buyer.code}${buyer.name ? ' - ' + buyer.name : ''}` : '—' },
      { label: 'Style', value: order.style || '—' },
      { label: 'Status', value: derivedStatus.label },
      { label: 'Target End', value: order.targetEndDate || '—' },
      { label: 'Buyer Delivery', value: order.buyerDeliveryDate || '—' },
      { label: 'Total Ordered', value: String(totalOrdered) },
      { label: 'Total Produced', value: String(totalProduced) },
      { label: 'Total Cost', value: `₹${totalCost.toFixed(0)}` },
    ];

    const tables: any[] = [];

    if (rows.length > 0) {
      tables.push({
        title: 'Order Rows',
        headers: ['#', 'Product', 'Fabric', 'Width', 'Order Qty', 'Chart Qty', 'UOM', 'Rate'],
        rows: rows.map((r, i) => [i + 1, r.product ? `${r.product.name}` : '—', r.fabric ? r.fabric.name : '—', r.fabric_width || '—', r.order_qty, r.chart_qty || '—', r.uom, r.rate_per_item ? `${r.rate_per_item}` : '—']),
      });
    }

    if (colourways.length > 0) {
      tables.push({
        title: 'Colourways',
        headers: ['Colour', 'Ordered', 'Produced', 'Balance', 'Cost'],
        rows: colourways.map((cw: any) => {
          const cwEntries = entries.filter((e: any) => e.colourwayId === cw.id);
          const produced = cwEntries.reduce((s: number, e: any) => s + e.outputQty, 0);
          const cost = cwEntries.reduce((s: number, e: any) => s + e.costAmount, 0);
          return [cw.colourName, cw.orderedQty, produced, cw.orderedQty - produced, `₹${cost.toFixed(0)}`];
        }),
      });
    }

    if (entries.length > 0) {
      tables.push({
        title: 'Production Entries',
        headers: ['Date', 'Resource', 'Worker Type', 'Output', 'Cost'],
        rows: entries.map((e: any) => [e.date, e.resourceId?.slice(0, 8) || '—', e.workerTypeId?.slice(0, 8) || '—', e.outputQty, `₹${e.costAmount.toFixed(0)}`]),
      });
    }

    printDetailPage(`Order: ${order.internalPO}`, sections, tables);
  };

  const handleDownload = () => {
    const csvRows = [['Colour', 'Ordered', 'Produced', 'Balance', 'Cost'].join(',')];
    colourways.forEach((cw: any) => {
      const cwEntries = entries.filter((e: any) => e.colourwayId === cw.id);
      const produced = cwEntries.reduce((s: number, e: any) => s + e.outputQty, 0);
      const cost = cwEntries.reduce((s: number, e: any) => s + e.costAmount, 0);
      csvRows.push([cw.colourName, cw.orderedQty, produced, cw.orderedQty - produced, cost].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${order.internalPO}.csv`; a.click();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(isPrinting ? '/printing-orders' : '/stitching-orders')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-semibold">{order.internalPO}</h1>
        <Badge className={`${derivedStatus.color} text-xs`}>{derivedStatus.label}</Badge>
        <Badge variant="outline" className="text-xs capitalize">{module}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          <Button size="sm" variant="outline" onClick={handleDownload}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        </div>
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
            <div className="text-xl font-bold">{order.currency || 'INR'} {rows.reduce((s, r) => s + (r.order_qty || 0) * (r.rate_per_item || 0), 0).toFixed(0)}</div>
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
            {rows.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Product Rows</span><span>{rows.length}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={`text-[10px] ${derivedStatus.className}`}>{derivedStatus.label}</Badge></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Quantities & Dates</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
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

      {/* Order Rows (multi-row) */}
      {enrichedRows.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Order Rows ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">#</TableHead>
                    <TableHead className="text-xs h-8">Product</TableHead>
                    <TableHead className="text-xs h-8">Fabric</TableHead>
                    <TableHead className="text-xs h-8">Width</TableHead>
                    <TableHead className="text-xs h-8">Order Qty</TableHead>
                    <TableHead className="text-xs h-8">Chart Qty</TableHead>
                    <TableHead className="text-xs h-8">UOM</TableHead>
                    <TableHead className="text-xs h-8">Rate</TableHead>
                    <TableHead className="text-xs h-8">Value</TableHead>
                    <TableHead className="text-xs h-8">Colours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedRows.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm py-2 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm py-2 font-medium">
                        {r.product ? `${r.product.name}` : '—'}
                        {!r.product && r.product_id && <span className="text-[10px] text-muted-foreground block">{r.product_id.slice(0, 8)}</span>}
                      </TableCell>
                      <TableCell className="text-sm py-2">{r.fabric ? `${r.fabric.shortForm || r.fabric.name}` : '—'}</TableCell>
                      <TableCell className="text-sm py-2">{r.fabric_width || '—'}</TableCell>
                      <TableCell className="text-sm py-2 font-semibold">{r.order_qty}</TableCell>
                      <TableCell className="text-sm py-2">{r.chart_qty || '—'}</TableCell>
                      <TableCell className="text-sm py-2">{r.uom}</TableCell>
                      <TableCell className="text-sm py-2">{r.rate_per_item ? `${order.currency || ''} ${r.rate_per_item}` : '—'}</TableCell>
                      <TableCell className="text-sm py-2 font-mono">{((r.order_qty || 0) * (r.rate_per_item || 0)).toFixed(0)}</TableCell>
                      <TableCell className="text-sm py-2">{r.no_of_colours || r.colourways?.length || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Colourway Progress */}
      <Card className="mb-4">
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
                {colourways.map((cw: any) => {
                  const cwEntries = entries.filter((e: any) => e.colourwayId === cw.id);
                  const produced = cwEntries.reduce((s: number, e: any) => s + e.outputQty, 0);
                  const cost = cwEntries.reduce((s: number, e: any) => s + e.costAmount, 0);
                  const pct = cw.orderedQty > 0 ? (produced / cw.orderedQty) * 100 : 0;
                  return (
                    <TableRow key={cw.id}>
                      <TableCell className="text-sm py-2 font-medium">{cw.colourName}</TableCell>
                      <TableCell className="text-sm py-2">{cw.orderedQty}</TableCell>
                      <TableCell className="text-sm py-2 font-semibold">{produced}</TableCell>
                      <TableCell className={`text-sm py-2 ${cw.orderedQty - produced < 0 ? 'text-warning font-semibold' : ''}`}>{cw.orderedQty - produced}</TableCell>
                      <TableCell className="text-sm py-2 font-mono">₹{cost.toFixed(0)}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(pct, 100)} className="h-2 flex-1" />
                          <span className={`text-[10px] font-medium ${pct >= 100 ? 'text-success' : pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {colourways.length > 1 && (
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

      {/* Production Entries */}
      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Production Entries ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Date</TableHead>
                    <TableHead className="text-xs h-8">Worker Type</TableHead>
                    <TableHead className="text-xs h-8">Persons</TableHead>
                    <TableHead className="text-xs h-8">Output</TableHead>
                    <TableHead className="text-xs h-8">Rate Basis</TableHead>
                    <TableHead className="text-xs h-8">Rate</TableHead>
                    <TableHead className="text-xs h-8">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs py-2">{e.date}</TableCell>
                      <TableCell className="text-xs py-2">{e.workerTypeId?.slice(0, 8) || '—'}</TableCell>
                      <TableCell className="text-xs py-2">{e.personsUsed || '—'}</TableCell>
                      <TableCell className="text-xs py-2 font-semibold">{e.outputQty}</TableCell>
                      <TableCell className="text-xs py-2">{e.rateBasis || '—'}</TableCell>
                      <TableCell className="text-xs py-2">{e.rateValue || '—'}</TableCell>
                      <TableCell className="text-xs py-2 font-mono">₹{e.costAmount.toFixed(0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
