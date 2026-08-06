import { useState, useMemo, Fragment } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Search, FileDown, Truck, Pencil, Trash2, Loader2, Printer, Package, CheckSquare, X } from 'lucide-react';
import DataTablePagination from '@/components/DataTablePagination';
import { usePagination } from '@/hooks/use-pagination';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExplainerTip } from '@/components/ExplainerTip';
import { printDetailPage } from '@/lib/pdf-export';

export default function DispatchPage() {
  const { profile } = useAuth();
  const { data: appData, currentFactoryId, setCurrentFactoryId } = useData();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [factoryFilter, setFactoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatch_records', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('dispatch_records').select('*, buyers(name)').eq('company_id', companyId).order('dispatch_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingId) {
        const { id, company_id, created_at, updated_at, buyers, ...updates } = payload;
        const { error } = await supabase.from('dispatch_records').update({
          ...updates,
          order_id: updates.order_id || null,
          buyer_id: updates.buyer_id || null,
        }).eq('id', editingId);
        if (error) throw error;
      } else {
        const cleaned = {
          ...payload,
          company_id: companyId,
          order_id: payload.order_id || null,
          buyer_id: payload.buyer_id || null,
        };
        const { error } = await supabase.from('dispatch_records').insert(cleaned);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispatch_records'] });
      toast.success(editingId ? 'Dispatch updated' : 'Dispatch recorded');
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dispatch_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispatch_records'] });
      toast.success('Dispatch deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const buyers = appData.buyers.filter((b: any) => b.active);
  const allOrders = [...appData.printingOrders, ...appData.stitchingOrders];

  // Compute total chart qty per order from colourways
  const orderChartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    const allColourways = [...appData.printingColourways, ...appData.stitchingColourways];
    for (const c of allColourways as any[]) {
      const oid = c.orderId || c.orderRowId;
      if (oid) map[oid] = (map[oid] || 0) + (c.chartQty || c.orderedQty || 0);
    }
    return map;
  }, [appData.printingColourways, appData.stitchingColourways]);

  // Compute total already-dispatched qty per order from existing dispatch records
  const orderDispatchedMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dispatches as any[]) {
      if (d.order_id) map[d.order_id] = (map[d.order_id] || 0) + (d.qty || 0);
    }
    return map;
  }, [dispatches]);

  // Available balance for currently-selected order (adds back current record's qty when editing)
  const selectedOrderBalance = useMemo(() => {
    if (!form.order_id || form.dispatch_type !== 'order') return null;
    const chartQty = orderChartQtyMap[form.order_id] ?? 0;
    const dispatched = orderDispatchedMap[form.order_id] ?? 0;
    const editingRecord = editingId ? (dispatches as any[]).find((d: any) => d.id === editingId) : null;
    const editingQty = editingRecord?.order_id === form.order_id ? (editingRecord?.qty || 0) : 0;
    return chartQty - dispatched + editingQty;
  }, [form.order_id, form.dispatch_type, orderChartQtyMap, orderDispatchedMap, editingId, dispatches]);

  const handleAdd = () => {
    setEditingId(null);
    setForm({ dispatch_date: new Date().toISOString().slice(0, 10), dispatch_type: 'order', order_id: '', buyer_id: '', product_name: '', colour: '', size: '', qty: '', uom: 'pcs', vehicle_number: '', challan_number: '', remarks: '' });
    setDialogOpen(true);
  };

  const handleEdit = (d: any) => {
    setEditingId(d.id);
    setForm({ ...d, order_id: d.order_id || '', buyer_id: d.buyer_id || '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const qty = Number(form.qty);
    if (!qty || qty <= 0) { toast.error('Quantity must be greater than 0'); return; }
    if (!Number.isInteger(qty)) { toast.error('Quantity must be a whole number'); return; }
    if (!form.dispatch_date) { toast.error('Date is required'); return; }
    if (form.dispatch_type === 'order' && selectedOrderBalance !== null && qty > selectedOrderBalance) {
      toast.error(`Quantity exceeds available balance (${selectedOrderBalance.toLocaleString()} pcs)`);
      return;
    }
    saveMutation.mutate({ ...form, qty });
  };

  const exportCSV = () => {
    const header = 'Date,Buyer,Type,Product,Colour,Qty,UOM,Vehicle,Challan\n';
    const rows = dispatches.map((d: any) => `${d.dispatch_date},${(d as any).buyers?.name || ''},${d.dispatch_type},${d.product_name || ''},${d.colour || ''},${d.qty},${d.uom},${d.vehicle_number || ''},${d.challan_number || ''}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dispatches.csv'; a.click();
  };

  const handlePrintChallan = async (d: any) => {
    // Open the window synchronously, inside the click handler, before any await — once we
    // cross an await boundary the browser no longer treats window.open as user-gesture-
    // triggered and popup blockers silently block it.
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow pop-ups to print'); return; }
    printWindow.document.write('<p style="font-family:sans-serif;padding:20px;color:#666">Preparing challan…</p>');

    const company = appData.companies?.[0];
    const buyer = appData.buyers.find((b: any) => b.id === d.buyer_id);
    const order = d.order_id
      ? [...appData.printingOrders, ...appData.stitchingOrders].find((o: any) => o.id === d.order_id)
      : null;

    // dispatch_records has no rate/value column — look up the matching order_row's
    // rate_per_item on demand (only when printing) rather than loading it for every row.
    let rate: number | null = null;
    if (d.order_id) {
      const { data: rows } = await supabase.from('order_rows').select('*').eq('order_id', d.order_id);
      const isPrinting = !!order && appData.printingOrders.some((o: any) => o.id === order.id);
      const match = (rows || []).find((r: any) => {
        const product = isPrinting
          ? appData.printingProducts.find((p: any) => p.id === r.product_id)
          : appData.stitchingProducts.find((p: any) => p.id === r.product_id);
        return product?.name === d.product_name;
      })
        // Fall back to the order's only row when product_id is unset (common in this data
        // set) and there's nothing ambiguous to pick between — never guess among several.
        || ((rows || []).length === 1 ? rows[0] : undefined);
      rate = match ? Number(match.rate_per_item) || 0 : null;
    }
    const value = rate !== null ? rate * Number(d.qty || 0) : null;
    const currency = order?.currency || '';

    // All of the above can contain free-text database values (addresses, remarks, names) —
    // escape before interpolating into the print window's HTML to avoid stored XSS.
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Delivery Challan - ${esc(d.challan_number || d.id.slice(0, 8))}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 18mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a2e; font-size: 11px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px double #1a1a2e; }
  .company-info { max-width: 50%; }
  .company-info h1 { font-size: 20px; margin: 0 0 4px; color: #1a1a2e; }
  .company-info .legal { font-size: 10px; color: #666; }
  .company-info .detail { font-size: 10px; color: #444; margin-top: 4px; }
  .doc-title { text-align: right; }
  .doc-title h2 { font-size: 22px; margin: 0; color: #1a1a2e; letter-spacing: 2px; text-transform: uppercase; }
  .doc-title .doc-number { font-size: 14px; font-weight: bold; color: #d4a017; margin-top: 2px; }
  .doc-title .date { font-size: 9px; color: #888; margin-top: 4px; }
  .addresses { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 20px; }
  .address-box { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; background: #fafafa; }
  .address-box h3 { font-size: 10px; margin: 0 0 6px; text-transform: uppercase; color: #666; letter-spacing: 1px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .address-box p { margin: 2px 0; font-size: 10px; color: #333; }
  .info-row { display: flex; flex-wrap: wrap; margin-bottom: 12px; gap: 20px; }
  .info-item { font-size: 10px; color: #555; }
  .info-item strong { color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1a1a2e; color: white; padding: 7px 8px; font-size: 10px; text-align: left; font-weight: 600; }
  th.right { text-align: right; }
  th.center { text-align: center; }
  td { padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; }
  td.right { text-align: right; }
  td.center { text-align: center; }
  .total-row td { font-weight: bold; background: #f0f0f0; border-top: 2px solid #1a1a2e; font-size: 11px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; }
  .signature-box { text-align: center; width: 40%; }
  .signature-box .line { border-top: 1px solid #333; padding-top: 4px; margin-top: 36px; font-size: 10px; color: #555; }
  .footer { margin-top: 24px; font-size: 8px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 2px; font-size: 9px; border: 1px solid #ddd; background: #f5f5f5; }
</style></head><body>
  <div class="header">
    <div class="company-info">
      <h1>${esc(company?.legal_name || company?.name || 'Your Company')}</h1>
      <div class="legal">${company?.legal_name && company?.name ? `Trading as ${esc(company.name)}` : ''}</div>
      ${company?.address ? `<div class="detail">${esc(company.address)}</div>` : ''}
    </div>
    <div class="doc-title">
      <h2>Delivery Challan</h2>
      <div class="doc-number">${esc(d.challan_number) || '—'}</div>
      <div class="date">Printed: ${today}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-box">
      <h3>Consignee</h3>
      <p><strong>${esc(buyer?.name || (d as any).buyers?.name) || '—'}</strong></p>
      ${buyer?.address ? `<p>${esc(buyer.address)}</p>` : ''}
      ${buyer?.contact_person ? `<p>Attn: ${esc(buyer.contact_person)}</p>` : ''}
      ${buyer?.phone ? `<p>Phone: ${esc(buyer.phone)}</p>` : ''}
    </div>
    <div class="address-box">
      <h3>Dispatched From</h3>
      <p><strong>${esc(company?.legal_name || company?.name || 'Your Company')}</strong></p>
      ${company?.address ? `<p>${esc(company.address)}</p>` : ''}
    </div>
  </div>

  <div class="info-row">
    <div class="info-item"><strong>Dispatch Date:</strong> ${esc(d.dispatch_date) || '—'}</div>
    <div class="info-item"><strong>Order Ref:</strong> ${esc(order?.internalPO) || '—'}${order?.style ? ` (${esc(order.style)})` : ''}</div>
    <div class="info-item"><strong>Vehicle No:</strong> ${esc(d.vehicle_number) || '—'}</div>
    <div class="info-item"><strong>Type:</strong> <span class="badge">${esc(d.dispatch_type || 'order')}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:40px">#</th>
        <th>Product</th>
        <th>Colour</th>
        <th>Size</th>
        <th class="center" style="width:70px">UOM</th>
        <th class="right" style="width:70px">Qty</th>
        <th class="right" style="width:90px">Rate</th>
        <th class="right" style="width:100px">Value</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="center">1</td>
        <td>${esc(d.product_name) || '—'}</td>
        <td>${esc(d.colour) || '—'}</td>
        <td>${esc(d.size) || '—'}</td>
        <td class="center">${esc(d.uom) || '—'}</td>
        <td class="right">${esc(d.qty)}</td>
        <td class="right">${rate !== null ? `${esc(currency)} ${rate.toFixed(2)}` : '—'}</td>
        <td class="right">${value !== null ? `${esc(currency)} ${value.toFixed(2)}` : '—'}</td>
      </tr>
      <tr class="total-row">
        <td colspan="7" style="text-align:right;padding:8px">Total${value !== null ? ` (${esc(currency)})` : ''}</td>
        <td class="right" style="padding:8px">${value !== null ? value.toFixed(2) : esc(d.qty)}</td>
      </tr>
    </tbody>
  </table>

  ${d.remarks ? `<div class="info-row"><div class="info-item"><strong>Remarks:</strong> ${esc(d.remarks)}</div></div>` : ''}

  <div class="signatures">
    <div class="signature-box">
      <div class="line">Dispatched By</div>
    </div>
    <div class="signature-box">
      <div class="line">Received By</div>
    </div>
  </div>

  <div class="footer">
    ${esc(company?.name)} · Delivery Challan ${esc(d.challan_number)} · Generated by fabriOS
  </div>

  <script>window.onload=function(){window.print();}</script>
</body></html>`);
    printWindow.document.close();
  };

  const factoryOrderIds = useMemo(() => {
    if (!currentFactoryId) return null;
    const factoryResources = [...appData.printingTables, ...appData.stitchingLines].filter((r: any) => r.factoryId === currentFactoryId).map((r: any) => r.id);
    const factoryEntryOrderIds = new Set(appData.entries.filter((e: any) => factoryResources.includes(e.resourceId)).map((e: any) => e.orderId));
    return factoryEntryOrderIds;
  }, [currentFactoryId, appData.entries, appData.printingTables, appData.stitchingLines]);

  const factoryOptions = useMemo(() => {
    return appData.factories.filter((f: any) => f.active !== false);
  }, [appData.factories]);

  const filtered = useMemo(() => {
    return dispatches.filter((d: any) => {
      if (factoryFilter !== 'all' && d.order_id && factoryOrderIds && !factoryOrderIds.has(d.order_id)) return false;
      if (buyerFilter !== 'all' && d.buyer_id !== buyerFilter) return false;
      if (dateFrom && d.dispatch_date && d.dispatch_date < dateFrom) return false;
      if (dateTo && d.dispatch_date && d.dispatch_date > dateTo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!d.product_name?.toLowerCase().includes(s) && !(d as any).buyers?.name?.toLowerCase().includes(s) && !d.challan_number?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [dispatches, search, buyerFilter, factoryFilter, factoryOrderIds, dateFrom, dateTo]);

  const pagination = usePagination(filtered, 50);

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { label: string; items: typeof filtered; qty: number }> = {};
    for (const d of pagination.pageItems) {
      const month = d.dispatch_date ? d.dispatch_date.slice(0, 7) : '__no_date__';
      if (!groups[month]) groups[month] = { label: month === '__no_date__' ? 'No Date' : month, items: [], qty: 0 };
      groups[month].items.push(d);
      groups[month].qty += d.qty || 0;
    }
    return groups;
  }, [pagination.pageItems]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === pagination.pageItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pagination.pageItems.map((d: any) => d.id)));
  };
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} dispatch record(s)?`)) return;
    try {
      for (const id of selectedIds) {
        const { error } = await supabase.from('dispatch_records').delete().eq('id', id);
        if (error) { toast.error(`Delete failed: ${error.message}`); return; }
      }
      qc.invalidateQueries({ queryKey: ['dispatch_records'] });
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} record(s) deleted`);
    } catch (err: any) { toast.error(`Delete failed: ${err.message}`); }
  };

  const printFiltered = () => {
    printDetailPage(`Dispatches (${filtered.length})`, [
      { label: 'Total Dispatches', value: String(filtered.length) },
      { label: 'Total Qty', value: String(filtered.reduce((s, d: any) => s + (d.qty || 0), 0)) },
    ], [
      {
        title: 'Dispatch Records',
        headers: ['Date', 'Buyer', 'Product', 'Colour', 'Qty', 'Challan'],
        rows: filtered.map((d: any) => [d.dispatch_date, (d as any).buyers?.name || '—', d.product_name || '—', d.colour || '—', String(d.qty || 0), d.challan_number || '—']),
      },
    ]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">Dispatch & Shipping <ExplainerTip text="Record shipments against customer orders. The system tracks available balance per order and prevents over-dispatch. Manage challan numbers, vehicle details, and product/colour info." /></h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><FileDown className="h-3.5 w-3.5 mr-1" /> Export</Button>
          <Button size="sm" onClick={handleAdd}><Truck className="h-3.5 w-3.5 mr-1" /> New Dispatch</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search dispatches..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        {factoryOptions.length > 1 && (
          <Select value={factoryFilter} onValueChange={setFactoryFilter}>
            <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Factory" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Factories</SelectItem>
              {factoryOptions.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={buyerFilter} onValueChange={setBuyerFilter}>
          <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue placeholder="Buyer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buyers</SelectItem>
            {buyers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name || b.code}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[130px] text-xs" placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[130px] text-xs" placeholder="To" />
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={printFiltered} title="Print filtered"><Printer className="h-3.5 w-3.5" /></Button>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} dispatch{filtered.length !== 1 ? 'es' : ''}</span>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-primary/5 rounded-md border">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleBulkDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 ml-auto" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-xs h-8 w-8">
              <input type="checkbox" className="accent-primary" checked={selectedIds.size === pagination.pageItems.length && pagination.pageItems.length > 0}
                onChange={toggleSelectAll} />
            </TableHead>
            <TableHead className="text-xs h-8">Date</TableHead>
            <TableHead className="text-xs h-8">Buyer</TableHead>
            <TableHead className="text-xs h-8">Type</TableHead>
            <TableHead className="text-xs h-8">Product</TableHead>
            <TableHead className="text-xs h-8">Colour</TableHead>
            <TableHead className="text-xs h-8 text-right">Qty</TableHead>
            <TableHead className="text-xs h-8">Challan</TableHead>
            <TableHead className="text-xs h-8 w-20"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <Package className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No dispatches recorded</p>
                  <p className="text-xs text-muted-foreground/60 max-w-xs">Record shipments against customer orders or from stock. Click "New Dispatch" to get started.</p>
                </div>
              </TableCell></TableRow>
            ) : Object.entries(monthlyGroups).map(([monthKey, group]) => (
              <Fragment key={monthKey}>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={9} className="text-[11px] font-semibold py-1.5 px-3">
                    {monthKey === '__no_date__' ? 'No Date' : new Date(monthKey + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    <span className="text-muted-foreground font-normal ml-2">({group.items.length} records, {group.qty} qty)</span>
                  </TableCell>
                </TableRow>
                {group.items.map((d: any) => (
                  <TableRow key={d.id} className={selectedIds.has(d.id) ? 'bg-primary/5' : ''}>
                    <TableCell className="py-2 px-2">
                      <input type="checkbox" className="accent-primary" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} />
                    </TableCell>
                    <TableCell className="text-sm py-2">{d.dispatch_date}</TableCell>
                    <TableCell className="text-sm py-2">{(d as any).buyers?.name || '-'}</TableCell>
                    <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{d.dispatch_type}</Badge></TableCell>
                    <TableCell className="text-sm py-2">{d.product_name || '-'}</TableCell>
                    <TableCell className="text-sm py-2">{d.colour || '-'}</TableCell>
                    <TableCell className="text-sm py-2 text-right font-medium">{d.qty} {d.uom}</TableCell>
                    <TableCell className="text-sm py-2">{d.challan_number || '-'}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Print Challan" onClick={() => handlePrintChallan(d)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(d)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(d.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <DataTablePagination {...pagination} />

      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'New'} Dispatch</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date *</Label><Input type="date" value={form.dispatch_date || ''} onChange={e => setForm({ ...form, dispatch_date: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.dispatch_type || 'order'} onValueChange={v => setForm({ ...form, dispatch_type: v, order_id: '' })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order">Against Order</SelectItem>
                    <SelectItem value="stock">From Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.dispatch_type === 'order' && (
              <div>
                <Label className="text-xs">Order (Internal PO)</Label>
                <Select value={form.order_id || ''} onValueChange={v => setForm({ ...form, order_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select order" /></SelectTrigger>
                  <SelectContent>
                    {allOrders.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.internalPO || o.id.slice(0, 8)} — {o.style || ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.order_id && selectedOrderBalance !== null && (
                  <p className={`mt-1 text-xs flex items-center gap-1 ${selectedOrderBalance <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {selectedOrderBalance <= 0 && <AlertCircle className="h-3 w-3" />}
                    Available balance: <span className="font-medium">{selectedOrderBalance.toLocaleString()} pcs</span>
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Buyer</Label>
              <Select value={form.buyer_id || ''} onValueChange={v => setForm({ ...form, buyer_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select buyer" /></SelectTrigger>
                <SelectContent>
                  {buyers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name || b.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Product</Label><Input value={form.product_name || ''} onChange={e => setForm({ ...form, product_name: e.target.value })} /></div>
              <div><Label className="text-xs">Colour</Label><Input value={form.colour || ''} onChange={e => setForm({ ...form, colour: e.target.value })} /></div>
              <div><Label className="text-xs">Size</Label><Input value={form.size || ''} onChange={e => setForm({ ...form, size: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Qty *</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.qty ?? ''}
                  onChange={e => setForm({ ...form, qty: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div><Label className="text-xs">UOM</Label><Input value={form.uom || 'pcs'} onChange={e => setForm({ ...form, uom: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Vehicle #</Label><Input value={form.vehicle_number || ''} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} /></div>
              <div><Label className="text-xs">Challan #</Label><Input value={form.challan_number || ''} onChange={e => setForm({ ...form, challan_number: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
