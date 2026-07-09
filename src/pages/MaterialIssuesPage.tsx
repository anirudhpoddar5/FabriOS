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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Plus, Search, ClipboardList, BarChart3, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePagination } from '@/hooks/use-pagination';
import DataTablePagination from '@/components/DataTablePagination';

export default function MaterialIssuesPage() {
  const { profile, currentModule } = useAuth();
  const companyId = profile?.company_id;
  const { data: appData } = useData();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const showP = currentModule === 'printing' || currentModule === 'both';
  const showS = currentModule === 'stitching' || currentModule === 'both';

  const orders = [
    ...(showP ? appData.printingOrders : []),
    ...(showS ? appData.stitchingOrders : []),
  ];

  const allColourways = [
    ...appData.printingColourways,
    ...appData.stitchingColourways,
  ];

  const { data: issues = [] } = useQuery({
    queryKey: ['material_issues', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from('material_issues')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        orderId: r.order_id,
        rowId: r.row_id,
        itemName: r.item_name,
        itemId: r.item_id,
        uom: r.uom,
        qtyIssued: Number(r.qty_issued),
        qtyConsumed: Number(r.qty_consumed),
        qtyWasted: Number(r.qty_wasted),
        date: r.date,
        notes: r.notes,
      }));
    },
    enabled: !!companyId,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory_items_mi', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, code, uom')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!companyId,
  });

  const filtered = useMemo(() => {
    if (!search) return issues;
    const s = search.toLowerCase();
    return (issues as any[]).filter((i: any) =>
      i.itemName?.toLowerCase().includes(s) ||
      i.orderId?.toLowerCase().includes(s)
    );
  }, [issues, search]);

  const pagination = usePagination(filtered, 50);

  const handleAdd = () => {
    setEditingId(null);
    setForm({
      orderId: '',
      rowId: '',
      itemName: '',
      itemId: '',
      uom: 'meters',
      qtyIssued: 0,
      qtyConsumed: 0,
      date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setForm({ ...item });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        company_id: companyId,
        order_id: form.orderId || null,
        row_id: form.rowId || null,
        item_name: form.itemName,
        item_id: form.itemId || null,
        uom: form.uom,
        qty_issued: Number(form.qtyIssued) || 0,
        qty_consumed: Number(form.qtyConsumed) || 0,
        date: form.date,
        notes: form.notes || null,
      };
      Object.keys(payload).forEach(k => { if (payload[k] === undefined || payload[k] === '') delete payload[k]; });

      if (editingId) {
        const { error } = await supabase.from('material_issues').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('material_issues').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material_issues'] });
      toast.success(editingId ? 'Material issue updated' : 'Material issue recorded');
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('material_issues').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material_issues'] });
      toast.success('Material issue deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const orderOptions = useMemo(() => {
    if (!form.orderId) return [];
    const order = orders.find((o: any) => o.id === form.orderId);
    return order ? [{ id: order.id, label: `${order.internalPO} — ${order.style || ''}` }] : [];
  }, [orders, form.orderId]);

  const selectedOrderRows = useMemo(() => {
    return form.orderId ? allColourways.filter((c: any) => c.orderId === form.orderId) : [];
  }, [allColourways, form.orderId]);

  // BOM vs Actual comparison
  const { data: bomData = [] } = useQuery({
    queryKey: ['bom_headers_mi', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from('bom_headers')
        .select('*, bom_lines(*)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const bomComparison = useMemo(() => {
    const result: any[] = [];
    for (const bom of bomData as any[]) {
      if (!bom.bom_lines) continue;
      for (const line of bom.bom_lines) {
        const consumed = issues.filter((i: any) => i.orderId === bom.order_id && i.itemName === line.item_name).reduce((s: number, i: any) => s + i.qtyConsumed, 0);
        const wasted = issues.filter((i: any) => i.orderId === bom.order_id && i.itemName === line.item_name).reduce((s: number, i: any) => s + i.qtyWasted, 0);
        result.push({
          bomTitle: bom.title,
          itemName: line.item_name,
          bomQty: line.quantity,
          actualConsumed: consumed,
          wasted,
          wastagePct: consumed > 0 ? ((wasted / (consumed + wasted)) * 100).toFixed(1) : '0.0',
        });
      }
    }
    return result;
  }, [bomData, issues]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Material Consumption</h1>
        <Button size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> New Issue</Button>
      </div>

      <Tabs defaultValue="issues">
        <TabsList className="mb-3">
          <TabsTrigger value="issues" className="text-xs"><ClipboardList className="h-3.5 w-3.5 mr-1" /> Issues</TabsTrigger>
          <TabsTrigger value="bom-compare" className="text-xs"><BarChart3 className="h-3.5 w-3.5 mr-1" /> BOM vs Actual</TabsTrigger>
        </TabsList>

        <TabsContent value="issues">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
            <span className="text-xs text-muted-foreground">{filtered.length} issue{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">Date</TableHead>
                  <TableHead className="text-xs h-8">Order</TableHead>
                  <TableHead className="text-xs h-8">Item</TableHead>
                  <TableHead className="text-xs h-8 text-right">Issued</TableHead>
                  <TableHead className="text-xs h-8 text-right">Consumed</TableHead>
                  <TableHead className="text-xs h-8 text-right">Waste</TableHead>
                  <TableHead className="text-xs h-8">UOM</TableHead>
                  <TableHead className="text-xs h-8">Notes</TableHead>
                  <TableHead className="text-xs h-8 w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                      <ClipboardList className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                      <p>No material issues recorded yet.</p>
                    </TableCell>
                  </TableRow>
                ) : pagination.pageItems.map((item: any) => {
                  const order = orders.find((o: any) => o.id === item.orderId);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs py-2">{item.date}</TableCell>
                      <TableCell className="text-xs py-2 font-medium">{order?.internalPO || item.orderId?.slice(0, 8) || '—'}</TableCell>
                      <TableCell className="text-xs py-2">{item.itemName}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{item.qtyIssued}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{item.qtyConsumed}</TableCell>
                      <TableCell className="text-xs py-2 text-right">
                        <span className={item.qtyWasted > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {item.qtyWasted}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs py-2">{item.uom}</TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground max-w-[120px] truncate">{item.notes || '—'}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
          <DataTablePagination {...pagination} />

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'New'} Material Issue</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Order</Label>
                  <Select value={form.orderId || ''} onValueChange={v => setForm({ ...form, orderId: v, rowId: '' })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select order" /></SelectTrigger>
                    <SelectContent>
                      {orders.map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>{o.internalPO} — {o.style || ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Colourway / Row</Label>
                  <Select value={form.rowId || ''} onValueChange={v => setForm({ ...form, rowId: v })} disabled={!form.orderId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={form.orderId ? 'Select colourway (optional)' : 'Select order first'} /></SelectTrigger>
                    <SelectContent>
                      {selectedOrderRows.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.colourName} ({c.orderedQty} {c.uom})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Item *</Label>
                    <Input value={form.itemName || ''} onChange={e => setForm({ ...form, itemName: e.target.value })} placeholder="Item name" className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">UOM</Label>
                    <Input value={form.uom || 'meters'} onChange={e => setForm({ ...form, uom: e.target.value })} className="h-9" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Qty Issued *</Label>
                    <Input type="number" min={0} value={form.qtyIssued || ''} onChange={e => setForm({ ...form, qtyIssued: Number(e.target.value) || 0 })} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Qty Consumed</Label>
                    <Input type="number" min={0} value={form.qtyConsumed || ''} onChange={e => setForm({ ...form, qtyConsumed: Number(e.target.value) || 0 })} className="h-9" />
                  </div>
                </div>

                {form.qtyIssued > 0 && form.qtyConsumed >= 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    Waste: <strong className={form.qtyIssued - form.qtyConsumed > 0 ? 'text-red-600' : 'text-green-600'}>
                      {Math.max(0, form.qtyIssued - form.qtyConsumed)} {form.uom}
                    </strong>
                    {form.qtyIssued > 0 && (
                      <span>({((Math.max(0, form.qtyIssued - form.qtyConsumed) / form.qtyIssued) * 100).toFixed(1)}% wastage)</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="h-9" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.itemName}>
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="bom-compare">
          <Card>
            <CardContent className="p-4">
              {bomComparison.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                  <p>No BOM data with matching material issues.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Create BOMs and record material issues to see comparison.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-8">BOM</TableHead>
                        <TableHead className="text-xs h-8">Item</TableHead>
                        <TableHead className="text-xs h-8 text-right">BOM Qty</TableHead>
                        <TableHead className="text-xs h-8 text-right">Actual Used</TableHead>
                        <TableHead className="text-xs h-8 text-right">Wasted</TableHead>
                        <TableHead className="text-xs h-8">Wastage %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bomComparison.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs py-2">{row.bomTitle}</TableCell>
                          <TableCell className="text-xs py-2">{row.itemName}</TableCell>
                          <TableCell className="text-xs py-2 text-right">{row.bomQty}</TableCell>
                          <TableCell className="text-xs py-2 text-right">{row.actualConsumed}</TableCell>
                          <TableCell className="text-xs py-2 text-right">{row.wasted}</TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(Number(row.wastagePct), 100)} className="h-1.5 w-16" />
                              <span className={`text-[10px] ${Number(row.wastagePct) > 10 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                {row.wastagePct}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
