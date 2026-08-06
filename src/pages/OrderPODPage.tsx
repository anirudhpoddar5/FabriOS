import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Printer, Download, Truck, Building, User, Phone, MapPin, Hash, Calendar, Package, BarChart3 } from 'lucide-react';
import { printDetailPage } from '@/lib/pdf-export';
import { useLocation } from 'react-router-dom';

export default function OrderPODPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { data } = useData();
  const companyId = profile?.company_id;
  const isPrinting = location.pathname.startsWith('/printing-orders');

  const [order, setOrder] = useState<any>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !companyId) return;
    Promise.all([
      supabase.from('order_headers').select('*, buyers(*)').eq('id', id).single(),
      supabase.from('order_rows').select('*').eq('order_id', id).order('sort_order'),
      supabase.from('companies').select('*').eq('id', companyId).single(),
      supabase.from('dispatch_records').select('*').eq('order_id', id).order('dispatch_date', { ascending: false }),
    ]).then(([h, r, c, d]) => {
      if (h.data) setOrder(h.data);
      if (r.data) setRawRows(r.data);
      if (c.data) setCompany(c.data);
      if (d.data) setDispatches(d.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, companyId]);

  const buyer = order?.buyers;

  // order_rows.product_id references printing_products or stitching_products depending on
  // module — there's no single FK PostgREST can auto-embed, so resolve client-side against
  // the already-loaded AppData (same pattern as OrderDetailPage.tsx's enrichRow()).
  const rows = useMemo(() => rawRows.map((r: any) => ({
    ...r,
    printing_products: isPrinting ? data.printingProducts.find((p: any) => p.id === r.product_id) : undefined,
    stitching_products: !isPrinting ? data.stitchingProducts.find((p: any) => p.id === r.product_id) : undefined,
    fabrics: data.fabrics.find((f: any) => f.id === r.fabric_id),
  })), [rawRows, isPrinting, data.printingProducts, data.stitchingProducts, data.fabrics]);

  const totalOrdered = rows.reduce((s, r) => s + (r.order_qty || 0), 0);
  const totalDispatched = dispatches.reduce((s, d) => s + Number(d.qty), 0);
  const balance = totalOrdered - totalDispatched;

  const handlePrint = useCallback(() => {
    printDetailPage(`POD: ${order?.internal_po || ''}`, [
      { label: 'Internal PO', value: order?.internal_po || '—' },
      { label: 'Buyer', value: buyer ? `${buyer.name || buyer.code}` : '—' },
      { label: 'Style', value: order?.style || '—' },
      { label: 'Status', value: order?.status || '—' },
      { label: 'Total Ordered', value: String(totalOrdered) },
      { label: 'Total Dispatched', value: String(totalDispatched) },
      { label: 'Balance', value: String(balance) },
    ], [
      {
        title: 'Dispatch Records',
        headers: ['Date', 'Product', 'Colour', 'Qty', 'UOM', 'Challan', 'Vehicle'],
        rows: dispatches.map((d: any) => [d.dispatch_date, d.product_name || '—', d.colour || '—', String(d.qty), d.uom || '—', d.challan_number || '—', d.vehicle_number || '—']),
      },
    ]);
  }, [order, buyer, totalOrdered, totalDispatched, balance, dispatches]);

  const handleDownload = useCallback(() => {
    const header = ['Product', 'Fabric', 'Qty', 'UOM', 'Dispatched', 'Balance'].join(',');
    const data = rows.map(r => [r.printing_products?.name || r.stitching_products?.name || '—', r.fabrics?.name || '—', r.order_qty, r.uom, String(dispatches.filter((d: any) => d.product_name === (r.printing_products?.name || r.stitching_products?.name)).reduce((s, d) => s + Number(d.qty), 0)), String((r.order_qty || 0) - dispatches.filter((d: any) => d.product_name === (r.printing_products?.name || r.stitching_products?.name)).reduce((s, d) => s + Number(d.qty), 0))].join(','));
    const blob = new Blob([header + '\n' + data], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `POD-${order?.internal_po || 'order'}.csv`; a.click();
  }, [order, rows, dispatches]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading POD...</div>;
  }

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

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(isPrinting ? `/printing-orders/${id}` : `/stitching-orders/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Order
        </Button>
        <h1 className="text-lg font-semibold">Proof of Delivery — {order.internal_po}</h1>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" /> Print POD</Button>
          <Button size="sm" variant="outline" onClick={handleDownload}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        </div>
      </div>

      <div className="border rounded-md p-4 mb-4 bg-white print:p-0 print:border-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            {company && (
              <div className="mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-1"><Building className="h-3.5 w-3.5" /> {company.name}</h2>
                <p className="text-xs text-muted-foreground">{company.legal_name && <><span className="font-medium">{company.legal_name}</span><br /></>}{company.address}</p>
              </div>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-sm font-semibold">Proof of Delivery</h2>
            <p className="text-xs text-muted-foreground">POD #{order.internal_po}</p>
            <p className="text-xs text-muted-foreground">Date: {new Date().toISOString().slice(0, 10)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardContent className="p-3 space-y-1">
              <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2"><User className="h-3 w-3" /> Buyer Details</h3>
              {buyer && (
                <>
                  <p className="text-xs"><span className="text-muted-foreground">Name:</span> {buyer.name || buyer.code}</p>
                  {buyer.contact_person && <p className="text-xs"><span className="text-muted-foreground">Contact:</span> {buyer.contact_person}</p>}
                  {buyer.phone && <p className="text-xs"><span className="text-muted-foreground">Phone:</span> {buyer.phone}</p>}
                  {buyer.email && <p className="text-xs"><span className="text-muted-foreground">Email:</span> {buyer.email}</p>}
                  {buyer.address && <p className="text-xs"><span className="text-muted-foreground">Address:</span> {buyer.address}</p>}
                  {buyer.country && <p className="text-xs"><span className="text-muted-foreground">Country:</span> {buyer.country}</p>}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 space-y-1">
              <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Package className="h-3 w-3" /> Order Details</h3>
              <p className="text-xs"><span className="text-muted-foreground">Style:</span> {order.style || '—'}</p>
              <p className="text-xs"><span className="text-muted-foreground">Buyer PO:</span> {order.buyer_po || '—'}</p>
              <p className="text-xs"><span className="text-muted-foreground">Delivery Date:</span> {order.buyer_delivery_date || '—'}</p>
              <div className="text-xs flex items-center gap-1"><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-[10px]">{order.status}</Badge></div>
              <p className="text-xs"><span className="text-muted-foreground">Remarks:</span> {order.remarks || '—'}</p>
            </CardContent>
          </Card>
        </div>

        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Product Rows</h3>
        <div className="border rounded-md overflow-x-auto mb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs">Fabric</TableHead>
                <TableHead className="text-xs">Width</TableHead>
                <TableHead className="text-xs text-right">Order Qty</TableHead>
                <TableHead className="text-xs">UOM</TableHead>
                <TableHead className="text-xs text-right">Rate</TableHead>
                <TableHead className="text-xs text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs py-1.5 text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs py-1.5 font-medium">{r.printing_products?.name || r.stitching_products?.name || '—'}</TableCell>
                  <TableCell className="text-xs py-1.5">{r.fabrics?.name || '—'}</TableCell>
                  <TableCell className="text-xs py-1.5">{r.fabric_width || '—'}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-semibold">{r.order_qty}</TableCell>
                  <TableCell className="text-xs py-1.5">{r.uom}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">{r.rate_per_item ? `${order.currency || ''} ${r.rate_per_item}` : '—'}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-mono">{((r.order_qty || 0) * (r.rate_per_item || 0)).toFixed(0)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={4} className="text-xs py-1.5 text-right">Total</TableCell>
                <TableCell className="text-xs py-1.5 text-right">{totalOrdered}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Dispatch History</h3>
        {dispatches.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No dispatches recorded for this order.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs">Colour</TableHead>
                  <TableHead className="text-xs text-right">Qty</TableHead>
                  <TableHead className="text-xs">UOM</TableHead>
                  <TableHead className="text-xs">Challan</TableHead>
                  <TableHead className="text-xs">Vehicle</TableHead>
                  <TableHead className="text-xs">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs py-1.5">{d.dispatch_date}</TableCell>
                    <TableCell className="text-xs py-1.5">{d.product_name || '—'}</TableCell>
                    <TableCell className="text-xs py-1.5">{d.colour || '—'}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-semibold">{d.qty}</TableCell>
                    <TableCell className="text-xs py-1.5">{d.uom || '—'}</TableCell>
                    <TableCell className="text-xs py-1.5 font-mono">{d.challan_number || '—'}</TableCell>
                    <TableCell className="text-xs py-1.5">{d.vehicle_number || '—'}</TableCell>
                    <TableCell className="text-xs py-1.5 text-muted-foreground">{d.remarks || '—'}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={3} className="text-xs py-1.5 text-right">Total</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">{totalDispatched}</TableCell>
                  <TableCell colSpan={4}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="bg-primary/5">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ordered</p>
              <p className="text-xl font-bold">{totalOrdered}</p>
            </CardContent>
          </Card>
          <Card className="bg-success/10">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Dispatched</p>
              <p className="text-xl font-bold text-success">{totalDispatched}</p>
            </CardContent>
          </Card>
          <Card className={balance <= 0 ? 'bg-success/10' : 'bg-warning/10'}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</p>
              <p className={`text-xl font-bold ${balance <= 0 ? 'text-success' : 'text-warning'}`}>{balance}</p>
            </CardContent>
          </Card>
        </div>

        <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-8 text-xs">
          <div>
            <p className="font-semibold mb-1">Received By</p>
            <div className="border-b border-dashed border-muted-foreground/30 h-8 mb-1"></div>
            <p className="text-muted-foreground">Name & Signature</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Delivered By</p>
            <div className="border-b border-dashed border-muted-foreground/30 h-8 mb-1"></div>
            <p className="text-muted-foreground">Name & Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
