import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { ProductionEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, FileDown, Pencil, Trash2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import DataTablePagination from '@/components/DataTablePagination';
import { usePagination } from '@/hooks/use-pagination';

export default function EntryList() {
  const navigate = useNavigate();
  const { data, deleteItem, updateItem, refreshData } = useData();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [factoryFilter, setFactoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionEntry | null>(null);

  const factories = data.factories.filter(f => f.active);

  const filtered = useMemo(() => {
    return data.entries.filter((e: ProductionEntry) => {
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false;
      if (factoryFilter !== 'all' && e.factoryId !== factoryFilter) return false;
      if (dateFrom && e.date && e.date < dateFrom) return false;
      if (dateTo && e.date && e.date > dateTo) return false;
      if (search) {
        const s = search.toLowerCase();
        const order = data.printingOrders.find(o => o.id === e.orderId)
          || data.stitchingOrders.find(o => o.id === e.orderId);
        const orderRef = order?.internalPO || order?.style || '';
        const factory = factories.find(f => f.id === e.factoryId);
        if (!orderRef.toLowerCase().includes(s)
          && !(factory?.name || '').toLowerCase().includes(s)
          && !(e.notes || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [data.entries, search, moduleFilter, factoryFilter, dateFrom, dateTo, data.printingOrders, data.stitchingOrders, factories]);

  const pagination = usePagination(filtered, 50);

  const enrichEntry = (e: ProductionEntry) => {
    const order = (e.module === 'printing' ? data.printingOrders : data.stitchingOrders)
      .find((o: any) => o.id === e.orderId);
    const colourway = (e.module === 'printing' ? data.printingColourways : data.stitchingColourways)
      .find((c: any) => c.id === e.colourwayId);
    const factory = factories.find(f => f.id === e.factoryId);
    const shift = data.shifts.find(s => s.id === e.shiftId);
    const resource = e.module === 'printing'
      ? data.printingTables.find((t: any) => t.id === e.resourceId)
      : data.stitchingLines.find((l: any) => l.id === e.resourceId);
    const workerType = data.workerTypes.find((w: any) => w.id === e.workerTypeId);
    return { ...e, order, colourway, factory, shift, resource, workerType };
  };

  const exportCSV = () => {
    const header = 'Date,Module,Order,Colour,Factory,Shift,Resource,Worker Type,Persons,Output,UOM,Cost,Notes';
    const rows = filtered.map(e => {
      const enriched = enrichEntry(e);
      return [
        e.date, e.module,
        enriched.order?.internalPO || '',
        enriched.colourway?.colourName || '',
        enriched.factory?.name || '',
        enriched.shift?.name || '',
        enriched.resource?.name || '',
        enriched.workerType?.name || '',
        e.personsUsed, e.outputQty, e.outputUOM, e.costAmount, e.notes || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    }).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'production-entries.csv'; a.click();
    toast.success(`Exported ${filtered.length} entries`);
  };

  const handleEdit = (e: ProductionEntry) => {
    setEditingEntry(e);
    setEditDialogOpen(true);
  };

  const handleDelete = async (e: ProductionEntry) => {
    if (!confirm(`Delete entry for ${e.date}?`)) return;
    const result = await deleteItem('entries', e.id);
    if (result.error) { toast.error(`Failed to delete: ${result.error}`); return; }
    toast.success('Entry deleted');
    refreshData();
  };

  const totalCost = filtered.reduce((s, e) => s + e.costAmount, 0);
  const totalOutput = filtered.reduce((s, e) => s + e.outputQty, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3 mt-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="printing">Printing</SelectItem>
            <SelectItem value="stitching">Stitching</SelectItem>
          </SelectContent>
        </Select>
        <Select value={factoryFilter} onValueChange={setFactoryFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Factory" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Factories</SelectItem>
            {factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[130px] text-xs" placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[130px] text-xs" placeholder="To" />
        <Button size="sm" variant="outline" onClick={exportCSV}><FileDown className="h-3.5 w-3.5 mr-1" /> Export</Button>
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">Date</TableHead>
                  <TableHead className="text-xs h-8">Module</TableHead>
                  <TableHead className="text-xs h-8">Order</TableHead>
                  <TableHead className="text-xs h-8">Colour</TableHead>
                  <TableHead className="text-xs h-8">Factory</TableHead>
                  <TableHead className="text-xs h-8">Shift</TableHead>
                  <TableHead className="text-xs h-8">Resource</TableHead>
                  <TableHead className="text-xs h-8">Worker Type</TableHead>
                  <TableHead className="text-xs h-8 text-right">Persons</TableHead>
                  <TableHead className="text-xs h-8 text-right">Output</TableHead>
                  <TableHead className="text-xs h-8 text-right">Cost</TableHead>
                  <TableHead className="text-xs h-8 w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No entries found</p>
                        <p className="text-xs text-muted-foreground/60">Try adjusting filters or add entries using the forms above.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pagination.pageItems.map(e => {
                  const enriched = enrichEntry(e);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm py-2">{e.date}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-[10px]">{e.module}</Badge>
                      </TableCell>
                      <TableCell className="text-sm py-2 font-medium">
                        <button className="hover:underline text-left" onClick={() => {
                          const path = e.module === 'printing' ? 'printing-orders' : 'stitching-orders';
                          navigate(`/${path}/${e.orderId}`);
                        }}>
                          {enriched.order?.internalPO || e.orderId.slice(0, 8)}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm py-2">{enriched.colourway?.colourName || '-'}</TableCell>
                      <TableCell className="text-sm py-2">{enriched.factory?.name || '-'}</TableCell>
                      <TableCell className="text-sm py-2">{enriched.shift?.name || '-'}</TableCell>
                      <TableCell className="text-sm py-2">{enriched.resource?.name || '-'}</TableCell>
                      <TableCell className="text-sm py-2">{enriched.workerType?.name || '-'}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{e.personsUsed}</TableCell>
                      <TableCell className="text-sm py-2 text-right">{e.outputQty} {e.outputUOM}</TableCell>
                      <TableCell className="text-sm py-2 text-right font-mono">₹{e.costAmount.toFixed(2)}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination {...pagination} />
          {filtered.length > 0 && (
            <div className="flex items-center justify-end gap-4 px-3 py-2 border-t text-xs text-muted-foreground">
              <span>Total Output: <strong>{totalOutput}</strong></span>
              <span>Total Cost: <strong>₹{totalCost.toFixed(2)}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Entry</DialogTitle></DialogHeader>
          {editingEntry && (
            <div className="space-y-3">
              <div><Label className="text-xs">Date</Label><Input type="date" value={editingEntry.date} onChange={e => { setEditingEntry({ ...editingEntry, date: e.target.value }); }} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Persons</Label><Input type="number" min={0} value={editingEntry.personsUsed} onChange={e => setEditingEntry({ ...editingEntry, personsUsed: parseInt(e.target.value) || 0 })} /></div>
                <div><Label className="text-xs">Output</Label><Input type="number" min={0} value={editingEntry.outputQty} onChange={e => setEditingEntry({ ...editingEntry, outputQty: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label className="text-xs">UOM</Label><Input value={editingEntry.outputUOM} onChange={e => setEditingEntry({ ...editingEntry, outputUOM: e.target.value })} /></div>
              </div>
              <div><Label className="text-xs">Notes</Label><Input value={editingEntry.notes || ''} onChange={e => setEditingEntry({ ...editingEntry, notes: e.target.value })} /></div>
              <DialogFooter>
                <Button onClick={async () => {
                  const result = await updateItem('entries', editingEntry.id, {
                    date: editingEntry.date,
                    personsUsed: editingEntry.personsUsed,
                    outputQty: editingEntry.outputQty,
                    outputUOM: editingEntry.outputUOM,
                    notes: editingEntry.notes,
                  });
                  if (result.error) { toast.error(`Failed: ${result.error}`); return; }
                  toast.success('Entry updated');
                  setEditDialogOpen(false);
                  refreshData();
                }}>Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
