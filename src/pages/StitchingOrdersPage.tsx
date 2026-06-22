import { useState, useMemo, Fragment, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { Search, Plus, Pencil, Trash2, GripVertical, AlertTriangle, Printer } from 'lucide-react';
import DataTablePagination from '../components/DataTablePagination';
import { usePagination } from '../hooks/use-pagination';
import { toast } from 'sonner';
import { DatePickerField } from '../components/DatePickerField';
import { getOrderBadge } from '../lib/order-status';
import { printDetailPage } from '../lib/pdf-export';
import type { OrderStatus } from '../types';

const generateId = () => crypto.randomUUID();

const emptyRow = (sortOrder: number) => ({
  _key: generateId(),
  sortOrder,
  stitchingProductId: '',
  fabricId: '',
  uom: 'pcs',
  orderQty: 0,
  chartQty: 0,
  ratePerItem: 0,
  noOfColours: 0,
  colourways: [] as any[],
});

const emptyColour = () => ({
  _key: generateId(),
  colourName: '',
  orderedQty: 0,
  uom: 'pcs',
  size: '',
  notes: '',
});

export default function StitchingOrdersPage() {
  const navigate = useNavigate();
  const { data, refreshData } = useData();
  const { profile: authProfile } = useAuth();
  const companyId = authProfile?.company_id;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('buyerDeliveryDate');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [rows, setRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      handleAdd();
    }
  }, []);

  const orders = data.stitchingOrders;
  const buyers = data.buyers.filter(b => b.active);
  const products = data.stitchingProducts.filter(p => p.active);
  const fabrics = data.fabrics.filter(f => f.active);

  const getBuyer = (id: string) => { const b = data.buyers.find(x => x.id === id); return b ? `${b.code}${b.name ? ' - ' + b.name : ''}` : id; };

  const entryCountMap = useMemo(() => {
    const map = new Map<string, number>();
    data.entries.forEach(e => map.set(e.orderId, (map.get(e.orderId) || 0) + 1));
    return map;
  }, [data.entries]);

  const getProgress = (orderId: string) => {
    const cws = data.stitchingColourways.filter(c => c.orderId === orderId);
    const totalOrdered = cws.reduce((s, c) => s + c.orderedQty, 0);
    const totalProduced = data.entries.filter(e => e.orderId === orderId).reduce((s, e) => s + e.outputQty, 0);
    return { totalOrdered, totalProduced, pct: totalOrdered > 0 ? (totalProduced / totalOrdered) * 100 : 0 };
  };

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const prog = getProgress(o.id);
      const derived = getOrderBadge(o.status, entryCountMap.get(o.id) || 0, o.targetEndDate, prog.pct);
      if (statusFilter !== 'all' && derived.label !== statusFilter) return false;
      if (buyerFilter !== 'all' && o.buyerId !== buyerFilter) return false;
      if (dateFrom && o.buyerDeliveryDate && o.buyerDeliveryDate < dateFrom) return false;
      if (dateTo && o.buyerDeliveryDate && o.buyerDeliveryDate > dateTo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (![o.internalPO ?? '', o.style, o.buyerPO, getBuyer(o.buyerId)].some(v => v?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, buyerFilter, dateFrom, dateTo, entryCountMap, getBuyer, getProgress]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'buyerDeliveryDate') {
        const da = a.buyerDeliveryDate || '9999-12-31';
        const db = b.buyerDeliveryDate || '9999-12-31';
        return da.localeCompare(db);
      }
      if (sortBy === 'targetEndDate') {
        const da = a.targetEndDate || '9999-12-31';
        const db = b.targetEndDate || '9999-12-31';
        return da.localeCompare(db);
      }
      if (sortBy === 'internalPO') return (a.internalPO || '').localeCompare(b.internalPO || '');
      return 0;
    });
  }, [filtered, sortBy]);

  const pagination = usePagination(sorted, 50);

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { label: string; items: typeof sorted; qty: number; value: number }> = {};
    for (const o of pagination.pageItems) {
      const month = o.buyerDeliveryDate ? o.buyerDeliveryDate.slice(0, 7) : '__no_date__';
      if (!groups[month]) groups[month] = { label: month === '__no_date__' ? 'No Date' : month, items: [], qty: 0, value: 0 };
      groups[month].items.push(o);
      groups[month].qty += o.orderQty || 0;
      groups[month].value += (o.orderQty || 0) * ((o as any).ratePerItem || 0);
    }
    return groups;
  }, [pagination.pageItems]);

  const exportFilteredCSV = () => {
    const header = 'Internal PO,Buyer,Style,Qty,UOM,Status,Buyer Delivery Date,Target End Date\n';
    const rows = sorted.map(o => `${o.internalPO},${getBuyer(o.buyerId)},${o.style},${o.orderQty || 0},${o.uom || ''},${o.status},${o.buyerDeliveryDate || ''},${o.targetEndDate || ''}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stitching-orders-filtered.csv'; a.click();
  };

  const printFiltered = () => {
    printDetailPage(`Stitching Orders (${sorted.length})`, [
      { label: 'Total Orders', value: String(sorted.length) },
      { label: 'Total Qty', value: String(sorted.reduce((s, o) => s + (o.orderQty || 0), 0)) },
    ], [
      {
        title: 'Orders',
        headers: ['PO #', 'Buyer', 'Style', 'Qty', 'Status', 'Buyer Delivery'],
        rows: sorted.map(o => [o.internalPO || '—', getBuyer(o.buyerId), o.style || '—', String(o.orderQty || 0), o.status, o.buyerDeliveryDate || '—']),
      },
    ]);
  };

  const nextPO = () => {
    const nums = orders.map(o => { const m = (o.internalPO ?? '').match(/PO-S-(\d+)/); return m ? parseInt(m[1]) : 0; });
    return `PO-S-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`;
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm({ buyerId: '', style: '', internalPO: nextPO(), buyerPO: '', currency: 'USD', targetEndDate: '', buyerDeliveryDate: '', remarks: '', status: 'Started' as OrderStatus });
    setRows([emptyRow(0)]);
    setDialogOpen(true);
  };

  const handleEdit = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setEditingId(order.id);
    setForm({ ...order });

    const { data: dbRows } = await supabase.from('order_rows')
      .select('*')
      .eq('order_id', order.id)
      .order('sort_order', { ascending: true });

    const { data: dbCws } = await supabase.from('order_colourways')
      .select('*')
      .in('order_row_id', (dbRows || []).map(r => r.id))
      .order('sort_order', { ascending: true });

    const loaded = (dbRows || []).map(r => ({
      _key: r.id,
      id: r.id,
      sortOrder: r.sort_order ?? 0,
      stitchingProductId: r.product_id ?? '',
      fabricId: r.fabric_id ?? '',
      uom: r.uom ?? 'pcs',
      orderQty: r.order_qty ?? 0,
      chartQty: r.chart_qty ?? 0,
      ratePerItem: r.rate_per_item ?? 0,
      noOfColours: r.no_of_colours ?? 0,
      colourways: (dbCws || []).filter(c => c.order_row_id === r.id).map(c => ({
        _key: c.id,
        id: c.id,
        colourName: c.colour_name ?? '',
        orderedQty: c.ordered_qty ?? 0,
        uom: c.uom ?? 'pcs',
        size: c.size ?? '',
        notes: c.notes ?? '',
      })),
    }));

    setRows(loaded.length > 0 ? loaded : [emptyRow(0)]);
    setDialogOpen(true);
  };

  const addRow = () => setRows(prev => [...prev, emptyRow(prev.length)]);
  const removeRow = (key: string) => setRows(prev => prev.length > 1 ? prev.filter(r => r._key !== key) : prev);
  const updateRow = (key: string, field: string, value: any) => setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));

  const addColourToRow = (rowKey: string) => setRows(prev => prev.map(r => r._key === rowKey ? { ...r, colourways: [...r.colourways, emptyColour()] } : r));
  const removeColourFromRow = (rowKey: string, cKey: string) => setRows(prev => prev.map(r => r._key === rowKey ? { ...r, colourways: r.colourways.filter((c: any) => c._key !== cKey) } : r));
  const updateColourInRow = (rowKey: string, cKey: string, field: string, value: any) => setRows(prev => prev.map(r => r._key === rowKey ? { ...r, colourways: r.colourways.map((c: any) => c._key === cKey ? { ...c, [field]: value } : c) } : r));

  const moveRow = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next.map((r, i) => ({ ...r, sortOrder: i })));
  };

  const totalRowQty = rows.reduce((s, r) => s + (Number(r.orderQty) || 0), 0);
  const totalChartQty = rows.reduce((s, r) => s + (Number(r.chartQty) || 0), 0);
  const totalOrderValue = rows.reduce((s, r) => s + (Number(r.orderQty) || 0) * (Number(r.ratePerItem) || 0), 0);

  const handleSave = async () => {
    if (!form.buyerId) { toast.error('Buyer is required'); return; }
    if (!form.style) { toast.error('Style is required'); return; }
    if (rows.length === 0 || rows.every((r: any) => !r.stitchingProductId)) { toast.error('At least one product row required'); return; }
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
        if (hErr) { toast.error(`Header update failed: ${hErr.message}`); return; }

        const { data: oldRowIds } = await supabase.from('order_rows').select('id').eq('order_id', editingId);
        const oldRowIdSet = new Set((oldRowIds || []).map(r => r.id));
        const keptRowIds = new Set<string>();

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (r.id && oldRowIdSet.has(r.id)) {
            keptRowIds.add(r.id);
            const { error: rrErr } = await supabase.from('order_rows').update({
              product_id: r.stitchingProductId || null,
              fabric_id: r.fabricId || null,
              uom: r.uom,
              order_qty: Number(r.orderQty) || 0,
              chart_qty: Number(r.chartQty) || 0,
              rate_per_item: Number(r.ratePerItem) || 0,
              sort_order: i,
            }).eq('id', r.id);
            if (rrErr) { toast.error(`Row update failed: ${rrErr.message}`); return; }
          } else {
            const newRowId = generateId();
            const { error: rrErr } = await supabase.from('order_rows').insert({
              id: newRowId, order_id: editingId,
              product_id: r.stitchingProductId || null,
              fabric_id: r.fabricId || null,
              uom: r.uom,
              order_qty: Number(r.orderQty) || 0,
              chart_qty: Number(r.chartQty) || 0,
              rate_per_item: Number(r.ratePerItem) || 0,
              sort_order: i,
            });
            if (rrErr) { toast.error(`Row insert failed: ${rrErr.message}`); return; }
            r._newId = newRowId;
          }
        }

        const toDelete = [...oldRowIdSet].filter(id => !keptRowIds.has(id));
        if (toDelete.length > 0) {
          await supabase.from('order_colourways').delete().in('order_row_id', toDelete);
          await supabase.from('order_rows').delete().in('id', toDelete);
        }

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const rowId = r.id || r._newId;
          const existingCwIds = new Set((r.colourways || []).filter((c: any) => c.id).map((c: any) => c.id));
          const keptCwIds = new Set<string>();

          for (let j = 0; j < (r.colourways || []).length; j++) {
            const c = r.colourways[j];
            if (c.id && existingCwIds.has(c.id)) {
              keptCwIds.add(c.id);
              const { error: ccErr } = await supabase.from('order_colourways').update({
                colour_name: c.colourName,
                ordered_qty: Number(c.orderedQty) || 0,
                uom: c.uom || r.uom,
                size: c.size || null,
                notes: c.notes || null,
                sort_order: j,
              }).eq('id', c.id);
              if (ccErr) { toast.error(`Colourway update failed: ${ccErr.message}`); return; }
            } else {
              const { error: ccErr } = await supabase.from('order_colourways').insert({
                order_row_id: rowId,
                colour_name: c.colourName,
                ordered_qty: Number(c.orderedQty) || 0,
                uom: c.uom || r.uom,
                size: c.size || null,
                notes: c.notes || null,
                sort_order: j,
              });
              if (ccErr) { toast.error(`Colourway insert failed: ${ccErr.message}`); return; }
            }
          }

          const cwIdsFromDb = (r.colourways || []).filter((c: any) => c.id).map((c: any) => c.id);
          const cwToDelete = [...existingCwIds].filter(id => !keptCwIds.has(id));
          if (cwToDelete.length > 0) {
            const { data: cwRows } = await supabase.from('order_colourways').select('id').in('order_row_id', [rowId]);
            const allCwIds = (cwRows || []).map(x => x.id);
            const deleteThese = allCwIds.filter(id => !cwIdsFromDb.includes(id));
            if (deleteThese.length > 0) {
              await supabase.from('order_colourways').delete().in('id', deleteThese);
            }
          }
        }

        toast.success('Order updated');
      } else {
        if (!companyId) { toast.error('No company found'); return; }
        const orderId = generateId();

        const { error: hErr } = await supabase.from('order_headers').insert({
          id: orderId,
          company_id: companyId,
          module: 'stitching',
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
        if (hErr) { toast.error(`Header insert failed: ${hErr.message}`); return; }

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const orderRowId = generateId();
          const { error: rrErr } = await supabase.from('order_rows').insert({
            id: orderRowId,
            order_id: orderId,
            product_id: r.stitchingProductId || null,
            fabric_id: r.fabricId || null,
            uom: r.uom,
            order_qty: Number(r.orderQty) || 0,
            chart_qty: Number(r.chartQty) || 0,
            rate_per_item: Number(r.ratePerItem) || 0,
            sort_order: i,
          });
          if (rrErr) { toast.error(`Row insert failed: ${rrErr.message}`); return; }

          for (let j = 0; j < (r.colourways || []).length; j++) {
            const c = r.colourways[j];
            if (!c.colourName) continue;
            const { error: ccErr } = await supabase.from('order_colourways').insert({
              order_row_id: orderRowId,
              colour_name: c.colourName,
              ordered_qty: Number(c.orderedQty) || 0,
              uom: c.uom || r.uom,
              size: c.size || null,
              notes: c.notes || null,
              sort_order: j,
            });
            if (ccErr) { toast.error(`Colourway insert failed: ${ccErr.message}`); return; }
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
        <h1 className="text-lg font-semibold">Stitching Orders</h1>
        <Button size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> New Order</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Not Started">Not Started</SelectItem>
            <SelectItem value="WIP">WIP</SelectItem>
            <SelectItem value="Delayed">Delayed</SelectItem>
            <SelectItem value="On-time">On-time</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Shipped">Shipped</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={buyerFilter} onValueChange={setBuyerFilter}>
          <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue placeholder="Buyer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buyers</SelectItem>
            {buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[140px] text-xs" placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[140px] text-xs" placeholder="To" />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="buyerDeliveryDate">Delivery Date</SelectItem>
            <SelectItem value="targetEndDate">Target End</SelectItem>
            <SelectItem value="internalPO">PO #</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={printFiltered} title="Print filtered"><Printer className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={exportFilteredCSV} title="Export CSV"><span className="text-[10px]">CSV</span></Button>
        </div>
        <span className="text-xs text-muted-foreground">{sorted.length} {sorted.length === 1 ? 'order' : 'orders'}</span>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-xs h-9">Internal PO</TableHead>
            <TableHead className="text-xs h-9">Buyer</TableHead>
            <TableHead className="text-xs h-9">Style</TableHead>
            <TableHead className="text-xs h-9">Qty</TableHead>
            <TableHead className="text-xs h-9 min-w-[100px]">Progress</TableHead>
            <TableHead className="text-xs h-9">Status</TableHead>
            <TableHead className="text-xs h-9 w-[60px]"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No orders found</TableCell></TableRow>
            ) : Object.entries(monthlyGroups).map(([monthKey, group]) => (
              <Fragment key={monthKey}>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={7} className="text-[11px] font-semibold py-1.5 px-3">
                    {monthKey === '__no_date__' ? 'No Delivery Date' : new Date(monthKey + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    <span className="text-muted-foreground font-normal ml-2">({group.items.length} orders, {group.qty} qty)</span>
                  </TableCell>
                </TableRow>
                {group.items.map(o => {
                  const prog = getProgress(o.id);
                  return (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/stitching-orders/${o.id}`)}>
                      <TableCell className="text-sm py-2 font-mono">{o.internalPO ?? '—'}</TableCell>
                      <TableCell className="text-sm py-2">{getBuyer(o.buyerId)}</TableCell>
                      <TableCell className="text-sm py-2">{o.style}</TableCell>
                      <TableCell className="text-sm py-2">{o.orderQty} {o.uom}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(prog.pct, 100)} className="h-2 flex-1" />
                          <span className={`text-[10px] font-medium ${prog.pct >= 100 ? 'text-success' : prog.pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{prog.pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">{(() => { const badge = getOrderBadge(o.status, entryCountMap.get(o.id) || 0, o.targetEndDate, prog.pct); return <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>; })()}</TableCell>
                      <TableCell className="py-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleEdit(e, o)}><Pencil className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {Object.keys(monthlyGroups).length > 1 && (
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={3} className="text-[10px] py-1.5 font-medium text-right">Sub-total ({group.label})</TableCell>
                    <TableCell className="text-[10px] py-1.5 font-mono font-medium">{group.qty} qty</TableCell>
                    <TableCell colSpan={2} className="text-[10px] py-1.5 font-mono text-muted-foreground">Value: {group.value.toFixed(0)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {Object.keys(monthlyGroups).length > 1 && (
              <TableRow className="bg-muted/60 font-semibold">
                <TableCell colSpan={3} className="text-xs py-2 text-right">Page Total ({pagination.pageItems.length} orders)</TableCell>
                <TableCell className="text-xs py-2 font-mono">{pagination.pageItems.reduce((s, o) => s + (o.orderQty || 0), 0)} qty</TableCell>
                <TableCell colSpan={2} className="text-xs py-2 font-mono">Value: {pagination.pageItems.reduce((s, o) => s + (o.orderQty || 0) * ((o as any).ratePerItem || 0), 0).toFixed(0)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination {...pagination} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'New'} Stitching Order</DialogTitle></DialogHeader>
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
              <div className="space-y-1"><Label className="text-xs">Status</Label>
                <Select value={form.status || 'Started'} onValueChange={v => setForm((p: any) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Started">Started</SelectItem><SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem><SelectItem value="Shipped">Shipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DatePickerField label="Target End Date" value={form.targetEndDate || ''} onChange={v => setForm((p: any) => ({ ...p, targetEndDate: v }))} />
              <DatePickerField label="Buyer Delivery Date" value={form.buyerDeliveryDate || ''} onChange={v => setForm((p: any) => ({ ...p, buyerDeliveryDate: v }))} />
            </div>
            <div className="space-y-1"><Label className="text-xs">Remarks</Label><Input value={form.remarks || ''} onChange={e => setForm((p: any) => ({ ...p, remarks: e.target.value }))} /></div>

            <div className="text-xs text-muted-foreground flex items-center gap-4">
              <span>Rows: {rows.length}</span>
              <span>Total Qty: <strong>{totalRowQty}</strong></span>
              {totalChartQty > 0 && <span>Chart Qty: <strong>{totalChartQty}</strong></span>}
              {totalOrderValue > 0 && <span>Value: <strong>{form.currency} {totalOrderValue.toFixed(2)}</strong></span>}
            </div>

            <div className="space-y-3">
              {rows.map((r, ri) => {
                const rowCwQty = (r.colourways || []).reduce((s: number, c: any) => s + (Number(c.orderedQty) || 0), 0);
                const mismatch = r.orderQty > 0 && rowCwQty > 0 && rowCwQty !== Number(r.orderQty);
                return (
                  <div key={r._key} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <Button variant="ghost" size="icon" className="h-5 w-5" disabled={ri === 0} onClick={() => moveRow(ri, -1)}><GripVertical className="h-3 w-3 rotate-0" /></Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" disabled={ri === rows.length - 1} onClick={() => moveRow(ri, 1)}><GripVertical className="h-3 w-3 rotate-180" /></Button>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground min-w-[60px]">Row {ri + 1}</span>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Product *</Label>
                          <Select value={r.stitchingProductId || ''} onValueChange={v => updateRow(r._key, 'stitchingProductId', v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Fabric</Label>
                          <Select value={r.fabricId || 'none'} onValueChange={v => updateRow(r._key, 'fabricId', v === 'none' ? '' : v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {fabrics.map(f => <SelectItem key={f.id} value={f.id}>{f.shortForm}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">UOM</Label>
                          <Input className="h-7 text-xs" value={r.uom} onChange={e => updateRow(r._key, 'uom', e.target.value)} />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Order Qty</Label>
                          <Input className="h-7 text-xs" type="number" value={r.orderQty || ''} onChange={e => updateRow(r._key, 'orderQty', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Chart Qty</Label>
                          <Input className="h-7 text-xs" type="number" value={r.chartQty || ''} onChange={e => updateRow(r._key, 'chartQty', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Rate/Item</Label>
                          <Input className="h-7 text-xs" type="number" step="0.01" value={r.ratePerItem || ''} onChange={e => updateRow(r._key, 'ratePerItem', parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={rows.length <= 1} onClick={() => removeRow(r._key)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>

                    <div className="pl-8 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground">Colourways</span>
                        {mismatch && <span className="flex items-center gap-1 text-[10px] text-warning"><AlertTriangle className="h-2.5 w-2.5" /> {rowCwQty} vs {r.orderQty}</span>}
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => addColourToRow(r._key)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                      </div>
                      {(r.colourways || []).length > 0 && (
                        <div className="border rounded overflow-x-auto">
                          <Table>
                            <TableHeader><TableRow>
                              <TableHead className="text-[10px] h-6">Colour</TableHead>
                              <TableHead className="text-[10px] h-6">Qty</TableHead>
                              <TableHead className="text-[10px] h-6">UOM</TableHead>
                              <TableHead className="text-[10px] h-6">Size</TableHead>
                              <TableHead className="text-[10px] h-6">Notes</TableHead>
                              <TableHead className="text-[10px] h-6 w-6"></TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                              {(r.colourways || []).map((c: any) => (
                                <TableRow key={c._key}>
                                  <TableCell className="py-0.5"><Input className="h-6 text-[10px]" placeholder="Colour name" value={c.colourName} onChange={e => updateColourInRow(r._key, c._key, 'colourName', e.target.value)} /></TableCell>
                                  <TableCell className="py-0.5"><Input className="h-6 text-[10px]" type="number" value={c.orderedQty || ''} onChange={e => updateColourInRow(r._key, c._key, 'orderedQty', parseFloat(e.target.value) || 0)} /></TableCell>
                                  <TableCell className="py-0.5"><Input className="h-6 text-[10px]" value={c.uom} onChange={e => updateColourInRow(r._key, c._key, 'uom', e.target.value)} /></TableCell>
                                  <TableCell className="py-0.5"><Input className="h-6 text-[10px]" value={c.size || ''} onChange={e => updateColourInRow(r._key, c._key, 'size', e.target.value)} /></TableCell>
                                  <TableCell className="py-0.5"><Input className="h-6 text-[10px]" value={c.notes || ''} onChange={e => updateColourInRow(r._key, c._key, 'notes', e.target.value)} /></TableCell>
                                  <TableCell className="py-0.5"><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeColourFromRow(r._key, c._key)}><Trash2 className="h-2.5 w-2.5" /></Button></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add Product Row</Button>
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
