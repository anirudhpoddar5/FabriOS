import { useState, useMemo } from 'react';
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
import { AlertCircle, Search, FileDown, Truck, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExplainerTip } from '@/components/ExplainerTip';

export default function DispatchPage() {
  const { profile } = useAuth();
  const { data: appData } = useData();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
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

  const filtered = useMemo(() => {
    if (!search) return dispatches;
    const s = search.toLowerCase();
    return dispatches.filter((d: any) => d.product_name?.toLowerCase().includes(s) || (d as any).buyers?.name?.toLowerCase().includes(s) || d.challan_number?.toLowerCase().includes(s));
  }, [dispatches, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">Dispatch & Shipping <ExplainerTip text="Record shipments against customer orders. The system tracks available balance per order and prevents over-dispatch. Manage challan numbers, vehicle details, and product/colour info." /></h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><FileDown className="h-3.5 w-3.5 mr-1" /> Export</Button>
          <Button size="sm" onClick={handleAdd}><Truck className="h-3.5 w-3.5 mr-1" /> New Dispatch</Button>
        </div>
      </div>
      <div className="relative max-w-xs mb-3">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search dispatches..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
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
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">No dispatches recorded</TableCell></TableRow>
            ) : filtered.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="text-sm py-2">{d.dispatch_date}</TableCell>
                <TableCell className="text-sm py-2">{(d as any).buyers?.name || '-'}</TableCell>
                <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{d.dispatch_type}</Badge></TableCell>
                <TableCell className="text-sm py-2">{d.product_name || '-'}</TableCell>
                <TableCell className="text-sm py-2">{d.colour || '-'}</TableCell>
                <TableCell className="text-sm py-2 text-right font-medium">{d.qty} {d.uom}</TableCell>
                <TableCell className="text-sm py-2">{d.challan_number || '-'}</TableCell>
                <TableCell className="py-2">
                  <div className="flex gap-1">
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
          </TableBody>
        </Table>
      </CardContent></Card>

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
