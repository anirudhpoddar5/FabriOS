import { useState, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Search, Printer, FileDown, CheckSquare, X, Trash2, ShoppingCart, Pencil, ArrowRight } from 'lucide-react';
import DataTablePagination from '@/components/DataTablePagination';
import { usePagination } from '@/hooks/use-pagination';
import { toast } from 'sonner';
import { COMPACT_INPUT, COMPACT_NUMBER } from '@/lib/compact-input';
import { useQueryClient } from '@tanstack/react-query';
import { printDetailPage } from '@/lib/pdf-export';
import { createQuotationWithLines } from '@/lib/quotation-save';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-gray-200 text-gray-600',
};

const QUOTATION_LINE_EMPTY = () => ({
  id: crypto.randomUUID(),
  productId: '',
  description: '',
  qty: 0,
  uom: 'pcs',
  rate: 0,
  amount: 0,
  sortOrder: 0,
});

// Next number = max existing "Q-####" + 1, not count of records — count breaks
// as soon as a quotation is deleted (gap) or numbers don't start at 1.
function computeNextQuotationNumber(numbers: Array<string | null | undefined>): string {
  let max = 0;
  for (const n of numbers) {
    const m = /^Q-(\d+)$/.exec(n || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `Q-${String(max + 1).padStart(4, '0')}`;
}

// Fresh DB read right before insert — local appData.quotations can be stale
// (dialog closes before the post-save refreshData() resolves), which is how
// two back-to-back saves can compute the same "next" number.
async function fetchNextQuotationNumber(companyId: string): Promise<string> {
  const { data } = await supabase.from('quotations').select('quotation_number').eq('company_id', companyId);
  return computeNextQuotationNumber((data || []).map(r => r.quotation_number));
}

export default function QuotationsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const { data: appData, addItem, updateItem, refreshData } = useData();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [lines, setLines] = useState<any[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const quotations = appData.quotations;
  const quotationLines = appData.quotationLines;

  const buyers = appData.buyers.filter((b: any) => b.active !== false);

  const filtered = useMemo(() => {
    let list = [...quotations];
    if (buyerFilter !== 'all') list = list.filter((q: any) => q.buyerId === buyerFilter);
    if (statusFilter !== 'all') list = list.filter((q: any) => q.status === statusFilter);
    if (dateFrom) list = list.filter((q: any) => q.date >= dateFrom);
    if (dateTo) list = list.filter((q: any) => q.date <= dateTo);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((q: any) =>
        q.quotationNumber?.toLowerCase().includes(s) ||
        buyers.find((b: any) => b.id === q.buyerId)?.name?.toLowerCase().includes(s)
      );
    }
    return list.sort((a: any, b: any) => b.date?.localeCompare(a.date));
  }, [quotations, search, buyerFilter, statusFilter, dateFrom, dateTo]);

  const pagination = usePagination(filtered, 50);

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { label: string; items: typeof filtered }> = {};
    for (const q of pagination.pageItems) {
      const month = q.date ? q.date.slice(0, 7) : '__no_date__';
      if (!groups[month]) groups[month] = { label: month === '__no_date__' ? 'No Date' : month, items: [] };
      groups[month].items.push(q);
    }
    return groups;
  }, [pagination.pageItems]);

  const handleAdd = () => {
    setEditingId(null);
    const nextNum = computeNextQuotationNumber(quotations.map((q: any) => q.quotationNumber));
    setForm({
      quotationNumber: nextNum,
      buyerId: '',
      date: new Date().toISOString().slice(0, 10),
      validUntil: '',
      currency: 'USD',
      taxPercent: 0,
      subtotal: 0,
      remarks: '',
    });
    setLines([{ ...QUOTATION_LINE_EMPTY(), sortOrder: 0 }]);
    setDialogOpen(true);
  };

  const handleEdit = (q: any) => {
    setEditingId(q.id);
    setForm({
      quotationNumber: q.quotationNumber,
      buyerId: q.buyerId || '',
      date: q.date,
      validUntil: q.validUntil || '',
      currency: q.currency,
      taxPercent: q.taxPercent || 0,
      subtotal: q.subtotal,
      remarks: q.remarks || '',
    });
    const qLines = quotationLines.filter((l: any) => l.quotationId === q.id);
    setLines(qLines.length > 0
      ? qLines.map((l: any) => ({ ...l }))
      : [{ ...QUOTATION_LINE_EMPTY(), sortOrder: 0 }]
    );
    setDialogOpen(true);
  };

  const addLine = () => {
    setLines(prev => [...prev, { ...QUOTATION_LINE_EMPTY(), sortOrder: prev.length }]);
  };

  const updateLine = (idx: number, field: string, value: any) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'qty' || field === 'rate') {
        updated[idx].amount = (Number(updated[idx].qty) || 0) * (Number(updated[idx].rate) || 0);
      }
      return updated;
    });
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const lineSubtotal = useMemo(() => {
    return lines.reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0);
  }, [lines]);

  const handleSave = async () => {
    if (!form.quotationNumber) { toast.error('Quotation number required'); return; }
    if (lines.length === 0 || !lines[0].description) { toast.error('At least one line item required'); return; }

    const payload: Record<string, any> = {
      quotationNumber: form.quotationNumber,
      buyerId: form.buyerId || null,
      date: form.date,
      validUntil: form.validUntil || null,
      currency: form.currency,
      taxPercent: Number(form.taxPercent) || 0,
      subtotal: lineSubtotal,
      remarks: form.remarks || null,
      status: 'draft',
    };

    if (editingId) {
      const { error } = await updateItem('quotations', editingId, payload);
      if (error) { toast.error(error); return; }

      // Replace lines the safe way: insert the new set (fresh ids, one batch
      // insert) FIRST, and only delete the old rows once every new one is in.
      // If the insert fails partway, the ORIGINAL lines are still there —
      // nothing is lost. The old code deleted first and inserted in a loop,
      // so a failed insert left the quotation with no lines at all.
      const newRows = lines
        .filter((l: any) => l.description)
        .map((l: any, i: number) => ({
          id: crypto.randomUUID(),
          quotation_id: editingId,
          product_id: l.productId || null,
          description: l.description,
          qty: Number(l.qty) || 0,
          uom: l.uom || 'pcs',
          rate: Number(l.rate) || 0,
          sort_order: i,
        }));
      if (newRows.length > 0) {
        const { error: insErr } = await supabase.from('quotation_lines').insert(newRows);
        if (insErr) { toast.error(`Line items were not saved — your original items are untouched: ${insErr.message}`); return; }
      }
      // Delete by quotation_id, excluding the rows just inserted. Deleting by cached
      // ids would miss any row the local cache does not know about (this page never
      // refreshes appData after a save), silently leaving duplicates behind.
      const keepIds = newRows.map(r => r.id);
      const delQuery = supabase.from('quotation_lines').delete().eq('quotation_id', editingId);
      const { error: delErr } = keepIds.length > 0
        ? await delQuery.not('id', 'in', `(${keepIds.join(',')})`)
        : await delQuery;
      if (delErr) {
        toast.error(`Saved, but the old line items could not be removed — you may see duplicates. Refresh and remove them manually: ${delErr.message}`);
      }
      qc.invalidateQueries({ queryKey: ['quotations'] });
      await refreshData();
      toast.success('Quotation updated');
    } else {
      if (!companyId) { toast.error('Company details are missing. Please sign in again.'); return; }
      setSaving(true);
      try {
        const header = {
          company_id: companyId,
          quotation_number: payload.quotationNumber,
          buyer_id: payload.buyerId,
          date: payload.date,
          valid_until: payload.validUntil,
          currency: payload.currency,
          tax_percent: payload.taxPercent,
          subtotal: payload.subtotal,
          remarks: payload.remarks,
          status: payload.status,
        };
        const rows = lines.map((line, index) => ({ ...line, sortOrder: index }));
        const insertHeader = async (h: typeof header) => {
          const { data: created, error } = await supabase.from('quotations').insert(h).select('id').single();
          if (error) throw error;
          return created.id;
        };
        const insertLines = async (quotationLines: any) => {
          const { error } = await supabase.from('quotation_lines').insert(quotationLines);
          if (error) throw error;
        };
        try {
          await createQuotationWithLines(header, rows, insertHeader, insertLines);
        } catch (err: any) {
          // Unique-violation on (company_id, quotation_number): someone else (or
          // a stale local suggestion) grabbed this number first — regenerate
          // from a fresh DB read and retry once.
          if (err.code === '23505') {
            header.quotation_number = await fetchNextQuotationNumber(companyId);
            await createQuotationWithLines(header, rows, insertHeader, insertLines);
          } else {
            throw err;
          }
        }
        qc.invalidateQueries({ queryKey: ['quotations'] });
        toast.success('Quotation saved with its items');
      } catch (err: any) {
        toast.error(`Quotation was not saved: ${err.message}`);
        return;
      } finally {
        setSaving(false);
      }
    }
    setDialogOpen(false);
    await refreshData();
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await updateItem('quotations', id, { status: newStatus } as any);
    if (error) toast.error(error);
    else toast.success(`Quotation ${newStatus}`);
  };

  const convertToOrder = async (q: any) => {
    setConvertingId(q.id);
    try {
      const qLines = quotationLines.filter((l: any) => l.quotationId === q.id && l.description);
      // Quotations have no module field of their own — conversion has always targeted printing.
      const payload = {
        module: 'printing',
        header: {
          buyer_id: q.buyerId || null,
          currency: q.currency,
          status: 'Started',
          internal_po: `PO-${q.quotationNumber}`,
        },
        rows: qLines.map((l: any, i: number) => ({
          id: crypto.randomUUID(),
          product_id: l.productId || null,
          uom: l.uom || 'pcs',
          order_qty: Number(l.qty) || 0,
          // chart qty is a separate production figure, not the ordered qty —
          // leave it 0 (as a manually created order does) rather than invent it
          chart_qty: 0,
          rate_per_item: Number(l.rate) || 0,
          no_of_colours: 1,
          sort_order: i,
          // A quotation line has no colour breakdown — emit one default
          // colourway carrying the row's full qty, otherwise the order is
          // saved with zero colourways and progress tracking stays at 0%.
          colourways: [{
            id: crypto.randomUUID(),
            colour_name: 'Default',
            ordered_qty: Number(l.qty) || 0,
            uom: l.uom || 'pcs',
            size: null,
            notes: null,
            sort_order: 0,
          }],
        })),
      };

      const { data: newOrderId, error: oErr } = await supabase.rpc('save_order_with_rows_and_colourways', { payload });
      if (oErr) { toast.error(`Order was not created: ${oErr.message}`); return; }

      // The RPC's payload contract has no field for order_headers.quotation_id
      // (it isn't part of save_order_with_rows_and_colourways), so patch that
      // single column directly — this is a single-table, single-row update,
      // not a re-introduction of the sequential multi-table insert pattern.
      const { error: linkErr } = await supabase.from('order_headers').update({ quotation_id: q.id }).eq('id', newOrderId as string);
      if (linkErr) toast.warning('Order created, but it could not be linked back to this quotation.');

      const { error: sErr } = await updateItem('quotations', q.id, { status: 'accepted' } as any);
      qc.invalidateQueries({ queryKey: ['order_headers'] });
      await refreshData();
      if (sErr) {
        // don't also claim success and navigate away — this warning is the one
        // that stops them converting the same quotation a second time
        toast.error(`Order was created, but the quotation could not be marked accepted (${sErr}) — do not convert it again.`);
        return;
      }
      toast.success('Order created from quotation');
      navigate(`/printing-orders/${newOrderId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      // must be finally — the early returns above would otherwise leave the
      // Convert button stuck disabled for the rest of the session
      setConvertingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === pagination.pageItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pagination.pageItems.map((q: any) => q.id)));
  };
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} quotation(s)?`)) return;
    for (const id of selectedIds) {
      const { error: le } = await supabase.from('quotation_lines').delete().eq('quotation_id', id);
      if (le) { toast.error(`Delete failed: ${le.message}`); return; }
      const { error: he } = await supabase.from('quotations').delete().eq('id', id);
      if (he) { toast.error(`Delete failed: ${he.message}`); return; }
    }
    qc.invalidateQueries({ queryKey: ['quotations'] });
    await refreshData();
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} quotation(s) deleted`);
  };

  const printFiltered = () => {
    printDetailPage(`Quotations (${filtered.length})`, [
      { label: 'Filter', value: statusFilter !== 'all' ? `Status: ${statusFilter}` : 'All' },
      { label: 'Total', value: String(filtered.length) },
    ], [
      {
        title: 'Quotations',
        headers: ['Quote #', 'Buyer', 'Date', 'Valid Until', 'Status', 'Total'],
        rows: filtered.map((q: any) => [
          q.quotationNumber,
          buyers.find((b: any) => b.id === q.buyerId)?.name || '—',
          q.date || '—',
          q.validUntil || '—',
          q.status,
          `${q.currency} ${Number(q.total).toFixed(2)}`,
        ]),
      },
    ]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Quotations</h1>
        <Button size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> New Quotation</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search quotations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={buyerFilter} onValueChange={setBuyerFilter}>
          <SelectTrigger className={`${COMPACT_INPUT} h-9 w-[140px]`}><SelectValue placeholder="Buyer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buyers</SelectItem>
            {buyers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={`${COMPACT_INPUT} h-9 w-[140px]`} placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={`${COMPACT_INPUT} h-9 w-[140px]`} placeholder="To" />
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={printFiltered} title="Print"><Printer className="h-3.5 w-3.5" /></Button>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} quotation{filtered.length !== 1 ? 's' : ''}</span>
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
            <TableHead className="text-xs h-8">Quote #</TableHead>
            <TableHead className="text-xs h-8">Buyer</TableHead>
            <TableHead className="text-xs h-8">Date</TableHead>
            <TableHead className="text-xs h-8">Valid Until</TableHead>
            <TableHead className="text-xs h-8">Status</TableHead>
            <TableHead className="text-xs h-8 text-right">Total</TableHead>
            <TableHead className="text-xs h-8 w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {pagination.pageItems.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No quotations yet</p>
                <p className="text-xs text-muted-foreground/60">Create a quotation to start the sales process.</p>
              </TableCell></TableRow>
            ) : Object.entries(monthlyGroups).map(([monthKey, group]) => (
              <Fragment key={monthKey}>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={8} className="text-[11px] font-semibold py-1.5 px-3">
                    {monthKey === '__no_date__' ? 'No Date' : new Date(monthKey + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    <span className="text-muted-foreground font-normal ml-2">({group.items.length})</span>
                  </TableCell>
                </TableRow>
                {group.items.map((q: any) => (
                  <TableRow key={q.id} className={selectedIds.has(q.id) ? 'bg-primary/5' : ''}>
                    <TableCell className="py-2 px-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="accent-primary" checked={selectedIds.has(q.id)} onChange={() => toggleSelect(q.id)} />
                    </TableCell>
                    <TableCell className="text-sm py-2 font-medium">{q.quotationNumber}</TableCell>
                    <TableCell className="text-sm py-2">{buyers.find((b: any) => b.id === q.buyerId)?.name || '-'}</TableCell>
                    <TableCell className="text-sm py-2">{q.date}</TableCell>
                    <TableCell className="text-sm py-2">{q.validUntil || '-'}</TableCell>
                    <TableCell className="py-2">
                      <Select value={q.status} onValueChange={v => handleStatusChange(q.id, v)}>
                        <SelectTrigger className={`h-7 text-[10px] w-[90px] ${STATUS_COLORS[q.status] || ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm py-2 text-right font-medium">{q.currency} {Number(q.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(q)} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {q.status === 'accepted' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => convertToOrder(q)} disabled={convertingId === q.id} title="Convert to Order">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'New'} Quotation</DialogTitle></DialogHeader>
          <div className="grid gap-3 min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label className="text-xs">Quote # *</Label><Input value={form.quotationNumber || ''} onChange={e => setForm({ ...form, quotationNumber: e.target.value })} className="h-9" /></div>
              <div>
                <Label className="text-xs">Buyer</Label>
                <Select value={form.buyerId || ''} onValueChange={v => setForm({ ...form, buyerId: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select buyer" /></SelectTrigger>
                  <SelectContent>
                    {buyers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} className="h-9" /></div>
              <div><Label className="text-xs">Valid Until</Label><Input type="date" value={form.validUntil || ''} onChange={e => setForm({ ...form, validUntil: e.target.value })} className="h-9" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency || 'USD'} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Tax %</Label><Input type="number" min={0} step={0.01} value={form.taxPercent || ''} onChange={e => setForm({ ...form, taxPercent: Number(e.target.value) || 0 })} className="h-9" /></div>
            </div>
            <div><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} className="h-9" /></div>

            {/* Line items */}
            <div className="mt-2 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Line Items</Label>
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-[10px] h-7">Product</TableHead>
                    <TableHead className="text-[10px] h-7">Description *</TableHead>
                    <TableHead className="text-[10px] h-7 text-right">Qty</TableHead>
                    <TableHead className="text-[10px] h-7">UOM</TableHead>
                    <TableHead className="text-[10px] h-7 text-right">Rate</TableHead>
                    <TableHead className="text-[10px] h-7 text-right">Amount</TableHead>
                    <TableHead className="text-[10px] h-7 w-8"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={l.id}>
                        <TableCell className="py-1">
                          <Input value={l.productId || ''} onChange={e => updateLine(i, 'productId', e.target.value)} placeholder="SKU" className={`${COMPACT_INPUT} w-[60px]`} />
                        </TableCell>
                        <TableCell className="py-1">
                          <Input value={l.description || ''} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Item description" className={`${COMPACT_INPUT} w-[180px]`} />
                        </TableCell>
                        <TableCell className="py-1">
                          <Input type="number" min={0} value={l.qty || ''} onChange={e => updateLine(i, 'qty', Number(e.target.value) || 0)} className={`${COMPACT_NUMBER} w-[70px]`} />
                        </TableCell>
                        <TableCell className="py-1">
                          <Input value={l.uom || 'pcs'} onChange={e => updateLine(i, 'uom', e.target.value)} className={`${COMPACT_INPUT} w-[50px]`} />
                        </TableCell>
                        <TableCell className="py-1">
                          <Input type="number" min={0} step={0.01} value={l.rate || ''} onChange={e => updateLine(i, 'rate', Number(e.target.value) || 0)} className={`${COMPACT_NUMBER} w-[80px]`} />
                        </TableCell>
                        <TableCell className="text-xs py-1 text-right font-medium">{(Number(l.amount) || 0).toFixed(2)}</TableCell>
                        <TableCell className="py-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-end gap-4 mt-2 text-xs">
                <span>Subtotal: <strong>{form.currency} {lineSubtotal.toFixed(2)}</strong></span>
                {Number(form.taxPercent) > 0 && (
                  <span>Tax ({form.taxPercent}%): <strong>{form.currency} {(lineSubtotal * Number(form.taxPercent) / 100).toFixed(2)}</strong></span>
                )}
                <span>Total: <strong className="text-base">{form.currency} {(lineSubtotal + (lineSubtotal * Number(form.taxPercent) / 100)).toFixed(2)}</strong></span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
