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
import { Plus, Search, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function GRNPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [lines, setLines] = useState<any[]>([]);

  const { data: grns = [] } = useQuery({
    queryKey: ['grn_headers', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('grn_headers').select('*, vendors(name), purchase_orders(po_number)').eq('company_id', companyId).order('grn_date', { ascending: false });
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

  const { data: items = [] } = useQuery({
    queryKey: ['inventory_items_grn', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('inventory_items').select('id, name, code, uom').eq('company_id', companyId).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!companyId,
  });

  const saveGRN = useMutation({
    mutationFn: async () => {
      const { data: grn, error } = await supabase.from('grn_headers')
        .insert({ grn_number: form.grn_number, po_id: form.po_id || null, vendor_id: form.vendor_id || null, grn_date: form.grn_date, status: 'accepted', remarks: form.remarks, company_id: companyId })
        .select().single();
      if (error) throw error;
      const validLines = lines.filter(l => (l.item_id || l.item_name) && l.qty_received > 0);
      if (validLines.length > 0) {
        const { error: lineError } = await supabase.from('grn_lines')
          .insert(validLines.map(l => ({ grn_id: grn.id, item_id: l.item_id || null, item_name: l.item_name, qty_received: l.qty_received, uom: l.uom, lot_number: l.lot_number, batch_number: l.batch_number, remarks: l.remarks })));
        if (lineError) throw lineError;
        // Also record stock inward transactions for items linked to inventory
        for (const l of validLines) {
          if (l.item_id) {
            await supabase.from('stock_transactions').insert({
              company_id: companyId, item_id: l.item_id, txn_type: 'inward', txn_date: form.grn_date,
              qty: l.qty_received, vendor_id: form.vendor_id || null, grn_id: grn.id,
              lot_number: l.lot_number, batch_number: l.batch_number, uom: l.uom,
            });
          }
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grn_headers'] }); qc.invalidateQueries({ queryKey: ['stock_transactions'] }); qc.invalidateQueries({ queryKey: ['inventory_items_grn'] }); toast.success('GRN recorded'); setDialogOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const handleAdd = () => {
    setForm({ grn_number: `GRN-${Date.now().toString(36).toUpperCase()}`, vendor_id: '', po_id: '', grn_date: new Date().toISOString().slice(0, 10), remarks: '' });
    setLines([{ id: crypto.randomUUID(), item_id: '', item_name: '', qty_received: 0, uom: 'meters', lot_number: '', batch_number: '', remarks: '' }]);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Goods Receipt (GRN)</h1>
        <Button size="sm" onClick={handleAdd}><PackageCheck className="h-3.5 w-3.5 mr-1" /> New GRN</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-xs h-8">GRN #</TableHead>
            <TableHead className="text-xs h-8">Vendor</TableHead>
            <TableHead className="text-xs h-8">PO #</TableHead>
            <TableHead className="text-xs h-8">Date</TableHead>
            <TableHead className="text-xs h-8">Status</TableHead>
            <TableHead className="text-xs h-8">Remarks</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {grns.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No GRN records</TableCell></TableRow>
            ) : grns.map((g: any) => (
              <TableRow key={g.id}>
                <TableCell className="text-sm py-2 font-medium">{g.grn_number}</TableCell>
                <TableCell className="text-sm py-2">{(g as any).vendors?.name || '-'}</TableCell>
                <TableCell className="text-sm py-2">{(g as any).purchase_orders?.po_number || '-'}</TableCell>
                <TableCell className="text-sm py-2">{g.grn_date}</TableCell>
                <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{g.status}</Badge></TableCell>
                <TableCell className="text-sm py-2 text-muted-foreground">{g.remarks || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Goods Receipt</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">GRN #</Label><Input value={form.grn_number || ''} onChange={e => setForm({ ...form, grn_number: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Vendor</Label>
                <Select value={form.vendor_id || ''} onValueChange={v => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.grn_date || ''} onChange={e => setForm({ ...form, grn_date: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} /></div>
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Items Received</Label>
                <Button size="sm" variant="outline" onClick={() => setLines(p => [...p, { id: crypto.randomUUID(), item_id: '', item_name: '', qty_received: 0, uom: 'meters', lot_number: '', batch_number: '', remarks: '' }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs h-7">Item</TableHead>
                  <TableHead className="text-xs h-7">Qty</TableHead>
                  <TableHead className="text-xs h-7">UOM</TableHead>
                  <TableHead className="text-xs h-7">Lot</TableHead>
                  <TableHead className="text-xs h-7">Batch</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell className="py-1">
                        <Select
                          value={l.item_id || ''}
                          onValueChange={v => {
                            const it = items.find((x: any) => x.id === v);
                            const u = [...lines];
                            u[i] = { ...l, item_id: v, item_name: it?.name || l.item_name, uom: it?.uom || l.uom };
                            setLines(u);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select item" /></SelectTrigger>
                          <SelectContent>
                            {items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.name}{it.code ? ` (${it.code})` : ''}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-1"><Input type="number" value={l.qty_received || ''} onChange={e => { const u = [...lines]; u[i] = { ...l, qty_received: Number(e.target.value) }; setLines(u); }} className="h-8 text-sm w-20" /></TableCell>
                      <TableCell className="py-1"><Input value={l.uom || 'meters'} onChange={e => { const u = [...lines]; u[i] = { ...l, uom: e.target.value }; setLines(u); }} className="h-8 text-sm w-20" /></TableCell>
                      <TableCell className="py-1"><Input value={l.lot_number || ''} onChange={e => { const u = [...lines]; u[i] = { ...l, lot_number: e.target.value }; setLines(u); }} className="h-8 text-sm" /></TableCell>
                      <TableCell className="py-1"><Input value={l.batch_number || ''} onChange={e => { const u = [...lines]; u[i] = { ...l, batch_number: e.target.value }; setLines(u); }} className="h-8 text-sm" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveGRN.mutate()}>{saveGRN.isPending ? 'Saving...' : 'Save GRN'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
