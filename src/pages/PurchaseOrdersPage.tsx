import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800',
  partial: 'bg-yellow-100 text-yellow-800',
  received: 'bg-green-100 text-green-800',
  closed: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
};

export default function PurchaseOrdersPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [lines, setLines] = useState<any[]>([]);

  const { data: pos = [] } = useQuery({
    queryKey: ['purchase_orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('purchase_orders').select('*, vendors(name, code)').eq('company_id', companyId).order('po_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('vendors').select('*').eq('company_id', companyId).eq('is_active', true);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: invItems = [] } = useQuery({
    queryKey: ['inventory_items', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('inventory_items').select('*').eq('company_id', companyId).eq('is_active', true);
      return data || [];
    },
    enabled: !!companyId,
  });

  const savePO = useMutation({
    mutationFn: async () => {
      const { error, data: po } = await supabase.from('purchase_orders')
        .insert({ po_number: form.po_number, vendor_id: form.vendor_id, po_date: form.po_date, status: 'draft', source_type: form.source_type || 'manual', currency: form.currency || 'USD', remarks: form.remarks, company_id: companyId })
        .select().single();
      if (error) throw error;
      // Insert lines
      const validLines = lines.filter(l => l.item_name && l.qty_ordered > 0);
      if (validLines.length > 0) {
        const { error: lineError } = await supabase.from('purchase_order_lines')
          .insert(validLines.map(l => ({ po_id: po.id, item_id: l.item_id || null, item_name: l.item_name, uom: l.uom || 'meters', qty_ordered: l.qty_ordered, rate: l.rate || 0, amount: (l.qty_ordered || 0) * (l.rate || 0) })));
        if (lineError) throw lineError;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase_orders'] }); toast.success('PO created'); setDialogOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const handleAdd = () => {
    setForm({ po_number: `PO-${Date.now().toString(36).toUpperCase()}`, vendor_id: '', po_date: new Date().toISOString().slice(0, 10), source_type: 'manual', currency: 'USD', remarks: '' });
    setLines([{ id: crypto.randomUUID(), item_id: '', item_name: '', uom: 'meters', qty_ordered: 0, rate: 0 }]);
    setDialogOpen(true);
  };

  const addLine = () => setLines(prev => [...prev, { id: crypto.randomUUID(), item_id: '', item_name: '', uom: 'meters', qty_ordered: 0, rate: 0 }]);

  const exportCSV = () => {
    const header = 'PO Number,Vendor,Date,Status,Total,Invoice,Payment\n';
    const rows = pos.map((p: any) => `${p.po_number},${(p as any).vendors?.name || ''},${p.po_date},${p.status},${p.total_amount || 0},${p.invoice_number || ''},${p.payment_status || ''}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'purchase_orders.csv'; a.click();
  };

  const filtered = useMemo(() => {
    if (!search) return pos;
    const s = search.toLowerCase();
    return pos.filter((p: any) => p.po_number?.toLowerCase().includes(s) || (p as any).vendors?.name?.toLowerCase().includes(s));
  }, [pos, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Purchase Orders</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><FileDown className="h-3.5 w-3.5 mr-1" /> Export</Button>
          <Button size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> New PO</Button>
        </div>
      </div>
      <div className="relative max-w-xs mb-3">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search POs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-xs h-8">PO #</TableHead>
            <TableHead className="text-xs h-8">Vendor</TableHead>
            <TableHead className="text-xs h-8">Date</TableHead>
            <TableHead className="text-xs h-8">Status</TableHead>
            <TableHead className="text-xs h-8">Invoice #</TableHead>
            <TableHead className="text-xs h-8">Payment</TableHead>
            <TableHead className="text-xs h-8 text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No purchase orders</TableCell></TableRow>
            ) : filtered.map((po: any) => (
              <TableRow key={po.id}>
                <TableCell className="text-sm py-2 font-medium">{po.po_number}</TableCell>
                <TableCell className="text-sm py-2">{(po as any).vendors?.name || '-'}</TableCell>
                <TableCell className="text-sm py-2">{po.po_date}</TableCell>
                <TableCell className="py-2">
                  <Badge className={`text-[10px] ${STATUS_COLORS[po.status] || ''}`}>{po.status}</Badge>
                </TableCell>
                <TableCell className="text-sm py-2">{po.invoice_number || '-'}</TableCell>
                <TableCell className="py-2">
                  {po.payment_status && <Badge variant="outline" className="text-[10px]">{po.payment_status}</Badge>}
                </TableCell>
                <TableCell className="text-sm py-2 text-right">{po.total_amount || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">PO Number *</Label><Input value={form.po_number || ''} onChange={e => setForm({ ...form, po_number: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Vendor *</Label>
                <Select value={form.vendor_id || ''} onValueChange={v => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.po_date || ''} onChange={e => setForm({ ...form, po_date: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} /></div>

            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Line Items</Label>
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs h-7">Item</TableHead>
                  <TableHead className="text-xs h-7">UOM</TableHead>
                  <TableHead className="text-xs h-7">Qty</TableHead>
                  <TableHead className="text-xs h-7">Rate</TableHead>
                  <TableHead className="text-xs h-7">Amount</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={line.id}>
                      <TableCell className="py-1">
                        <Input value={line.item_name} onChange={e => {
                          const updated = [...lines]; updated[idx] = { ...line, item_name: e.target.value }; setLines(updated);
                        }} className="h-8 text-sm" placeholder="Item name" />
                      </TableCell>
                      <TableCell className="py-1"><Input value={line.uom} onChange={e => { const u = [...lines]; u[idx] = { ...line, uom: e.target.value }; setLines(u); }} className="h-8 text-sm w-20" /></TableCell>
                      <TableCell className="py-1"><Input type="number" value={line.qty_ordered || ''} onChange={e => { const u = [...lines]; u[idx] = { ...line, qty_ordered: Number(e.target.value) }; setLines(u); }} className="h-8 text-sm w-20" /></TableCell>
                      <TableCell className="py-1"><Input type="number" value={line.rate || ''} onChange={e => { const u = [...lines]; u[idx] = { ...line, rate: Number(e.target.value) }; setLines(u); }} className="h-8 text-sm w-20" /></TableCell>
                      <TableCell className="py-1 text-sm">{((line.qty_ordered || 0) * (line.rate || 0)).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!form.po_number || !form.vendor_id) { toast.error('PO number and vendor required'); return; }
              savePO.mutate();
            }}>{savePO.isPending ? 'Saving...' : 'Create PO'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
