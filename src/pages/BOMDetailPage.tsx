import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Printer, Download, ShoppingBag, FileText, Package, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { printDetailPage } from '@/lib/pdf-export';

const CATEGORY_COLORS: Record<string, string> = {
  fabric: 'bg-blue-100 text-blue-800',
  trim: 'bg-purple-100 text-purple-800',
  accessory: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-600',
};

export default function BOMDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: appData } = useData();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [poDialogOpen, setPoDialogOpen] = useState(false);

  const { data: bom, isLoading } = useQuery({
    queryKey: ['bom_detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from('bom_headers').select('*').eq('id', id).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ['bom_detail_lines', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from('bom_lines').select('*').eq('bom_id', id).order('sort_order');
      return data || [];
    },
    enabled: !!id,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors_bom_detail', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('vendors').select('*').eq('company_id', companyId).eq('is_active', true);
      return data || [];
    },
    enabled: !!companyId,
  });

  const orderRef = useMemo(() => {
    if (!bom) return null;
    const allOrders = [...appData.printingOrders.map((o: any) => ({ ...o, module: 'printing' })), ...appData.stitchingOrders.map((o: any) => ({ ...o, module: 'stitching' }))];
    return allOrders.find((o: any) => o.id === bom.order_id);
  }, [bom, appData]);

  const totalAmount = useMemo(() =>
    lines.reduce((s, l: any) => s + (Number(l.total_amount) || 0), 0),
  [lines]);

  const generatePOMutation = useMutation({
    mutationFn: async () => {
      if (!bom) throw new Error('BOM not found');
      const vendorGroups: Record<string, any[]> = {};
      lines.forEach((l: any) => {
        if (!l.vendor_name) return;
        if (!vendorGroups[l.vendor_name]) vendorGroups[l.vendor_name] = [];
        vendorGroups[l.vendor_name].push(l);
      });
      const vendorNames = Object.keys(vendorGroups);
      if (vendorNames.length === 0) throw new Error('No lines with vendors assigned');

      for (const vendorName of vendorNames) {
        const vLines = vendorGroups[vendorName];
        const vendor = vendors.find((v: any) => v.name === vendorName);
        if (!vendor) throw new Error(`Vendor "${vendorName}" not found`);

        const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
        const totalAmt = vLines.reduce((s, l) => s + (Number(l.total_amount) || 0), 0) || null;

        const { data: po, error } = await supabase.from('purchase_orders').insert({
          po_number: poNumber, vendor_id: vendor.id, po_date: new Date().toISOString().slice(0, 10),
          status: 'draft', source_type: bom.bom_type === 'manual' ? 'manual' : 'bom',
          currency: 'USD', total_amount: totalAmt, order_id: bom.order_id,
          company_id: companyId, remarks: `From BOM: ${bom.title || id?.slice(0, 8)}`,
        }).select().single();
        if (error) throw error;

        const poLineRows = vLines.map((l: any) => ({
          po_id: po.id, item_name: l.item_name, item_id: l.item_id || null,
          uom: l.uom || 'meters',
          qty_ordered: Math.ceil((Number(l.quantity) || 0) * (Number(l.avg_consumption) || 1) * (1 + (Number(l.extra_pct) || 0) / 100)),
          rate: Number(l.rate) || 0, amount: Number(l.total_amount) || 0,
        }));
        const { error: lineErr } = await supabase.from('purchase_order_lines').insert(poLineRows);
        if (lineErr) throw lineErr;
      }

      await supabase.from('bom_headers').update({ status: 'po_generated' }).eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom_detail', id] });
      qc.invalidateQueries({ queryKey: ['bom_headers'] });
      qc.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Purchase Orders generated');
      setPoDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handlePrint = () => {
    if (!bom) return;
    printDetailPage(`BOM: ${bom.title || 'BOM'}`, [
      { label: 'Title', value: bom.title || '—' },
      { label: 'Type', value: bom.bom_type },
      { label: 'Status', value: bom.status },
      { label: 'Order Ref', value: orderRef?.internalPO || bom.order_id?.slice(0, 8) || '—' },
      { label: 'Total Amount', value: `$${totalAmount.toFixed(2)}` },
      { label: 'Remarks', value: bom.remarks || '—' },
    ], [
      {
        title: 'Material Lines',
        headers: ['Category', 'Item', 'UOM', 'Qty', 'Consumption', 'Extra %', 'Rate', 'Required Qty', 'Amount', 'Vendor'],
        rows: lines.map((l: any) => {
          const reqQty = Math.ceil((Number(l.quantity) || 0) * (Number(l.avg_consumption) || 1) * (1 + (Number(l.extra_pct) || 0) / 100));
          return [l.category, l.item_name, l.uom, l.quantity, l.avg_consumption || '—', l.extra_pct ? `${l.extra_pct}%` : '—', l.rate ? `$${l.rate}` : '—', reqQty, `$${(l.total_amount || 0).toFixed(2)}`, l.vendor_name || '—'];
        }),
      },
    ]);
  };

  const handleDownload = () => {
    if (!bom) return;
    const header = 'Category,Item,UOM,Qty,Consumption,Extra%,Rate,Required Qty,Amount,Vendor\n';
    const rows = lines.map((l: any) => {
      const reqQty = Math.ceil((Number(l.quantity) || 0) * (Number(l.avg_consumption) || 1) * (1 + (Number(l.extra_pct) || 0) / 100));
      return `"${l.category}","${l.item_name}","${l.uom}",${l.quantity},${l.avg_consumption || ''},${l.extra_pct || 0},${l.rate || 0},${reqQty},${(l.total_amount || 0).toFixed(2)},"${l.vendor_name || ''}"`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `BOM-${bom.title || id?.slice(0, 8)}.csv`; a.click();
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  if (!bom) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">BOM not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const linesWithVendors = lines.filter((l: any) => l.vendor_name);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/bom')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-semibold">{bom.title || 'Untitled BOM'}</h1>
        <Badge variant="outline" className="text-[10px] capitalize">{bom.bom_type}</Badge>
        <Badge variant="outline" className="text-[10px]">{bom.status}</Badge>
        <div className="ml-auto flex gap-2">
          {linesWithVendors.length > 0 && bom.status === 'draft' && (
            <Button size="sm" variant="default" onClick={() => setPoDialogOpen(true)}>
              <ShoppingBag className="h-3.5 w-3.5 mr-1" /> Generate POs
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          <Button size="sm" variant="outline" onClick={handleDownload}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="bg-gradient-to-br from-primary/10 to-info/10 border-primary/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="h-3.5 w-3.5" /> Type</div>
            <div className="text-lg font-bold capitalize">{bom.bom_type}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/10 to-accent/10 border-success/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Package className="h-3.5 w-3.5" /> Order Ref</div>
            <div className="text-lg font-bold">{orderRef?.internalPO || '—'}</div>
            {orderRef && <div className="text-[10px] text-muted-foreground mt-1 capitalize">{orderRef.module}</div>}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-info/10 to-primary/10 border-info/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ShoppingCart className="h-3.5 w-3.5" /> Lines</div>
            <div className="text-lg font-bold">{lines.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{linesWithVendors.length} ready for purchase</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-warning/10 to-accent/10 border-warning/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ShoppingBag className="h-3.5 w-3.5" /> Total</div>
            <div className="text-lg font-bold">${totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* BOM Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">BOM Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span>{bom.title || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{bom.bom_type}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline" className="text-[10px]">{bom.status}</Badge></div>
            {bom.remarks && <div className="flex justify-between"><span className="text-muted-foreground">Remarks</span><span>{bom.remarks}</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Order Reference</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
            {orderRef ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Internal PO</span><span>{orderRef.internalPO}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Buyer PO</span><span>{orderRef.buyerPO || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Module</span><span className="capitalize">{orderRef.module}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Style</span><span>{orderRef.style || '—'}</span></div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-2">{bom.bom_type === 'manual' ? 'No order reference (manual purchase)' : 'Order not found'}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Material Lines */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Material Lines ({lines.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">#</TableHead>
                  <TableHead className="text-xs h-8">Category</TableHead>
                  <TableHead className="text-xs h-8">Item</TableHead>
                  <TableHead className="text-xs h-8">UOM</TableHead>
                  <TableHead className="text-xs h-8 text-right">Order Qty</TableHead>
                  <TableHead className="text-xs h-8 text-right">Consumption</TableHead>
                  <TableHead className="text-xs h-8 text-right">Extra %</TableHead>
                  <TableHead className="text-xs h-8 text-right">Rate</TableHead>
                  <TableHead className="text-xs h-8 text-right">Required</TableHead>
                  <TableHead className="text-xs h-8 text-right">Amount</TableHead>
                  <TableHead className="text-xs h-8">Vendor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-sm text-muted-foreground">No material lines</TableCell></TableRow>
                ) : lines.map((l: any, i: number) => {
                  const reqQty = Math.ceil((Number(l.quantity) || 0) * (Number(l.avg_consumption) || 1) * (1 + (Number(l.extra_pct) || 0) / 100));
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs py-2 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="py-2"><Badge className={`text-[10px] ${CATEGORY_COLORS[l.category] || ''}`}>{l.category}</Badge></TableCell>
                      <TableCell className="text-sm py-2 font-medium">{l.item_name}</TableCell>
                      <TableCell className="text-sm py-2">{l.uom || '—'}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{l.quantity}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{l.avg_consumption || '—'}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{l.extra_pct ? `${l.extra_pct}%` : '—'}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{l.rate ? `$${l.rate}` : '—'}</TableCell>
                      <TableCell className="text-sm py-2 text-right font-semibold">{reqQty}</TableCell>
                      <TableCell className="text-sm py-2 text-right font-mono">${(l.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-sm py-2">{l.vendor_name || '—'}</TableCell>
                    </TableRow>
                  );
                })}
                {lines.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={9} className="text-xs py-2 text-right">Total</TableCell>
                    <TableCell className="text-xs py-2 text-right font-mono">${totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-xs py-2"></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Generate PO Confirmation Dialog */}
      <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generate Purchase Orders</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            POs will be created from {linesWithVendors.length} line(s) with assigned vendors.
          </p>
          <div className="space-y-3 mt-2">
            {lines.map((l: any) => !l.vendor_name ? null : (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <span>{l.item_name}</span>
                <span className="text-muted-foreground">{l.vendor_name} · ${(l.total_amount || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
          {lines.filter((l: any) => !l.vendor_name).length > 0 && (
            <p className="text-xs text-destructive">⚠ {lines.filter((l: any) => !l.vendor_name).length} line(s) without vendors will be skipped</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => generatePOMutation.mutate()} disabled={generatePOMutation.isPending}>
              {generatePOMutation.isPending ? 'Creating...' : `Generate PO(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
