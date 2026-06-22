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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Search, ArrowDownToLine, ArrowUpFromLine, Box, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTablePagination from '@/components/DataTablePagination';
import { usePagination } from '@/hooks/use-pagination';

export default function InventoryPage() {
  const { profile } = useAuth();
  const { data: appData } = useData();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [tab, setTab] = useState('items');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [txnForm, setTxnForm] = useState<any>({});

  const allOrders = useMemo(() => [
    ...appData.printingOrders.map((o: any) => ({ ...o, module: 'printing' })),
    ...appData.stitchingOrders.map((o: any) => ({ ...o, module: 'stitching' })),
  ], [appData]);

  const { data: stockJobs = [] } = useQuery({
    queryKey: ['stock_jobs_inv', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('stock_jobs').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['inventory_items', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('inventory_items').select('*').eq('company_id', companyId).order('name');
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['stock_transactions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('stock_transactions').select('*, inventory_items(name, code)').eq('company_id', companyId).order('txn_date', { ascending: false }).limit(500);
      return data || [];
    },
    enabled: !!companyId,
  });

  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i: any) => { map[i.id] = i.opening_stock || 0; });
    transactions.forEach((t: any) => {
      if (!map[t.item_id]) map[t.item_id] = 0;
      if (['inward', 'opening'].includes(t.txn_type)) map[t.item_id] += Number(t.qty);
      else if (['outward', 'consumption'].includes(t.txn_type)) map[t.item_id] -= Number(t.qty);
      else if (t.txn_type === 'adjustment') map[t.item_id] += Number(t.qty);
    });
    return map;
  }, [items, transactions]);

  const saveItem = useMutation({
    mutationFn: async (payload: any) => {
      if (editingId) {
        const { id, company_id, created_at, updated_at, ...updates } = payload;
        const { error } = await supabase.from('inventory_items').update(updates).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_items').insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory_items'] }); toast.success('Saved'); setDialogOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const saveTxn = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('stock_transactions').insert({ ...payload, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock_transactions'] }); toast.success('Transaction recorded'); setTxnDialogOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const handleAddItem = () => {
    setEditingId(null);
    setForm({ code: '', name: '', category: 'fabric', uom: 'meters', reorder_level: 0, opening_stock: 0, is_active: true });
    setDialogOpen(true);
  };

  const handleAddTxn = (type: string) => {
    setTxnForm({ item_id: '', txn_type: type, txn_date: new Date().toISOString().slice(0, 10), qty: 0, lot_number: '', batch_number: '', roll_number: '', order_id: '', stock_job_id: '', remarks: '' });
    setTxnDialogOpen(true);
  };

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((i: any) => i.name?.toLowerCase().includes(s) || i.code?.toLowerCase().includes(s));
  }, [items, search]);

  const itemsPagination = usePagination(filteredItems, 50);
  const txnPagination = usePagination(transactions, 50);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleAddTxn('inward')}><ArrowDownToLine className="h-3.5 w-3.5 mr-1" /> Inward</Button>
          <Button size="sm" variant="outline" onClick={() => handleAddTxn('outward')}><ArrowUpFromLine className="h-3.5 w-3.5 mr-1" /> Issue</Button>
          <Button size="sm" onClick={handleAddItem}><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="items" className="text-xs">Stock On Hand</TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <div className="relative max-w-xs mb-3">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs h-8">Code</TableHead>
                <TableHead className="text-xs h-8">Name</TableHead>
                <TableHead className="text-xs h-8">Category</TableHead>
                <TableHead className="text-xs h-8">UOM</TableHead>
                <TableHead className="text-xs h-8 text-right">On Hand</TableHead>
                <TableHead className="text-xs h-8 text-right">Reorder</TableHead>
                <TableHead className="text-xs h-8 w-16"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Box className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No inventory items</p>
                      <p className="text-xs text-muted-foreground/60 max-w-xs">Add inventory items like fabrics, trims, and accessories to track stock levels. Click "Add Item" to get started.</p>
                    </div>
                  </TableCell></TableRow>
                ) : itemsPagination.pageItems.map((item: any) => {
                  const onHand = stockMap[item.id] || 0;
                  const lowStock = item.reorder_level > 0 && onHand <= item.reorder_level;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm py-2">{item.code}</TableCell>
                      <TableCell className="text-sm py-2">{item.name}</TableCell>
                      <TableCell className="text-sm py-2 capitalize">{item.category}</TableCell>
                      <TableCell className="text-sm py-2">{item.uom}</TableCell>
                      <TableCell className={`text-sm py-2 text-right font-medium ${lowStock ? 'text-destructive' : ''}`}>{onHand}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{item.reorder_level || '-'}</TableCell>
                      <TableCell className="py-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(item.id); setForm({ ...item }); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
          <DataTablePagination {...itemsPagination} />
        </TabsContent>

        <TabsContent value="transactions">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs h-8">Date</TableHead>
                <TableHead className="text-xs h-8">Item</TableHead>
                <TableHead className="text-xs h-8">Type</TableHead>
                <TableHead className="text-xs h-8 text-right">Qty</TableHead>
                <TableHead className="text-xs h-8">Order/Job Ref</TableHead>
                <TableHead className="text-xs h-8">Lot/Batch</TableHead>
                <TableHead className="text-xs h-8">Remarks</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No stock transactions</p>
                      <p className="text-xs text-muted-foreground/60 max-w-xs">Stock movements appear here when you record inward receipts or outward issues using the buttons above.</p>
                    </div>
                  </TableCell></TableRow>
                ) : txnPagination.pageItems.map((t: any) => {
                  const orderRef = t.order_id ? (allOrders.find((o: any) => o.id === t.order_id)?.internalPO || t.order_id.slice(0, 8)) : '';
                  const jobRef = t.stock_job_id ? (stockJobs.find((j: any) => j.id === t.stock_job_id)?.job_number || t.stock_job_id.slice(0, 8)) : '';
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm py-2">{t.txn_date}</TableCell>
                      <TableCell className="text-sm py-2">{(t as any).inventory_items?.name || '-'}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant={t.txn_type === 'inward' ? 'default' : t.txn_type === 'outward' ? 'secondary' : 'outline'} className="text-[10px]">{t.txn_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm py-2 text-right">{t.qty}</TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground">{orderRef || jobRef || '-'}</TableCell>
                      <TableCell className="text-sm py-2">{[t.lot_number, t.batch_number, t.roll_number].filter(Boolean).join(' / ') || '-'}</TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">{t.remarks || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
          <DataTablePagination {...txnPagination} />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Inventory Item</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Code *</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label className="text-xs">Name *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category || 'fabric'} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fabric">Fabric</SelectItem>
                    <SelectItem value="trim">Trim</SelectItem>
                    <SelectItem value="accessory">Accessory</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">UOM</Label><Input value={form.uom || ''} onChange={e => setForm({ ...form, uom: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Opening Stock</Label><Input type="number" value={form.opening_stock || 0} onChange={e => setForm({ ...form, opening_stock: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Reorder Level</Label><Input type="number" value={form.reorder_level || 0} onChange={e => setForm({ ...form, reorder_level: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!form.code || !form.name) { toast.error('Code and name required'); return; } saveItem.mutate(form); }}>{saveItem.isPending ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Transaction Dialog — with order/job linkage */}
      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Stock {txnForm.txn_type === 'inward' ? 'Inward' : 'Issue / Outward'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Item *</Label>
              <Select value={txnForm.item_id || ''} onValueChange={v => setTxnForm({ ...txnForm, item_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {items.filter((i: any) => i.is_active).map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.code} — {i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date</Label><Input type="date" value={txnForm.txn_date || ''} onChange={e => setTxnForm({ ...txnForm, txn_date: e.target.value })} /></div>
              <div><Label className="text-xs">Qty *</Label><Input type="number" value={txnForm.qty || ''} onChange={e => setTxnForm({ ...txnForm, qty: Number(e.target.value) })} /></div>
            </div>

            {/* Linkage to order or stock job */}
            {txnForm.txn_type === 'outward' && (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-xs">Issue Against</Label>
                  <Select value={txnForm.order_id ? 'order' : txnForm.stock_job_id ? 'stockjob' : 'none'} onValueChange={v => {
                    if (v === 'none') setTxnForm({ ...txnForm, order_id: '', stock_job_id: '' });
                    else if (v === 'order') setTxnForm({ ...txnForm, stock_job_id: '' });
                    else setTxnForm({ ...txnForm, order_id: '' });
                  }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General Issue</SelectItem>
                      <SelectItem value="order">Customer Order</SelectItem>
                      <SelectItem value="stockjob">Stock Job</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!txnForm.stock_job_id && txnForm.order_id !== undefined && (
                  <div>
                    <Label className="text-xs">Order</Label>
                    <Select value={txnForm.order_id || ''} onValueChange={v => setTxnForm({ ...txnForm, order_id: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select order" /></SelectTrigger>
                      <SelectContent>{allOrders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.internalPO} ({o.module})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {txnForm.stock_job_id !== undefined && !txnForm.order_id && (
                  <div>
                    <Label className="text-xs">Stock Job</Label>
                    <Select value={txnForm.stock_job_id || ''} onValueChange={v => setTxnForm({ ...txnForm, stock_job_id: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select stock job" /></SelectTrigger>
                      <SelectContent>{stockJobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.job_number} - {j.product_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Lot #</Label><Input value={txnForm.lot_number || ''} onChange={e => setTxnForm({ ...txnForm, lot_number: e.target.value })} /></div>
              <div><Label className="text-xs">Batch #</Label><Input value={txnForm.batch_number || ''} onChange={e => setTxnForm({ ...txnForm, batch_number: e.target.value })} /></div>
              <div><Label className="text-xs">Roll #</Label><Input value={txnForm.roll_number || ''} onChange={e => setTxnForm({ ...txnForm, roll_number: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Remarks</Label><Input value={txnForm.remarks || ''} onChange={e => setTxnForm({ ...txnForm, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxnDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!txnForm.item_id || !txnForm.qty) { toast.error('Item and qty required'); return; }
              const payload: any = {
                item_id: txnForm.item_id, txn_type: txnForm.txn_type, txn_date: txnForm.txn_date,
                qty: txnForm.qty, lot_number: txnForm.lot_number || null, batch_number: txnForm.batch_number || null,
                roll_number: txnForm.roll_number || null, remarks: txnForm.remarks || null,
                order_id: txnForm.order_id || null, stock_job_id: txnForm.stock_job_id || null,
              };
              saveTxn.mutate(payload);
            }}>{saveTxn.isPending ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
