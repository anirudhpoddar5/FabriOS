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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Search, Trash2, AlertTriangle } from 'lucide-react';
import { ExplainerTip } from '@/components/ExplainerTip';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [colours, setColours] = useState<any[]>([]);

  const orders = data.printingOrders;
  const buyers = data.buyers.filter(b => b.active);
  const fabrics = data.fabrics.filter(f => f.active);

  const getBuyer = (id: string) => { const b = data.buyers.find(x => x.id === id); return b ? `${b.code}${b.name ? ' - ' + b.name : ''}` : id; };
  const getFabric = (id: string) => data.fabrics.find(f => f.id === id)?.name || id;

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
    setForm({ buyerId: '', printingProductId: '', style: '', internalPO: nextPO(), buyerPO: '', fabricId: '', fabricWidth: '', uom: 'meters', orderQty: 0, chartQty: 0, noOfColours: 0, ratePerItem: 0, currency: 'USD', targetEndDate: '', buyerDeliveryDate: '', remarks: '', status: 'Started' as OrderStatus });
    setColours([{ id: generateId(), colourName: '', orderedQty: 0, uom: 'meters', notes: '' }]);
    setDialogOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, order: PrintingOrder) => {
    e.stopPropagation();
    setEditingId(order.id);
    setForm({ ...order });
    setColours(data.printingColourways.filter(c => c.orderId === order.id).map(c => ({ ...c })));
    setDialogOpen(true);
  };

  const addColourRow = () => setColours(prev => [...prev, { id: generateId(), colourName: '', orderedQty: 0, uom: form.uom || 'meters', notes: '' }]);
  const removeColourRow = (id: string) => setColours(prev => prev.filter(c => c.id !== id));
  const updateColour = (id: string, field: string, value: any) => setColours(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  const totalColourQty = colours.reduce((s, c) => s + (Number(c.orderedQty) || 0), 0);
  const qtyMismatch = form.orderQty > 0 && totalColourQty !== Number(form.orderQty);

  const handleSave = async () => {
    if (!form.buyerId) { toast.error('Buyer is required'); return; }
    if (!form.fabricId) { toast.error('Fabric is required'); return; }
    if (!form.style) { toast.error('Style is required'); return; }
    if (colours.length === 0 || colours.every((c: any) => !c.colourName)) { toast.error('At least one colour row is required'); return; }

    const validColours = colours.filter((c: any) => c.colourName);
    setSaving(true);

    try {
      if (editingId) {
        // Update order header
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

        // Update the single order_rows record for this order
        const { error: rErr } = await supabase.from('order_rows').update({
          product_id: form.printingProductId || null,
          fabric_id: form.fabricId || null,
          fabric_width: form.fabricWidth || null,
          uom: form.uom,
          order_qty: Number(form.orderQty) || 0,
          chart_qty: Number(form.chartQty) || 0,
          rate_per_item: Number(form.ratePerItem) || 0,
          no_of_colours: Number(form.noOfColours) || 0,
        }).eq('order_id', editingId);
        if (rErr) { toast.error(`Failed: ${rErr.message}`); return; }

        toast.success('Order updated');
      } else {
        if (!companyId) { toast.error('No company found'); return; }
        const orderId = generateId();
        const orderRowId = generateId();

        // 1. Insert order header
        const { error: hErr } = await supabase.from('order_headers').insert({
          id: orderId,
          company_id: companyId,
          module: 'printing',
          internal_po: form.internalPO,
          buyer_id: form.buyerId,
          buyer_po: form.buyerPO || null,
          style: form.style,
          currency: form.currency,
          target_end_date: form.targetEndDate || null,
          buyer_delivery_date: form.buyerDeliveryDate || null,
          status: form.status || 'Started',
          remarks: form.remarks || null,
        });
        if (hErr) { toast.error(`Failed: ${hErr.message}`); return; }

        // 2. Insert order row (bridges header → colourways)
        const { error: rErr } = await supabase.from('order_rows').insert({
          id: orderRowId,
          order_id: orderId,
          product_id: form.printingProductId || null,
          fabric_id: form.fabricId || null,
          fabric_width: form.fabricWidth || null,
          uom: form.uom,
          order_qty: Number(form.orderQty) || 0,
          chart_qty: Number(form.chartQty) || 0,
          rate_per_item: Number(form.ratePerItem) || 0,
          no_of_colours: Number(form.noOfColours) || 0,
        });
        if (rErr) { toast.error(`Failed: ${rErr.message}`); return; }

        // 3. Insert colourways with the correct order_row_id FK
        for (let i = 0; i < validColours.length; i++) {
          const c = validColours[i];
          const { error: cErr } = await supabase.from('order_colourways').insert({
            id: c.id || generateId(),
            order_row_id: orderRowId,
            colour_name: c.colourName,
            ordered_qty: Number(c.orderedQty) || 0,
            uom: c.uom || form.uom,
            notes: c.notes || null,
            sort_order: i,
          });
          if (cErr) { toast.error(`Failed: ${cErr.message}`); return; }
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
        <h1 className="text-lg font-semibold flex items-center gap-2">Printing Orders <ExplainerTip text="Create and manage printing orders with colourways, fabrics, and product specifications. Track quantities and production progress per colourway." /></h1>
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
              <TableHead className="text-xs h-9">Fabric</TableHead>
              <TableHead className="text-xs h-9">Qty</TableHead>
              <TableHead className="text-xs h-9 min-w-[100px]">Progress</TableHead>
              <TableHead className="text-xs h-9">Status</TableHead>
              <TableHead className="text-xs h-9 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No orders found</TableCell></TableRow>
            ) : filtered.map(o => {
              const prog = getProgress(o.id);
              return (
                <TableRow key={o.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/printing-orders/${o.id}`)}>
                  <TableCell className="text-sm py-2 font-mono">{o.internalPO ?? '—'}</TableCell>
                  <TableCell className="text-sm py-2">{getBuyer(o.buyerId)}</TableCell>
                  <TableCell className="text-sm py-2">{o.style}</TableCell>
                  <TableCell className="text-sm py-2">{getFabric(o.fabricId)}</TableCell>
                  <TableCell className="text-sm py-2">{o.orderQty} {o.uom}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(prog.pct, 100)} className="h-2 flex-1" />
                      <span className={`text-[10px] font-medium ${prog.pct >= 100 ? 'text-success' : prog.pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{prog.pct.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2"><Badge className={`text-[10px] ${statusColors[o.status]}`}>{o.status}</Badge></TableCell>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <div className="space-y-1"><Label className="text-xs">Fabric *</Label>
                <Select value={form.fabricId || ''} onValueChange={v => setForm((p: any) => ({ ...p, fabricId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select fabric" /></SelectTrigger>
                  <SelectContent>{fabrics.map(f => <SelectItem key={f.id} value={f.id}>{f.shortForm} - {f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Width</Label><Input value={form.fabricWidth || ''} onChange={e => setForm((p: any) => ({ ...p, fabricWidth: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">UOM</Label><Input value={form.uom || ''} onChange={e => setForm((p: any) => ({ ...p, uom: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs">Order Qty</Label><Input type="number" value={form.orderQty || ''} onChange={e => setForm((p: any) => ({ ...p, orderQty: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Chart Qty</Label><Input type="number" value={form.chartQty || ''} onChange={e => setForm((p: any) => ({ ...p, chartQty: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Rate/Item</Label><Input type="number" step="0.01" value={form.ratePerItem || ''} onChange={e => setForm((p: any) => ({ ...p, ratePerItem: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Currency</Label>
                <Select value={form.currency || 'USD'} onValueChange={v => setForm((p: any) => ({ ...p, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="INR">INR</SelectItem><SelectItem value="AUD">AUD</SelectItem><SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem><SelectItem value="PKR">PKR</SelectItem><SelectItem value="BDT">BDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            {form.ratePerItem > 0 && form.orderQty > 0 && (
              <div className="text-sm bg-accent/50 rounded px-3 py-2">
                Order Value: <span className="font-semibold">{form.currency} {(form.ratePerItem * form.orderQty).toFixed(2)}</span>
              </div>
            )}
            <div className="space-y-1"><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm((p: any) => ({ ...p, remarks: e.target.value }))} /></div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold">Colourways</Label>
                  {qtyMismatch && <span className="flex items-center gap-1 text-[10px] text-warning"><AlertTriangle className="h-3 w-3" /> Qty mismatch ({totalColourQty} vs {form.orderQty})</span>}
                </div>
                <Button size="sm" variant="outline" onClick={addColourRow}><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs h-8">Colour</TableHead>
                    <TableHead className="text-xs h-8">Qty</TableHead>
                    <TableHead className="text-xs h-8">UOM</TableHead>
                    <TableHead className="text-xs h-8">Notes</TableHead>
                    <TableHead className="text-xs h-8 w-8"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {colours.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="py-1"><Input className="h-7 text-xs" value={c.colourName} onChange={e => updateColour(c.id, 'colourName', e.target.value)} /></TableCell>
                        <TableCell className="py-1"><Input className="h-7 text-xs" type="number" value={c.orderedQty || ''} onChange={e => updateColour(c.id, 'orderedQty', parseFloat(e.target.value) || 0)} /></TableCell>
                        <TableCell className="py-1"><Input className="h-7 text-xs" value={c.uom} onChange={e => updateColour(c.id, 'uom', e.target.value)} /></TableCell>
                        <TableCell className="py-1"><Input className="h-7 text-xs" value={c.notes || ''} onChange={e => updateColour(c.id, 'notes', e.target.value)} /></TableCell>
                        <TableCell className="py-1">{colours.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeColourRow(c.id)}><Trash2 className="h-3 w-3" /></Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
