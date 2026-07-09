import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Printer, Download, PackageCheck, Building, Calendar, Package, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { printDetailPage } from '@/lib/pdf-export';

const GRN_STATUS_COLORS: Record<string, string> = {
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  accepted_with_damage: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  draft: 'bg-muted text-muted-foreground',
};

export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn_detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from('grn_headers').select('*, vendors(name, code), purchase_orders(po_number, po_date, currency, total_amount)').eq('id', id).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ['grn_detail_lines', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from('grn_lines').select('*').eq('grn_id', id).order('created_at');
      return data || [];
    },
    enabled: !!id,
  });

  // Get PO lines for qty comparison
  const { data: poLines = [] } = useQuery({
    queryKey: ['grn_po_lines', grn?.po_id],
    queryFn: async () => {
      if (!grn?.po_id) return [];
      const { data } = await supabase.from('purchase_order_lines').select('*').eq('po_id', grn.po_id);
      return data || [];
    },
    enabled: !!grn?.po_id,
  });

  const enrichedLines = useMemo(() => {
    return lines.map((l: any) => {
      const poLine = poLines.find((p: any) => p.id === l.po_line_id);
      const ordered = poLine?.qty_ordered || 0;
      const received = l.qty_received || 0;
      const balance = ordered - received;
      let qtyStatus: 'full' | 'short' | 'excess' | 'no_po' = 'no_po';
      if (poLine) {
        if (received === ordered) qtyStatus = 'full';
        else if (received < ordered) qtyStatus = 'short';
        else qtyStatus = 'excess';
      }
      return { ...l, ordered, balance, qtyStatus };
    });
  }, [lines, poLines]);

  const totalQty = useMemo(() => lines.reduce((s, l: any) => s + l.qty_received, 0), [lines]);
  const totalOrdered = useMemo(() => poLines.reduce((s, l: any) => s + l.qty_ordered, 0), [poLines]);
  const hasRejections = lines.some((l: any) => l.remarks?.toLowerCase().includes('rejected'));

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  if (!grn) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">GRN not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Go Back
        </Button>
      </div>
    );
  }

  const handlePrint = () => {
    const vendor = (grn as any).vendors;
    const po = (grn as any).purchase_orders;
    printDetailPage(`GRN: ${grn.grn_number}`, [
      { label: 'GRN Number', value: grn.grn_number },
      { label: 'Vendor', value: vendor?.name || '—' },
      { label: 'PO Reference', value: po?.po_number || '—' },
      { label: 'Date', value: grn.grn_date || '—' },
      { label: 'Status', value: grn.status },
      { label: 'Total Items', value: String(lines.length) },
      { label: 'Total Qty', value: String(totalQty) },
      { label: 'Remarks', value: grn.remarks || '—' },
    ], [
      {
        title: 'Received Items',
        headers: ['Item', 'Ordered', 'Received', 'UOM', 'Lot #', 'Batch #', 'Remarks'],
        rows: enrichedLines.map((l: any) => [
          l.item_name, l.ordered || '—', l.qty_received,
          l.uom || '—', l.lot_number || '—', l.batch_number || '—',
          l.remarks || '—',
        ]),
      },
    ]);
  };

  const handleDownload = () => {
    const header = 'Item,Qty Ordered,Qty Received,Balance,UOM,Lot #,Batch #,Remarks\n';
    const rows = enrichedLines.map((l: any) => `${l.item_name},${l.ordered || 0},${l.qty_received},${l.balance || 0},${l.uom || ''},${l.lot_number || ''},${l.batch_number || ''},"${l.remarks || ''}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${grn.grn_number}.csv`; a.click();
  };

  const vendor = (grn as any).vendors;
  const po = (grn as any).purchase_orders;

  const qtyComparisonBadge = (status: string) => {
    switch (status) {
      case 'full': return <Badge className="text-[10px] bg-emerald-100 text-emerald-800">Full</Badge>;
      case 'short': return <Badge className="text-[10px] bg-amber-100 text-amber-800">Short</Badge>;
      case 'excess': return <Badge className="text-[10px] bg-blue-100 text-blue-800">Excess</Badge>;
      default: return null;
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/grn')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-semibold">{grn.grn_number}</h1>
        <Badge className={`text-[10px] ${GRN_STATUS_COLORS[grn.status] || ''}`}>{grn.status}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          <Button size="sm" variant="outline" onClick={handleDownload}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="bg-gradient-to-br from-primary/10 to-info/10 border-primary/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><PackageCheck className="h-3.5 w-3.5" /> GRN #</div>
            <div className="text-lg font-bold">{grn.grn_number}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/10 to-accent/10 border-success/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Building className="h-3.5 w-3.5" /> Vendor</div>
            <div className="text-lg font-bold truncate">{vendor?.name || '—'}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-info/10 to-primary/10 border-info/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="h-3.5 w-3.5" /> GRN Date</div>
            <div className="text-lg font-bold">{grn.grn_date || '—'}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-warning/10 to-accent/10 border-warning/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Package className="h-3.5 w-3.5" /> Items</div>
            <div className="text-lg font-bold">{lines.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{totalQty} total qty received</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Receipt Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">GRN #</span><span className="font-mono">{grn.grn_number}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vendor</span><span>{vendor?.name || '—'}</span></div>
            {vendor?.code && <div className="flex justify-between"><span className="text-muted-foreground">Vendor Code</span><span>{vendor.code}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">PO Ref</span><span>{po?.po_number || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{grn.grn_date}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={`text-[10px] ${GRN_STATUS_COLORS[grn.status] || ''}`}>{grn.status}</Badge></div>
            {grn.remarks && <div className="flex justify-between"><span className="text-muted-foreground">Remarks</span><span>{grn.remarks}</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Item Lines</span><span>{lines.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Qty</span><span className="font-semibold">{totalQty}</span></div>
            {poLines.length > 0 && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">PO Total</span><span className="font-semibold">{po?.currency || ''} {(poLines as any[]).reduce((s, l) => s + (l.amount || 0), 0).toFixed(2)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PO Ordered</span>
                  <span className="font-semibold">{totalOrdered}</span>
                </div>
              </>
            )}
            {hasRejections && (
              <div className="flex items-center gap-1 text-destructive text-xs mt-2">
                <AlertTriangle className="h-3 w-3" /> Contains rejected items
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Received Items ({lines.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">#</TableHead>
                  <TableHead className="text-xs h-8">Item</TableHead>
                  <TableHead className="text-xs h-8 text-right">PO Ordered</TableHead>
                  <TableHead className="text-xs h-8 text-right">Received</TableHead>
                  <TableHead className="text-xs h-8 text-right">Balance</TableHead>
                  <TableHead className="text-xs h-8">Status</TableHead>
                  <TableHead className="text-xs h-8">UOM</TableHead>
                  <TableHead className="text-xs h-8">Lot #</TableHead>
                  <TableHead className="text-xs h-8">Batch #</TableHead>
                  <TableHead className="text-xs h-8">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedLines.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-sm text-muted-foreground">No items received</TableCell></TableRow>
                ) : enrichedLines.map((l: any, i: number) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs py-2 text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-sm py-2 font-medium">{l.item_name}</TableCell>
                    <TableCell className="text-sm py-2 text-right">{l.ordered || '—'}</TableCell>
                    <TableCell className="text-sm py-2 text-right font-semibold">{l.qty_received}</TableCell>
                    <TableCell className={`text-sm py-2 text-right ${l.balance < 0 ? 'text-blue-600 font-semibold' : l.balance > 0 ? 'text-amber-600' : ''}`}>{l.balance !== undefined ? l.balance : '—'}</TableCell>
                    <TableCell className="py-2">{qtyComparisonBadge(l.qtyStatus)}</TableCell>
                    <TableCell className="text-sm py-2">{l.uom || '—'}</TableCell>
                    <TableCell className="text-sm py-2 font-mono text-xs">{l.lot_number || '—'}</TableCell>
                    <TableCell className="text-sm py-2 font-mono text-xs">{l.batch_number || '—'}</TableCell>
                    <TableCell className="text-sm py-2 text-muted-foreground max-w-[150px] truncate" title={l.remarks}>{l.remarks || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
