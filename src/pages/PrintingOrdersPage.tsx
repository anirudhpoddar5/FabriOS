import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, generateId } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OrderStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Search, Trash2, AlertTriangle, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOrderBadge } from '@/lib/order-status';

const statusColors: Record<OrderStatus, string> = {
  Started: 'status-started',
  Completed: 'status-completed',
  Cancelled: 'status-cancelled',
  Shipped: 'status-shipped',
};

function DatePickerField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const date = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {date ? format(date, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')} initialFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function makeRow(id?: string) {
  return {
    id: id || generateId(),
    printingProductId: '', fabricId: '', fabricWidth: '', uom: 'meters',
    orderQty: 0, chartQty: 0, noOfColours: 0, ratePerItem: 0,
    colours: [{ id: generateId(), colourName: '', orderedQty: 0, uom: 'meters', notes: '' }],
  };
}

export default function PrintingOrdersPage() {
  const { data, refreshData } = useData();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [rows, setRows] = useState<any[]>([]);

  const orders = data.printingOrders;
  const buyers = data.buyers.filter(b => b.active);
  const fabrics = data.fabrics.filter(f => f.active);
  const printProds = data.printingProducts.filter(p => p.active);

  const getBuyer = (id: string) => { const b = data.buyers.find(x => x.id === id); return b ? `${b.code}${b.name ? ' - ' + b.name : ''}` : id; };
  const getFabric = (id: string) => data.fabrics.find(f => f.id === id)?.name || id;
  const getProduct = (id: string) => data.printingProducts.find(p => p.id === id)?.name || id;

  const entryCountMap = useMemo(() => {
    const map = new Map<string, number>();
    data.entries.forEach(e => map.set(e.orderId, (map.get(e.orderId) || 0) + 1));
    return map;
  }, [data.entries]);

  const getProgress = (orderId: string) => {
    const cws = data.printingColourways.filter(c => c.orderId === orderId);
    const totalOrdered = cws.reduce((s, c) => s + c.orderedQty, 0);
    const totalProduced = data.entries.filter(e => e.orderId === orderId).reduce((s, e) => s + e.outputQty, 0);
    return { totalOrdered, totalProduced, pct: totalOrdered > 0 ? (totalProduced / totalOrdered) * 100 : 0 };
  };

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (buyerFilter !== 'all' && o.buyerId !== buyerFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (![(o.internalPO ?? ''), o.style, o.buyerPO, getBuyer(o.buyerId)].some(v => v?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, buyerFilter]);

  const nextPO = () => {
    const nums = orders.map(o => { const m = (o.internalPO ?? '').match(/PO-P-(\d+)/); return m ? parseInt(m[1]) : 0; });
    return `PO-P-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`;
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm({ buyerId: '', style: '', internalPO: nextPO(), buyerPO: '', currency: 'USD', targetEndDate: '', buyerDeliveryDate: '', remarks: '', status: 'Started' as OrderStatus });
    setRows([makeRow()]);
    setDialogOpen(true);
  };

  const handleEdit = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setEditingId(order.id);
    setForm({ ...order });

    const { data: orderRows } = await supabase.from('order_rows').select('*').eq('order_id', order.id).order('sort_order');
    const loadedRows = (orderRows || []).map((r: any) => ({
      id: r.id,
      printingProductId: r.product_id || '',
      fabricId: r.fabric_id || '',
      fabricWidth: r.fabric_width || '',
      uom: r.uom || 'meters',
      orderQty: r.order_qty || 0,
      chartQty: r.chart_qty || 0,
      noOfColours: r.no_of_colours || 0,
      ratePerItem: r.rate_per_item || 0,
    }));

    for (const row of loadedRows) {
      const { data: cws } = await supabase.from('order_colourways').select('*').eq('order_row_id', row.id).order('sort_order');
      row.colours = (cws || []).map((c: any) => ({
        id: c.id,
        colourName: c.colour_name,
        orderedQty: c.ordered_qty,
        uom: c.uom || row.uom,
        notes: c.notes || '',
      }));
      if (row.colours.length === 0) row.colours = [{ id: generateId(), colourName: '', orderedQty: 0, uom: row.uom, notes: '' }];
    }

    setRows(loadedRows.length > 0 ? loadedRows : [makeRow()]);
    setDialogOpen(true);
  };

  const addRow = () => setRows(prev => [...prev, makeRow()]);
  const removeRow = (id: string) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  const updateRow = (id: string, field: string, value: any) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const addRowColour = (rowId: string) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, colours: [...r.colours, { id: generateId(), colourName: '', orderedQty: 0, uom: r.uom || 'meters', notes: '' }] } : r));
  const removeRowColour = (rowId: string, cId: string) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, colours: r.colours.length > 1 ? r.colours.filter((c: any) => c.id !== cId) : r.colours } : r));
  const updateRowColour = (rowId: string, cId: string, field: string, value: any) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, colours: r.colours.map((c: any) => c.id === cId ? { ...c, [field]: value } : c) } : r));

  const handleSave = async () => {
    if (!form.buyerId) { toast.error('Buyer is required'); return; }
    if (!form.style) { toast.error('Style is required'); return; }
    if (rows.length === 0 || rows.every((r: any) => !r.fabricId)) { toast.error('At least one product row with fabric is required'); return; }

    setSaving(true);
    try {
      if (editingId) {
        const { error: hErr } = await supabase.from('order_headers').update({
          buyer_id: form.buyerId,
          buyer_po: form.buyerPO || null,
          style: form.style,
          currency: form.currency,
          target_end_date: form.targetEndDate || null,
          buyer_delivery_date: form.buyerDeliveryDate || null,
          status: form.status,
          remarks: form.remarks || null,
        }).eq('id', editingId);
        if (hErr) { toast.error(`Failed: ${hErr.message}`); return; }

        const { data: oldRows } = await supabase.from('order_rows').select('id').eq('order_id', editingId);
        for (const old of oldRows || []) {
          await supabase.from('order_colourways').delete().eq('order_row_id', old.id);
        }
        await supabase.from('order_rows').delete().eq('order_id', editingId);

        for (let ri = 0; ri < rows.length; ri++) {
          const r = rows[ri];
          const rowId = generateId();
          const { error: rrErr } = await supabase.from('order_rows').insert({
            id: rowId, order_id: editingId,
            product_id: r.printingProductId || null,
            fabric_id: r.fabricId || null,
            fabric_width: r.fabricWidth || null,
            uom: r.uom,
            order_qty: Number(r.orderQty) || 0,
            chart_qty: Number(r.chartQty) || 0,
            rate_per_item: Number(r.ratePerItem) || 0,
            no_of_colours: Number(r.noOfColours) || 0,
            sort_order: ri,
          });
          if (rrErr) { toast.error(`Failed: ${rrErr.message}`); return; }

          const validCws = (r.colours || []).filter((c: any) => c.colourName);
          for (let ci = 0; ci < validCws.length; ci++) {
            const c = validCws[ci];
            const { error: ccErr } = await supabase.from('order_colourways').insert({
              id: c.id || generateId(),
              order_row_id: rowId,
              colour_name: c.colourName,
              ordered_qty: Number(c.orderedQty) || 0,
              uom: c.uom || r.uom,
              notes: c.notes || null,
              sort_order: ci,
            });
            if (ccErr) { toast.error(`Failed: ${ccErr.message}`); return; }
          }
        }
        toast.success('Order updated');
      } else {
        if (!companyId) { toast.error('No company found'); return; }
        const orderId = generateId();

        const { error: hErr } = await supabase.from('order_headers').insert({
          id: orderId, company_id: companyId, module: 'printing',
          internal_po: form.internalPO,
          buyer_id: form.buyerId,
          buyer_po: form.buyerPO || null,
          style: form.style, currency: form.currency,
          target_end_date: form.targetEndDate || null,
          buyer_delivery_date: form.buyerDeliveryDate || null,
          status: form.status || 'Started',
          remarks: form.remarks || null,
        });
        if (hErr) { toast.error(`Failed: ${hErr.message}`); return; }

        for (let ri = 0; ri < rows.length; ri++) {
          const r = rows[ri];
          const orderRowId = generateId();
          const { error: rrErr } = await supabase.from('order_rows').insert({
            id: orderRowId, order_id: orderId,
            product_id: r.printingProductId || null,
            fabric_id: r.fabricId || null,
            fabric_width: r.fabricWidth || null,
            uom: r.uom,
            order_qty: Number(r.orderQty) || 0,
            chart_qty: Number(r.chartQty) || 0,
            rate_per_item: Number(r.ratePerItem) || 0,
            no_of_colours: Number(r.noOfColours) || 0,
            sort_order: ri,
          });
          if (rrErr) { toast.error(`Failed: ${rrErr.message}`); return; }

          const validCws = (r.colours || []).filter((c: any) => c.colourName);
          for (let ci = 0; ci < validCws.length; ci++) {
            const c = validCws[ci];
            const { error: ccErr } = await supabase.from('order_colourways').insert({
              id: c.id || generateId(),
              order_row_id: orderRowId,
              colour_name: c.colourName,
              ordered_qty: Number(c.orderedQty) || 0,
              uom: c.uom || r.uom,
              notes: c.notes || null,
              sort_order: ci,
            });
            if (ccErr) { toast.error(`Failed: ${ccErr.message}`); return; }
          }
        }
        toast.success('Order created');
      }

      await refreshData();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">Printing Orders</h1>
        <Button size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> New Order</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Started">Started</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
            <SelectItem value="Shipped">Shipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={buyerFilter} onValueChange={setBuyerFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Buyer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buyers</SelectItem>
            {buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'order' : 'orders'}</span>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs h-9">Internal PO</TableHead>
              <TableHead className="text-xs h-9">Buyer</TableHead>
              <TableHead className="text-xs h-9">Style</TableHead>
              <TableHead className="text-xs h-9">Product</TableHead>
              <TableHead className="text-xs h-9">Fabric</TableHead>
              <TableHead className="text-xs h-9">Qty</TableHead>
              <TableHead className="text-xs h-9 min-w-[100px]">Progress</TableHead>
              <TableHead className="text-xs h-9">Status</TableHead>
              <TableHead className="text-xs h-9 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No orders found</TableCell></TableRow>
            ) : filtered.map(o => {
              const prog = getProgress(o.id);
              return (
                <TableRow key={o.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/printing-orders/${o.id}`)}>
                  <TableCell className="text-sm py-2 font-mono">{o.internalPO ?? '—'}</TableCell>
                  <TableCell className="text-sm py-2">{getBuyer(o.buyerId)}</TableCell>
                  <TableCell className="text-sm py-2">{o.style}</TableCell>
                  <TableCell className="text-sm py-2">{getProduct(o.printingProductId)}</TableCell>
                  <TableCell className="text-sm py-2">{getFabric(o.fabricId)}</TableCell>
                  <TableCell className="text-sm py-2">{o.orderQty} {o.uom}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(prog.pct, 100)} className="h-2 flex-1" />
                      <span className={`text-[10px] font-medium ${prog.pct >= 100 ? 'text-success' : prog.pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{prog.pct.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-[10px] ${getOrderBadge(o.status, entryCountMap.get(o.id) || 0, o.targetEndDate).className}`}>
                      {getOrderBadge(o.status, entryCountMap.get(o.id) || 0, o.targetEndDate).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleEdit(e, o)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'New'} Printing Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Internal PO</Label><Input value={form.internalPO ?? ''} readOnly className="bg-muted" /></div>
              <div className="space-y-1"><Label className="text-xs">Buyer PO</Label><Input value={form.buyerPO || ''} onChange={e => setForm((p: any) => ({ ...p, buyerPO: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Buyer *</Label>
                <Select value={form.buyerId || ''} onValueChange={v => setForm((p: any) => ({ ...p, buyerId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                  <SelectContent>{buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.code}{b.name ? ` - ${b.name}` : ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Style *</Label><Input value={form.style || ''} onChange={e => setForm((p: any) => ({ ...p, style: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DatePickerField label="Target End Date" value={form.targetEndDate || ''} onChange={v => setForm((p: any) => ({ ...p, targetEndDate: v }))} />
              <DatePickerField label="Buyer Delivery Date" value={form.buyerDeliveryDate || ''} onChange={v => setForm((p: any) => ({ ...p, buyerDeliveryDate: v }))} />
              <div className="space-y-1"><Label className="text-xs">Status</Label>
                <Select value={form.status || 'Started'} onValueChange={v => setForm((p: any) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Started">Started</SelectItem><SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem><SelectItem value="Shipped">Shipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Currency</Label>
              <Select value={form.currency || 'USD'} onValueChange={v => setForm((p: any) => ({ ...p, currency: v }))}>
                <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="INR">INR</SelectItem><SelectItem value="AUD">AUD</SelectItem><SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="CNY">CNY</SelectItem><SelectItem value="PKR">PKR</SelectItem><SelectItem value="BDT">BDT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm((p: any) => ({ ...p, remarks: e.target.value }))} /></div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Product Rows</h3>
                <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add Product Row</Button>
              </div>

              <div className="space-y-4">
                {rows.map((row, ri) => {
                  const rowTotalCwQty = (row.colours || []).reduce((s: number, c: any) => s + (Number(c.orderedQty) || 0), 0);
                  const rowQtyMismatch = row.orderQty > 0 && rowTotalCwQty !== Number(row.orderQty);
                  return (
                    <Card key={row.id} className="border-l-2 border-l-primary/30">
                      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                          <GripVertical className="h-3.5 w-3.5" />
                          Row {ri + 1}
                        </CardTitle>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(row.id)} disabled={rows.length <= 1}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Product</Label>
                            <Select value={row.printingProductId || ''} onValueChange={v => updateRow(row.id, 'printingProductId', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select product" /></SelectTrigger>
                              <SelectContent>{printProds.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Fabric *</Label>
                            <Select value={row.fabricId || ''} onValueChange={v => updateRow(row.id, 'fabricId', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select fabric" /></SelectTrigger>
                              <SelectContent>{fabrics.map(f => <SelectItem key={f.id} value={f.id}>{f.shortForm} - {f.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1"><Label className="text-[10px]">Width</Label><Input className="h-8 text-xs" value={row.fabricWidth || ''} onChange={e => updateRow(row.id, 'fabricWidth', e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-[10px]">UOM</Label><Input className="h-8 text-xs" value={row.uom || ''} onChange={e => updateRow(row.id, 'uom', e.target.value)} /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="space-y-1"><Label className="text-[10px]">Order Qty</Label><Input className="h-8 text-xs" type="number" value={row.orderQty || ''} onChange={e => updateRow(row.id, 'orderQty', parseFloat(e.target.value) || 0)} /></div>
                          <div className="space-y-1"><Label className="text-[10px]">Chart Qty</Label><Input className="h-8 text-xs" type="number" value={row.chartQty || ''} onChange={e => updateRow(row.id, 'chartQty', parseFloat(e.target.value) || 0)} /></div>
                          <div className="space-y-1"><Label className="text-[10px]">Rate/Item</Label><Input className="h-8 text-xs" type="number" step="0.01" value={row.ratePerItem || ''} onChange={e => updateRow(row.id, 'ratePerItem', parseFloat(e.target.value) || 0)} /></div>
                          <div className="space-y-1 flex items-end pb-1">
                            {row.orderQty > 0 && row.ratePerItem > 0 && (
                              <span className="text-xs font-medium text-muted-foreground">
                                Value: {form.currency} {(row.orderQty * row.ratePerItem).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] font-medium text-muted-foreground">Colourways</Label>
                              {rowQtyMismatch && <span className="flex items-center gap-1 text-[9px] text-warning"><AlertTriangle className="h-2.5 w-2.5" /> Qty mismatch ({rowTotalCwQty} vs {row.orderQty})</span>}
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => addRowColour(row.id)}><Plus className="h-3 w-3 mr-1" /> Add Colour</Button>
                          </div>
                          <div className="border rounded-md">
                            <Table>
                              <TableHeader><TableRow>
                                <TableHead className="text-[10px] h-6">Colour</TableHead>
                                <TableHead className="text-[10px] h-6">Qty</TableHead>
                                <TableHead className="text-[10px] h-6">UOM</TableHead>
                                <TableHead className="text-[10px] h-6">Notes</TableHead>
                                <TableHead className="text-[10px] h-6 w-6"></TableHead>
                              </TableRow></TableHeader>
                              <TableBody>
                                {(row.colours || []).map((c: any) => (
                                  <TableRow key={c.id}>
                                    <TableCell className="py-0.5"><Input className="h-6 text-[10px]" value={c.colourName} onChange={e => updateRowColour(row.id, c.id, 'colourName', e.target.value)} /></TableCell>
                                    <TableCell className="py-0.5"><Input className="h-6 text-[10px] w-16" type="number" value={c.orderedQty || ''} onChange={e => updateRowColour(row.id, c.id, 'orderedQty', parseFloat(e.target.value) || 0)} /></TableCell>
                                    <TableCell className="py-0.5"><Input className="h-6 text-[10px] w-16" value={c.uom} onChange={e => updateRowColour(row.id, c.id, 'uom', e.target.value)} /></TableCell>
                                    <TableCell className="py-0.5"><Input className="h-6 text-[10px]" value={c.notes || ''} onChange={e => updateRowColour(row.id, c.id, 'notes', e.target.value)} /></TableCell>
                                    <TableCell className="py-0.5">
                                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeRowColour(row.id, c.id)} disabled={(row.colours || []).length <= 1}>
                                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Order'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
