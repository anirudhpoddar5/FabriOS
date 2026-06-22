import { useState, useMemo, Fragment, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Plus, Search, PackageCheck, Printer, ClipboardList, AlertTriangle, CheckSquare, Trash2, X } from 'lucide-react';
import DataTablePagination from '@/components/DataTablePagination';
import { usePagination } from '@/hooks/use-pagination';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { printDetailPage } from '@/lib/pdf-export';

const GRN_STATUS_COLORS: Record<string, string> = {
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  accepted_with_damage: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  draft: 'bg-muted text-muted-foreground',
};

interface GrnLineForm {
  id: string;
  item_id: string;
  item_name: string;
  qty_ordered: number;
  qty_received: number;
  qty_accepted: number;
  qty_rejected: number;
  rejection_reason: string;
  uom: string;
  lot_number: string;
  batch_number: string;
  po_line_id: string;
  remarks: string;
}

function emptyLine(): GrnLineForm {
  return {
    id: crypto.randomUUID(), item_id: '', item_name: '',
    qty_ordered: 0, qty_received: 0, qty_accepted: 0, qty_rejected: 0,
    rejection_reason: '', uom: 'meters', lot_number: '', batch_number: '',
    po_line_id: '', remarks: '',
  };
}

export default function GRNPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [lines, setLines] = useState<GrnLineForm[]>([]);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const action = searchParams.get('action');
    const poId = searchParams.get('po_id');
    const vendorId = searchParams.get('vendor_id');
    if (action === 'new' || poId) {
      const grnNumber = `GRN-${Date.now().toString(36).toUpperCase()}`;
      setForm({ grn_number: grnNumber, vendor_id: vendorId || '', po_id: poId || '', grn_date: new Date().toISOString().slice(0, 10), remarks: '' });
      setLines([emptyLine()]);
      setDialogOpen(true);
      if (poId) {
        setTimeout(() => loadPOLines(poId), 300);
      }
    }
  }, []);

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

  const { data: pos = [] } = useQuery({
    queryKey: ['purchase_orders_grn', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('purchase_orders').select('*').eq('company_id', companyId).neq('status', 'cancelled').order('po_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const filteredVendorPos = useMemo(() => {
    if (!form.vendor_id) return [];
    return pos.filter((p: any) => p.vendor_id === form.vendor_id);
  }, [pos, form.vendor_id]);

  const loadPOLines = useCallback(async (poId: string) => {
    const { data: poLines } = await supabase.from('purchase_order_lines').select('*').eq('po_id', poId);
    if (poLines && poLines.length > 0) {
      const totalOrdered = poLines.reduce((s, l: any) => s + l.qty_ordered, 0);
      const totalReceived = poLines.reduce((s, l: any) => s + (l.qty_received || 0), 0);
      setLines(poLines.map((l: any) => ({
        id: crypto.randomUUID(),
        item_id: l.item_id || '',
        item_name: l.item_name,
        qty_ordered: l.qty_ordered,
        qty_received: Math.max(0, l.qty_ordered - (l.qty_received || 0)),
        qty_accepted: Math.max(0, l.qty_ordered - (l.qty_received || 0)),
        qty_rejected: 0,
        rejection_reason: '',
        uom: l.uom || 'meters',
        lot_number: '',
        batch_number: '',
        po_line_id: l.id,
        remarks: '',
      })));
      const balance = totalOrdered - totalReceived;
      toast.info(`PO has ${balance > 0 ? balance : '0'} units pending receipt`);
      if (totalReceived >= totalOrdered) {
        toast.warning('This PO is already fully received. Consider creating a debit/credit note for excess.');
      }
    } else {
      setLines([emptyLine()]);
    }
  }, []);

  const computeStatus = useCallback((): string => {
    if (lines.length === 0) return 'accepted';
    const allAccepted = lines.every(l => l.qty_received === l.qty_accepted && l.qty_rejected === 0);
    const anyRejected = lines.some(l => l.qty_rejected > 0);
    const allRejected = lines.every(l => l.qty_accepted === 0 && l.qty_rejected > 0);
    const reduced = lines.some(l => l.qty_accepted < l.qty_received || l.qty_rejected > 0);

    if (allRejected) return 'rejected';
    if (!allAccepted && reduced) return 'partial';
    if (anyRejected) return 'accepted_with_damage';
    return 'accepted';
  }, [lines]);

  const saveGRN = useMutation({
    mutationFn: async () => {
      const status = computeStatus();
      const { data: grn, error } = await supabase.from('grn_headers')
        .insert({ grn_number: form.grn_number, po_id: form.po_id || null, vendor_id: form.vendor_id || null, grn_date: form.grn_date, status, remarks: form.remarks, company_id: companyId })
        .select().single();
      if (error) throw error;
      const validLines = lines.filter(l => l.qty_received > 0);
      if (validLines.length > 0) {
        const { error: lineError } = await supabase.from('grn_lines')
          .insert(validLines.map(l => ({
            grn_id: grn.id, item_id: l.item_id || null, item_name: l.item_name,
            qty_received: l.qty_accepted,
            uom: l.uom, lot_number: l.lot_number, batch_number: l.batch_number,
            po_line_id: l.po_line_id || null,
            remarks: l.qty_rejected > 0
              ? `Rejected ${l.qty_rejected} ${l.uom} - ${l.rejection_reason || 'Quality issue'}${l.remarks ? '; ' + l.remarks : ''}`
              : l.remarks || null,
          })));
        if (lineError) throw lineError;
        for (const l of validLines) {
          if (l.item_id) {
            await supabase.from('stock_transactions').insert({
              company_id: companyId, item_id: l.item_id, txn_type: 'inward', txn_date: form.grn_date,
              qty: l.qty_accepted, vendor_id: form.vendor_id || null, grn_id: grn.id,
              lot_number: l.lot_number, batch_number: l.batch_number, uom: l.uom,
            });
          }
          if (l.po_line_id && l.qty_accepted > 0) {
            const { data: pol } = await supabase.from('purchase_order_lines').select('qty_received').eq('id', l.po_line_id).single();
            const prevReceived = pol?.qty_received || 0;
            await supabase.from('purchase_order_lines').update({ qty_received: prevReceived + l.qty_accepted }).eq('id', l.po_line_id);
          }
        }
      }
      const totalOrdered = lines.reduce((s, l) => s + l.qty_ordered, 0);
      const totalAccepted = validLines.reduce((s, l) => s + l.qty_accepted, 0);
      const totalRejected = validLines.reduce((s, l) => s + l.qty_rejected, 0);
      if (totalOrdered > 0 && totalAccepted + totalRejected >= totalOrdered) {
        await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', form.po_id);
      } else if (totalAccepted > 0) {
        await supabase.from('purchase_orders').update({ status: 'partial' }).eq('id', form.po_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn_headers'] });
      qc.invalidateQueries({ queryKey: ['stock_transactions'] });
      qc.invalidateQueries({ queryKey: ['inventory_items_grn'] });
      qc.invalidateQueries({ queryKey: ['purchase_orders_grn'] });
      qc.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('GRN recorded');
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleAdd = () => {
    setForm({ grn_number: `GRN-${Date.now().toString(36).toUpperCase()}`, vendor_id: '', po_id: '', grn_date: new Date().toISOString().slice(0, 10), remarks: '' });
    setLines([emptyLine()]);
    setDialogOpen(true);
  };

  const handleVendorChange = (v: string) => {
    setForm((p: any) => ({ ...p, vendor_id: v, po_id: '' }));
    setLines([emptyLine()]);
  };

  const handlePOChange = (poId: string) => {
    setForm((p: any) => ({ ...p, po_id: poId }));
    if (poId) loadPOLines(poId);
    else setLines([emptyLine()]);
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);

  const updateLine = (idx: number, field: keyof GrnLineForm, value: any) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'qty_accepted' || field === 'qty_rejected') {
        const line = updated[idx];
        const total = (line.qty_accepted || 0) + (line.qty_rejected || 0);
        updated[idx].qty_received = Math.min(total, line.qty_ordered);
      }
      return updated;
    });
  };

  const filtered = useMemo(() => {
    return grns.filter((g: any) => {
      if (vendorFilter !== 'all' && g.vendor_id !== vendorFilter) return false;
      if (dateFrom && g.grn_date && g.grn_date < dateFrom) return false;
      if (dateTo && g.grn_date && g.grn_date > dateTo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!g.grn_number?.toLowerCase().includes(s) && !(g as any).vendors?.name?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [grns, search, vendorFilter, dateFrom, dateTo]);

  const pagination = usePagination(filtered, 50);

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { label: string; items: typeof filtered }> = {};
    for (const g of pagination.pageItems) {
      const month = g.grn_date ? g.grn_date.slice(0, 7) : '__no_date__';
      if (!groups[month]) groups[month] = { label: month === '__no_date__' ? 'No Date' : month, items: [] };
      groups[month].items.push(g);
    }
    return groups;
  }, [pagination.pageItems]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === pagination.pageItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pagination.pageItems.map((g: any) => g.id)));
  };
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} GRN(s)?`)) return;
    try {
      for (const id of selectedIds) {
        await supabase.from('grn_lines').delete().eq('grn_id', id);
        await supabase.from('grn_headers').delete().eq('id', id);
      }
      qc.invalidateQueries({ queryKey: ['grn_headers'] });
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} GRN(s) deleted`);
    } catch (err: any) { toast.error(`Delete failed: ${err.message}`); }
  };

  const printFiltered = () => {
    printDetailPage(`GRN Records (${filtered.length})`, [
      { label: 'Filter', value: vendorFilter !== 'all' ? `Vendor selected` : 'All vendors' },
      { label: 'Total GRNs', value: String(filtered.length) },
    ], [
      {
        title: 'Goods Receipt Notes',
        headers: ['GRN #', 'Vendor', 'PO #', 'Date', 'Status'],
        rows: filtered.map((g: any) => [g.grn_number, (g as any).vendors?.name || '—', (g as any).purchase_orders?.po_number || '—', g.grn_date || '—', g.status]),
      },
    ]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Goods Receipt (GRN)</h1>
        <Button size="sm" onClick={handleAdd}><PackageCheck className="h-3.5 w-3.5 mr-1" /> New GRN</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search GRNs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Vendor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[130px] text-xs" placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[130px] text-xs" placeholder="To" />
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={printFiltered} title="Print filtered"><Printer className="h-3.5 w-3.5" /></Button>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} GRN{filtered.length !== 1 ? 's' : ''}</span>
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
            <TableHead className="text-xs h-8">GRN #</TableHead>
            <TableHead className="text-xs h-8">Vendor</TableHead>
            <TableHead className="text-xs h-8">PO #</TableHead>
            <TableHead className="text-xs h-8">Date</TableHead>
            <TableHead className="text-xs h-8">Status</TableHead>
            <TableHead className="text-xs h-8">Remarks</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No GRN records yet</p>
                  <p className="text-xs text-muted-foreground/60 max-w-xs">Record goods receipts when materials arrive from vendors. Click "New GRN" to start.</p>
                </div>
              </TableCell></TableRow>
            ) : Object.entries(monthlyGroups).map(([monthKey, group]) => (
              <Fragment key={monthKey}>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={7} className="text-[11px] font-semibold py-1.5 px-3">
                    {monthKey === '__no_date__' ? 'No Date' : new Date(monthKey + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    <span className="text-muted-foreground font-normal ml-2">({group.items.length} record{group.items.length !== 1 ? 's' : ''})</span>
                  </TableCell>
                </TableRow>
                {group.items.map((g: any) => (
                  <TableRow key={g.id} className={selectedIds.has(g.id) ? 'bg-primary/5' : 'cursor-pointer'} onClick={() => navigate(`/grn/${g.id}`)}>
                    <TableCell className="py-2 px-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="accent-primary" checked={selectedIds.has(g.id)} onChange={() => toggleSelect(g.id)} />
                    </TableCell>
                    <TableCell className="text-sm py-2 font-medium">{g.grn_number}</TableCell>
                    <TableCell className="text-sm py-2">{(g as any).vendors?.name || '-'}</TableCell>
                    <TableCell className="text-sm py-2">{(g as any).purchase_orders?.po_number || '-'}</TableCell>
                    <TableCell className="text-sm py-2">{g.grn_date}</TableCell>
                    <TableCell className="py-2"><Badge className={`text-[10px] ${GRN_STATUS_COLORS[g.status] || ''}`}>{g.status}</Badge></TableCell>
                    <TableCell className="text-sm py-2 text-muted-foreground">{g.remarks || '-'}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <DataTablePagination {...pagination} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Goods Receipt</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label className="text-xs">GRN #</Label><Input value={form.grn_number || ''} onChange={e => setForm({ ...form, grn_number: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Vendor *</Label>
                <Select value={form.vendor_id || ''} onValueChange={handleVendorChange}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">PO Reference</Label>
                <Select value={form.po_id || ''} onValueChange={handlePOChange} disabled={!form.vendor_id}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={form.vendor_id ? 'Select PO' : 'Select vendor first'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No PO (Direct)</SelectItem>
                    {filteredVendorPos.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.po_number} — {p.status} (₹{p.total_amount || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Date *</Label><Input type="date" value={form.grn_date || ''} onChange={e => setForm({ ...form, grn_date: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} /></div>

            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Items Received</Label>
                <div className="flex gap-2">
                  {form.po_id && (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => loadPOLines(form.po_id)}>
                      Reload from PO
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
                </div>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-[10px] h-7">Item</TableHead>
                    <TableHead className="text-[10px] h-7 text-right">Ord Qty</TableHead>
                    <TableHead className="text-[10px] h-7 text-right">Accepted</TableHead>
                    <TableHead className="text-[10px] h-7 text-right">Rejected</TableHead>
                    <TableHead className="text-[10px] h-7">Rejection Reason</TableHead>
                    <TableHead className="text-[10px] h-7">UOM</TableHead>
                    <TableHead className="text-[10px] h-7">Lot</TableHead>
                    <TableHead className="text-[10px] h-7">Batch</TableHead>
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
                            <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Select item" /></SelectTrigger>
                            <SelectContent>
                              {items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.name}{it.code ? ` (${it.code})` : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1 text-xs text-right text-muted-foreground">{l.qty_ordered || '—'}</TableCell>
                        <TableCell className="py-1">
                          <Input type="number" min={0} max={l.qty_ordered || 0}
                            value={l.qty_accepted || ''}
                            onChange={e => updateLine(i, 'qty_accepted', Number(e.target.value) || 0)}
                            className="h-7 text-xs w-[80px] text-right" />
                        </TableCell>
                        <TableCell className="py-1">
                          <Input type="number" min={0}
                            value={l.qty_rejected || ''}
                            onChange={e => updateLine(i, 'qty_rejected', Number(e.target.value) || 0)}
                            className="h-7 text-xs w-[80px] text-right" />
                        </TableCell>
                        <TableCell className="py-1">
                          <Select value={l.rejection_reason || ''} onValueChange={v => updateLine(i, 'rejection_reason', v)}>
                            <SelectTrigger className={`h-7 text-xs w-[120px] ${l.qty_rejected > 0 && !l.rejection_reason ? 'border-destructive' : ''}`}>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                              <SelectItem value="wrong_spec">Wrong Spec</SelectItem>
                              <SelectItem value="quality_issue">Quality Issue</SelectItem>
                              <SelectItem value="short_qty">Short Quantity</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1"><Input value={l.uom || 'meters'} onChange={e => { const u = [...lines]; u[i] = { ...l, uom: e.target.value }; setLines(u); }} className="h-7 text-xs w-[70px]" /></TableCell>
                        <TableCell className="py-1"><Input value={l.lot_number || ''} onChange={e => { const u = [...lines]; u[i] = { ...l, lot_number: e.target.value }; setLines(u); }} className="h-7 text-xs w-[80px]" /></TableCell>
                        <TableCell className="py-1"><Input value={l.batch_number || ''} onChange={e => { const u = [...lines]; u[i] = { ...l, batch_number: e.target.value }; setLines(u); }} className="h-7 text-xs w-[80px]" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {lines.length > 0 && (
                <div className="flex items-center justify-between mt-2 px-1">
                  <div className="flex items-center gap-4 text-xs">
                    <span>Status: <Badge className={`text-[10px] ${GRN_STATUS_COLORS[computeStatus()] || ''}`}>{computeStatus()}</Badge></span>
                    <span>Total accepted: <strong>{lines.reduce((s, l) => s + l.qty_accepted, 0)}</strong></span>
                    {lines.some(l => l.qty_rejected > 0) && (
                      <span className="text-destructive">Total rejected: <strong>{lines.reduce((s, l) => s + l.qty_rejected, 0)}</strong></span>
                    )}
                    {lines.some(l => l.qty_received < l.qty_ordered) && (
                      <span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3 w-3" /> Partial receipt</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveGRN.mutate()}>
              {saveGRN.isPending ? 'Saving...' : `Save GRN (${computeStatus()})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
