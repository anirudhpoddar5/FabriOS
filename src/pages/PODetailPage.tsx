import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Printer, Download, Building, Calendar, DollarSign, FileText, Hash, PackageCheck, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { printDetailPage } from '@/lib/pdf-export';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800',
  partial: 'bg-yellow-100 text-yellow-800',
  received: 'bg-green-100 text-green-800',
  closed: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const { data: po, isLoading: poLoading } = useQuery({
    queryKey: ['po_detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from('purchase_orders').select('*, vendors(name, code, address, phone, email)').eq('id', id).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ['po_lines', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from('purchase_order_lines').select('*').eq('po_id', id).order('created_at');
      return data || [];
    },
    enabled: !!id,
  });

  const { data: company } = useQuery({
    queryKey: ['company_detail', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase.from('companies').select('name, legal_name, address, email, phone').eq('id', companyId).single();
      return data;
    },
    enabled: !!companyId,
  });

  const { data: sourceBom } = useQuery({
    queryKey: ['po_source_bom', po?.order_id],
    queryFn: async () => {
      if (!po?.order_id) return null;
      const { data } = await supabase.from('bom_headers').select('id, title')
        .eq('order_id', po.order_id)
        .eq('company_id', companyId)
        .in('status', ['confirmed', 'po_generated'])
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!po?.order_id && !!companyId && po.source_type === 'bom',
  });

  const totalAmount = useMemo(() =>
    lines.reduce((s, l: any) => s + (l.amount || l.qty_ordered * (l.rate || 0)), 0),
  [lines]);

  if (poLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  if (!po) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Purchase Order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const handlePrint = () => {
    const vendor = (po as any).vendors;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow pop-ups to print'); return; }

    const lineRows = lines.map((l: any, i: number) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${i + 1}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px">${l.item_name}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${l.uom}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px;text-align:right">${l.qty_ordered}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px;text-align:right">${l.rate ? `${po.currency || ''} ${l.rate.toFixed(2)}` : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px;text-align:right">${(l.amount || l.qty_ordered * (l.rate || 0)).toFixed(2)}</td>
      </tr>`).join('');

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Purchase Order - ${po.po_number}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 18mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a2e; font-size: 11px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px double #1a1a2e; }
  .company-info { max-width: 50%; }
  .company-info h1 { font-size: 20px; margin: 0 0 4px; color: #1a1a2e; }
  .company-info .legal { font-size: 10px; color: #666; }
  .company-info .detail { font-size: 10px; color: #444; margin-top: 4px; }
  .po-title { text-align: right; }
  .po-title h2 { font-size: 22px; margin: 0; color: #1a1a2e; letter-spacing: 2px; text-transform: uppercase; }
  .po-title .po-number { font-size: 14px; font-weight: bold; color: #d4a017; margin-top: 2px; }
  .po-title .date { font-size: 9px; color: #888; margin-top: 4px; }
  .addresses { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 20px; }
  .address-box { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; background: #fafafa; }
  .address-box h3 { font-size: 10px; margin: 0 0 6px; text-transform: uppercase; color: #666; letter-spacing: 1px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .address-box p { margin: 2px 0; font-size: 10px; color: #333; }
  .info-row { display: flex; margin-bottom: 12px; gap: 20px; }
  .info-item { font-size: 10px; color: #555; }
  .info-item strong { color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1a1a2e; color: white; padding: 7px 8px; font-size: 10px; text-align: left; font-weight: 600; }
  th.right { text-align: right; }
  th.center { text-align: center; }
  td { padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; }
  td.right, td.amount { text-align: right; }
  td.center { text-align: center; }
  tr:nth-child(even) { background: #f9f9f9; }
  .total-row td { font-weight: bold; background: #f0f0f0; border-top: 2px solid #1a1a2e; font-size: 11px; }
  .terms { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 12px; }
  .terms h3 { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 1px; margin: 0 0 6px; }
  .terms p { font-size: 9px; color: #555; margin: 2px 0; }
  .signatures { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; }
  .signature-box { text-align: center; width: 40%; }
  .signature-box .line { border-top: 1px solid #333; padding-top: 4px; margin-top: 36px; font-size: 10px; color: #555; }
  .footer { margin-top: 24px; font-size: 8px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 2px; font-size: 9px; border: 1px solid #ddd; background: #f5f5f5; }
</style></head><body>
  <div class="header">
    <div class="company-info">
      <h1>${company?.legal_name || company?.name || 'Your Company'}</h1>
      <div class="legal">${company?.legal_name && company?.name ? `Trading as ${company.name}` : ''}</div>
      ${company?.address ? `<div class="detail">${company.address}</div>` : ''}
      ${company?.phone ? `<div class="detail">Tel: ${company.phone}</div>` : ''}
      ${company?.email ? `<div class="detail">Email: ${company.email}</div>` : ''}
    </div>
    <div class="po-title">
      <h2>Purchase Order</h2>
      <div class="po-number">${po.po_number}</div>
      <div class="date">Printed: ${today}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-box">
      <h3>Vendor</h3>
      <p><strong>${vendor?.name || '—'}</strong></p>
      ${vendor?.code ? `<p>Code: ${vendor.code}</p>` : ''}
      ${vendor?.address ? `<p>${vendor.address}</p>` : ''}
      ${vendor?.phone ? `<p>Phone: ${vendor.phone}</p>` : ''}
      ${vendor?.email ? `<p>Email: ${vendor.email}</p>` : ''}
    </div>
    <div class="address-box">
      <h3>Ship To</h3>
      <p><strong>${company?.legal_name || company?.name || 'Your Company'}</strong></p>
      ${company?.address ? `<p>${company.address}</p>` : ''}
      ${company?.phone ? `<p>Phone: ${company.phone}</p>` : ''}
    </div>
  </div>

  <div class="info-row">
    <div class="info-item"><strong>PO Date:</strong> ${po.po_date || '—'}</div>
    <div class="info-item"><strong>Status:</strong> <span class="badge">${po.status}</span></div>
    <div class="info-item"><strong>Currency:</strong> ${po.currency || 'USD'}</div>
    ${po.payment_status ? `<div class="info-item"><strong>Payment:</strong> ${po.payment_status}</div>` : ''}
    <div class="info-item"><strong>Delivery:</strong> To be confirmed</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:40px">#</th>
        <th>Item Description</th>
        <th class="center" style="width:60px">UOM</th>
        <th class="right" style="width:80px">Quantity</th>
        <th class="right" style="width:90px">Unit Price</th>
        <th class="right" style="width:100px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
      <tr class="total-row">
        <td colspan="5" style="text-align:right;padding:8px">Total Amount (${po.currency || 'USD'})</td>
        <td class="amount" style="padding:8px">${totalAmount.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${po.remarks ? `<div class="terms"><h3>Remarks</h3><p>${po.remarks}</p></div>` : ''}
  <div class="terms">
    <h3>Terms & Conditions</h3>
    <p>1. Delivery schedule as mutually agreed upon.</p>
    <p>2. Inspection and quality check at buyer's premises before acceptance.</p>
    <p>3. Any discrepancy must be reported within 7 days of delivery.</p>
    <p>4. This PO is subject to our standard terms and conditions of purchase.</p>
  </div>

  <div class="signatures">
    <div class="signature-box">
      <div class="line">Authorized Signatory</div>
    </div>
    <div class="signature-box">
      <div class="line">Vendor Acceptance</div>
    </div>
  </div>

  <div class="footer">
    ${company?.name || ''} · Purchase Order ${po.po_number} · Generated by fabriOS
  </div>

  <script>window.onload=function(){window.print();}</script>
</body></html>`);
    printWindow.document.close();
  };

  const handleDownload = () => {
    const header = 'Item,UOM,Qty Ordered,Rate,Amount\n';
    const rows = lines.map((l: any) => `${l.item_name},${l.uom},${l.qty_ordered},${l.rate || 0},${(l.amount || l.qty_ordered * (l.rate || 0)).toFixed(2)}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${po.po_number}.csv`; a.click();
  };

  const vendor = (po as any).vendors;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/purchase-orders')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-semibold">{po.po_number}</h1>
        <Badge className={`text-[10px] ${STATUS_COLORS[po.status] || ''}`}>{po.status}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => navigate(`/grn?po_id=${po.id}&vendor_id=${po.vendor_id}`)}>
            <PackageCheck className="h-3.5 w-3.5 mr-1" /> Receive Goods
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          <Button size="sm" variant="outline" onClick={handleDownload}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="bg-gradient-to-br from-primary/10 to-info/10 border-primary/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Hash className="h-3.5 w-3.5" /> PO Number</div>
            <div className="text-lg font-bold">{po.po_number}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/10 to-accent/10 border-success/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Building className="h-3.5 w-3.5" /> Vendor</div>
            <div className="text-lg font-bold truncate">{vendor?.name || '—'}</div>
            {vendor?.code && <div className="text-[10px] text-muted-foreground mt-1">{vendor.code}</div>}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-info/10 to-primary/10 border-info/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="h-3.5 w-3.5" /> PO Date</div>
            <div className="text-lg font-bold">{po.po_date || '—'}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-warning/10 to-accent/10 border-warning/10">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3.5 w-3.5" /> Total Amount</div>
            <div className="text-lg font-bold">{po.currency || 'USD'} {totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* PO Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Vendor Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{vendor?.name || '—'}</span></div>
            {vendor?.code && <div className="flex justify-between"><span className="text-muted-foreground">Code</span><span>{vendor.code}</span></div>}
            {vendor?.address && <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span>{vendor.address}</span></div>}
            {vendor?.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{vendor.phone}</span></div>}
            {vendor?.email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{vendor.email}</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">PO Information</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={`text-[10px] ${STATUS_COLORS[po.status] || ''}`}>{po.status}</Badge></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              {sourceBom ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/bom/${sourceBom.id}`)}>
                  <ExternalLink className="h-3 w-3 mr-1" /> BOM: {sourceBom.title || sourceBom.id.slice(0, 8)}
                </Button>
              ) : (
                <span className="capitalize">{po.source_type || 'manual'}</span>
              )}
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{po.currency || 'USD'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice #</span><span>{po.invoice_number || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span>{po.payment_status || '—'}</span></div>
            {po.remarks && <div className="flex justify-between"><span className="text-muted-foreground">Remarks</span><span>{po.remarks}</span></div>}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Line Items ({lines.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">#</TableHead>
                  <TableHead className="text-xs h-8">Item</TableHead>
                  <TableHead className="text-xs h-8">UOM</TableHead>
                  <TableHead className="text-xs h-8 text-right">Qty Ordered</TableHead>
                  <TableHead className="text-xs h-8 text-right">Qty Received</TableHead>
                  <TableHead className="text-xs h-8 text-right">Rate</TableHead>
                  <TableHead className="text-xs h-8 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No line items</TableCell></TableRow>
                ) : lines.map((l: any, i: number) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs py-2 text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-sm py-2 font-medium">{l.item_name}</TableCell>
                    <TableCell className="text-sm py-2">{l.uom}</TableCell>
                    <TableCell className="text-sm py-2 text-right">{l.qty_ordered}</TableCell>
                    <TableCell className="text-sm py-2 text-right">{l.qty_received || 0}</TableCell>
                    <TableCell className="text-sm py-2 text-right">{l.rate ? `${po.currency || 'USD'} ${l.rate.toFixed(2)}` : '—'}</TableCell>
                    <TableCell className="text-sm py-2 text-right font-mono">{(l.amount || l.qty_ordered * (l.rate || 0)).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {lines.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={6} className="text-xs py-2 text-right">Total</TableCell>
                    <TableCell className="text-xs py-2 text-right font-mono">{totalAmount.toFixed(2)}</TableCell>
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
