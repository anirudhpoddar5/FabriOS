import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, FileDown, FileText, Package, ShoppingCart, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExplainerTip } from '@/components/ExplainerTip';

const CATEGORIES = ['fabric', 'trim', 'accessory', 'other'];

const PURCHASE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_planned: { label: 'Not Planned', color: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  partial: { label: 'Partially Ordered', color: 'bg-blue-100 text-blue-800' },
  ordered: { label: 'Fully Ordered', color: 'bg-green-100 text-green-800' },
  received: { label: 'Received', color: 'bg-emerald-100 text-emerald-800' },
};

export default function BomPage() {
  const { profile } = useAuth();
  const { data: appData } = useData();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [tab, setTab] = useState('order-bom');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [lines, setLines] = useState<any[]>([]);
  const [selectedLineIdxs, setSelectedLineIdxs] = useState<Set<number>>(new Set());

  const { data: boms = [] } = useQuery({
    queryKey: ['bom_headers', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('bom_headers').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const fetchLines = async (bomId: string) => {
    const { data } = await supabase.from('bom_lines').select('*').eq('bom_id', bomId).order('sort_order');
    return data || [];
  };

  const { data: stockJobs = [] } = useQuery({
    queryKey: ['stock_jobs_bom', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('stock_jobs').select('*').eq('company_id', companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const allOrders = useMemo(() => [
    ...appData.printingOrders.map((o: any) => ({ ...o, module: 'printing' })),
    ...appData.stitchingOrders.map((o: any) => ({ ...o, module: 'stitching' })),
  ], [appData]);

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors_bom', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('vendors').select('*').eq('company_id', companyId).eq('is_active', true);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch PO lines to determine purchase status of BOM lines
  const { data: poLines = [] } = useQuery({
    queryKey: ['po_lines_bom', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('purchase_order_lines').select('*, purchase_orders(status, vendor_id, po_number)').limit(1000);
      return data || [];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from('bom_headers').update({
          title: form.title, bom_type: form.bom_type, order_id: form.order_id || null,
          remarks: form.remarks, status: form.status,
        }).eq('id', editingId);
        if (error) throw error;
        await supabase.from('bom_lines').delete().eq('bom_id', editingId);
        if (lines.length > 0) {
          const rows = lines.map((l, i) => ({
            bom_id: editingId, category: l.category || 'fabric', item_name: l.item_name || '',
            item_id: l.item_id || null, quantity: Number(l.quantity) || 0,
            avg_consumption: Number(l.avg_consumption) || 0, extra_pct: Number(l.extra_pct) || 0,
            rate: Number(l.rate) || 0, total_amount: Number(l.total_amount) || 0,
            uom: l.uom || '', vendor_name: l.vendor_name || null, remarks: l.remarks || null,
            sort_order: i,
          }));
          const { error: le } = await supabase.from('bom_lines').insert(rows);
          if (le) throw le;
        }
      } else {
        const bomId = crypto.randomUUID();
        const { error } = await supabase.from('bom_headers').insert({
          id: bomId, company_id: companyId, title: form.title, bom_type: form.bom_type,
          order_id: form.order_id || null, remarks: form.remarks, status: form.status || 'draft',
        });
        if (error) throw error;
        if (lines.length > 0) {
          const rows = lines.map((l, i) => ({
            bom_id: bomId, category: l.category || 'fabric', item_name: l.item_name || '',
            item_id: l.item_id || null, quantity: Number(l.quantity) || 0,
            avg_consumption: Number(l.avg_consumption) || 0, extra_pct: Number(l.extra_pct) || 0,
            rate: Number(l.rate) || 0, total_amount: Number(l.total_amount) || 0,
            uom: l.uom || '', vendor_name: l.vendor_name || null, remarks: l.remarks || null,
            sort_order: i,
          }));
          const { error: le } = await supabase.from('bom_lines').insert(rows);
          if (le) throw le;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom_headers'] });
      toast.success(editingId ? 'BOM updated' : 'BOM created');
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generatePOMutation = useMutation({
    mutationFn: async () => {
      // Group selected lines by vendor
      const selectedLines = Array.from(selectedLineIdxs).map(i => lines[i]).filter(Boolean);
      if (selectedLines.length === 0) throw new Error('No lines selected');

      const vendorGroups: Record<string, any[]> = {};
      selectedLines.forEach(l => {
        const vKey = l.vendor_name || '__unassigned__';
        if (!vendorGroups[vKey]) vendorGroups[vKey] = [];
        vendorGroups[vKey].push(l);
      });

      if (vendorGroups['__unassigned__']) {
        throw new Error('All selected lines must have a vendor assigned before generating POs');
      }

      const sourceRef = form.bom_type === 'order' ? form.order_id : null;

      for (const [vendorName, vLines] of Object.entries(vendorGroups)) {
        const vendor = vendors.find((v: any) => v.name === vendorName);
        if (!vendor) throw new Error(`Vendor "${vendorName}" not found in vendor master`);

        const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
        const totalAmount = vLines.reduce((s, l) => s + (Number(l.total_amount) || 0), 0) || null;

        const { data: po, error } = await supabase.from('purchase_orders').insert({
          po_number: poNumber, vendor_id: vendor.id, po_date: new Date().toISOString().slice(0, 10),
          status: 'draft', source_type: form.bom_type === 'manual' ? 'manual' : 'bom',
          currency: 'USD', total_amount: totalAmount, order_id: sourceRef,
          company_id: companyId, remarks: `From BOM: ${form.title || editingId?.slice(0, 8)}`,
        }).select().single();
        if (error) throw error;

        const poLineRows = vLines.map(l => ({
          po_id: po.id, item_name: l.item_name, item_id: l.item_id || null,
          uom: l.uom || 'meters',
          qty_ordered: Math.ceil((Number(l.quantity) || 0) * (Number(l.avg_consumption) || 1) * (1 + (Number(l.extra_pct) || 0) / 100)),
          rate: Number(l.rate) || 0, amount: Number(l.total_amount) || 0,
        }));
        const { error: lineErr } = await supabase.from('purchase_order_lines').insert(poLineRows);
        if (lineErr) throw lineErr;
      }

      // Update BOM status
      if (editingId) {
        await supabase.from('bom_headers').update({ status: 'po_generated' }).eq('id', editingId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom_headers', 'purchase_orders', 'po_lines_bom'] });
      toast.success('Purchase Orders generated successfully');
      setPoDialogOpen(false);
      setSelectedLineIdxs(new Set());
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleNew = (bomType: string) => {
    setEditingId(null);
    setForm({ title: '', bom_type: bomType, order_id: '', remarks: '', status: 'draft' });
    setLines([]);
    setSelectedLineIdxs(new Set());
    setDialogOpen(true);
  };

  const handleEdit = async (bom: any) => {
    setEditingId(bom.id);
    setForm({ ...bom });
    const bomLines = await fetchLines(bom.id);
    setLines(bomLines);
    setSelectedLineIdxs(new Set());
    setDialogOpen(true);
  };

  const addLine = () => {
    setLines(prev => [...prev, {
      category: 'fabric', item_name: '', item_id: null, quantity: 0,
      avg_consumption: 0, extra_pct: 0, rate: 0, total_amount: 0,
      uom: 'meters', vendor_name: '', remarks: '',
    }]);
  };

  const updateLine = (idx: number, field: string, value: any) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      const qty = Number(updated[idx].quantity) || 0;
      const avg = Number(updated[idx].avg_consumption) || 1;
      const extra = Number(updated[idx].extra_pct) || 0;
      const rate = Number(updated[idx].rate) || 0;
      // required_qty = ceil(ordered_qty * avg_consumption * (1 + extra%/100))
      const reqQty = Math.ceil(qty * (avg || 1) * (1 + extra / 100));
      updated[idx].required_qty = reqQty;
      updated[idx].total_amount = Math.round(reqQty * rate * 100) / 100;
      return updated;
    });
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
    setSelectedLineIdxs(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1); });
      return next;
    });
  };

  const handleSave = () => {
    if (!form.title && !form.order_id) { toast.error('Title or order reference required'); return; }
    saveMutation.mutate();
  };

  const handleGeneratePOs = () => {
    if (selectedLineIdxs.size === 0) {
      // Select all lines with vendors
      const withVendor = new Set<number>();
      lines.forEach((l, i) => { if (l.vendor_name) withVendor.add(i); });
      if (withVendor.size === 0) { toast.error('Assign vendors to BOM lines before generating POs'); return; }
      setSelectedLineIdxs(withVendor);
    }
    setPoDialogOpen(true);
  };

  const exportCSV = () => {
    const header = 'Title,Type,Order,Status,Remarks\n';
    const rows = boms.map((b: any) => `"${b.title || ''}","${b.bom_type}","${b.order_id || ''}","${b.status}","${b.remarks || ''}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bom_list.csv'; a.click();
  };

  const filteredBoms = useMemo(() => {
    const type = tab === 'order-bom' ? 'order' : tab === 'stock-bom' ? 'stock' : 'manual';
    return boms.filter((b: any) => b.bom_type === type);
  }, [boms, tab]);

  const toggleLineSelect = (idx: number) => {
    setSelectedLineIdxs(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectedVendorGroups = useMemo(() => {
    const groups: Record<string, { vendor: string; lines: any[] }> = {};
    Array.from(selectedLineIdxs).forEach(i => {
      const l = lines[i];
      if (!l) return;
      const v = l.vendor_name || 'Unassigned';
      if (!groups[v]) groups[v] = { vendor: v, lines: [] };
      groups[v].lines.push(l);
    });
    return Object.values(groups);
  }, [selectedLineIdxs, lines]);

  const BomList = ({ bomType, emptyIcon: Icon, emptyTitle, emptyDesc }: any) => (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <Button size="sm" variant="outline" onClick={exportCSV}><FileDown className="h-3.5 w-3.5 mr-1" /> Export</Button>
        <Button size="sm" onClick={() => handleNew(bomType)}><Plus className="h-3.5 w-3.5 mr-1" /> New BOM</Button>
      </div>
      {filteredBoms.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3"><Icon className="h-6 w-6 text-muted-foreground" /></div>
          <h3 className="text-sm font-medium mb-1">{emptyTitle}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">{emptyDesc}</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs h-8">Title</TableHead>
              <TableHead className="text-xs h-8">Order Ref</TableHead>
              <TableHead className="text-xs h-8">Status</TableHead>
              <TableHead className="text-xs h-8">Created</TableHead>
              <TableHead className="text-xs h-8 w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredBoms.map((b: any) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => handleEdit(b)}>
                  <TableCell className="text-sm py-2">{b.title || '-'}</TableCell>
                  <TableCell className="text-sm py-2">{b.order_id ? allOrders.find((o: any) => o.id === b.order_id)?.internalPO || b.order_id.slice(0, 8) : '-'}</TableCell>
                  <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{b.status}</Badge></TableCell>
                  <TableCell className="text-xs py-2 text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="py-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); handleEdit(b); }}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4 flex items-center gap-2">BOM & Purchase <ExplainerTip text="Create Bills of Material from orders to plan raw material requirements. Generate Purchase Orders from BOM lines to procure materials. Track BOMs by type: Order-based, Stock, or Manual." /></h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="order-bom" className="text-xs">Order BOM</TabsTrigger>
          <TabsTrigger value="stock-bom" className="text-xs">Stock Job BOM</TabsTrigger>
          <TabsTrigger value="manual" className="text-xs">General Purchase</TabsTrigger>
        </TabsList>
        <TabsContent value="order-bom">
          <BomList bomType="order" emptyIcon={FileText} emptyTitle="Order BOM" emptyDesc="Generate material requirements from customer orders." />
        </TabsContent>
        <TabsContent value="stock-bom">
          <BomList bomType="stock" emptyIcon={Package} emptyTitle="Stock Job BOM" emptyDesc="Generate material requirements for stock production jobs." />
        </TabsContent>
        <TabsContent value="manual">
          <BomList bomType="manual" emptyIcon={ShoppingCart} emptyTitle="General Purchase" emptyDesc="Create purchase requirements without linking to orders or stock jobs." />
        </TabsContent>
      </Tabs>

      {/* BOM Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'New'} BOM</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label className="text-xs">Title</Label><Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="BOM title" /></div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.bom_type || 'order'} onValueChange={v => setForm({ ...form, bom_type: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order">Order BOM</SelectItem>
                    <SelectItem value="stock">Stock Job BOM</SelectItem>
                    <SelectItem value="manual">General Purchase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.bom_type === 'order' && (
                <div>
                  <Label className="text-xs">Order</Label>
                  <Select value={form.order_id || ''} onValueChange={v => setForm({ ...form, order_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select order" /></SelectTrigger>
                    <SelectContent>{allOrders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.internalPO} — {o.style} ({o.module})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.bom_type === 'stock' && (
                <div>
                  <Label className="text-xs">Stock Job</Label>
                  <Select value={form.order_id || ''} onValueChange={v => setForm({ ...form, order_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select stock job" /></SelectTrigger>
                    <SelectContent>{stockJobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.job_number} - {j.product_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status || 'draft'} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="po_generated">PO Generated</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} /></div>
            </div>

            {/* BOM Lines */}
            <div className="flex items-center justify-between mt-2">
              <h3 className="text-sm font-medium">Material Lines</h3>
              <div className="flex gap-2">
                {lines.length > 0 && editingId && (
                  <Button size="sm" variant="secondary" onClick={handleGeneratePOs}>
                    <ShoppingBag className="h-3.5 w-3.5 mr-1" /> Generate POs
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" /> Add Line</Button>
              </div>
            </div>

            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No lines yet. Add material lines above.</p>
            ) : (
              <div className="space-y-2">
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-[10px] h-7 w-8">✓</TableHead>
                      <TableHead className="text-[10px] h-7">Category</TableHead>
                      <TableHead className="text-[10px] h-7">Item</TableHead>
                      <TableHead className="text-[10px] h-7">UOM</TableHead>
                      <TableHead className="text-[10px] h-7 text-right">Qty</TableHead>
                      <TableHead className="text-[10px] h-7 text-right">Extra %</TableHead>
                      <TableHead className="text-[10px] h-7 text-right">Rate</TableHead>
                      <TableHead className="text-[10px] h-7 text-right">Amount</TableHead>
                      <TableHead className="text-[10px] h-7">Vendor</TableHead>
                      <TableHead className="text-[10px] h-7 w-8"></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {lines.map((l, i) => (
                        <TableRow key={i} className={selectedLineIdxs.has(i) ? 'bg-primary/5' : ''}>
                          <TableCell className="py-1 px-1">
                            <Checkbox checked={selectedLineIdxs.has(i)} onCheckedChange={() => toggleLineSelect(i)} />
                          </TableCell>
                          <TableCell className="py-1 px-1">
                            <Select value={l.category || 'fabric'} onValueChange={v => updateLine(i, 'category', v)}>
                              <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                              <SelectContent>{(CATEGORIES ?? []).map(c => <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-1 px-1"><Input className="h-7 text-xs w-[120px]" value={l.item_name || ''} onChange={e => updateLine(i, 'item_name', e.target.value)} placeholder="Item name" /></TableCell>
                          <TableCell className="py-1 px-1"><Input className="h-7 text-xs w-[60px]" value={l.uom || ''} onChange={e => updateLine(i, 'uom', e.target.value)} /></TableCell>
                          <TableCell className="py-1 px-1"><Input className="h-7 text-xs w-[70px] text-right" type="number" value={l.quantity || ''} onChange={e => updateLine(i, 'quantity', e.target.value)} /></TableCell>
                          <TableCell className="py-1 px-1"><Input className="h-7 text-xs w-[60px] text-right" type="number" value={l.extra_pct || ''} onChange={e => updateLine(i, 'extra_pct', e.target.value)} /></TableCell>
                          <TableCell className="py-1 px-1"><Input className="h-7 text-xs w-[70px] text-right" type="number" value={l.rate || ''} onChange={e => updateLine(i, 'rate', e.target.value)} /></TableCell>
                          <TableCell className="py-1 px-1 text-xs text-right font-medium">{(l.total_amount || 0).toFixed(2)}</TableCell>
                          <TableCell className="py-1 px-1">
                            <Select value={l.vendor_name || '__none__'} onValueChange={v => updateLine(i, 'vendor_name', v === '__none__' ? '' : v)}>
                              <SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {(vendors ?? []).map((v: any) => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-1 px-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card view */}
                <div className="sm:hidden space-y-2">
                  {lines.map((l, i) => (
                    <Card key={i}><CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={selectedLineIdxs.has(i)} onCheckedChange={() => toggleLineSelect(i)} />
                          <Badge variant="outline" className="text-[10px] capitalize">{l.category}</Badge>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-[10px]">Item</Label><Input className="h-8 text-xs" value={l.item_name} onChange={e => updateLine(i, 'item_name', e.target.value)} /></div>
                        <div><Label className="text-[10px]">UOM</Label><Input className="h-8 text-xs" value={l.uom} onChange={e => updateLine(i, 'uom', e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-[10px]">Qty</Label><Input className="h-8 text-xs" type="number" value={l.quantity || ''} onChange={e => updateLine(i, 'quantity', e.target.value)} /></div>
                        <div><Label className="text-[10px]">Extra %</Label><Input className="h-8 text-xs" type="number" value={l.extra_pct || ''} onChange={e => updateLine(i, 'extra_pct', e.target.value)} /></div>
                        <div><Label className="text-[10px]">Rate</Label><Input className="h-8 text-xs" type="number" value={l.rate || ''} onChange={e => updateLine(i, 'rate', e.target.value)} /></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <Select value={l.vendor_name || ''} onValueChange={v => updateLine(i, 'vendor_name', v)}>
                          <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Vendor" /></SelectTrigger>
                          <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-xs font-medium">₹{(l.total_amount || 0).toFixed(2)}</span>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>

                <div className="flex justify-between items-center pr-2">
                  {selectedLineIdxs.size > 0 && (
                    <span className="text-xs text-muted-foreground">{selectedLineIdxs.size} lines selected</span>
                  )}
                  <span className="text-sm font-medium ml-auto">Total: ₹{lines.reduce((s, l) => s + (Number(l.total_amount) || 0), 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-3 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save BOM'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate PO Confirmation Dialog */}
      <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generate Purchase Orders</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The following vendor-wise POs will be created from selected BOM lines:
          </p>
          <div className="space-y-3 mt-2">
            {selectedVendorGroups.map((g, i) => (
              <Card key={i}><CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{g.vendor}</span>
                  <Badge variant="outline" className="text-[10px]">{g.lines.length} items</Badge>
                </div>
                <div className="space-y-1">
                  {g.lines.map((l, j) => (
                    <div key={j} className="flex justify-between text-xs text-muted-foreground">
                      <span>{l.item_name} ({l.category})</span>
                      <span>₹{(l.total_amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm font-medium mt-2 border-t pt-1">
                  ₹{g.lines.reduce((s: number, l: any) => s + (Number(l.total_amount) || 0), 0).toFixed(2)}
                </div>
              </CardContent></Card>
            ))}
          </div>
          {selectedVendorGroups.some(g => g.vendor === 'Unassigned') && (
            <p className="text-xs text-destructive">⚠ Some lines have no vendor. Please assign vendors first.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => generatePOMutation.mutate()}
              disabled={generatePOMutation.isPending || selectedVendorGroups.some(g => g.vendor === 'Unassigned')}
            >
              {generatePOMutation.isPending ? 'Creating...' : `Create ${selectedVendorGroups.filter(g => g.vendor !== 'Unassigned').length} PO(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
