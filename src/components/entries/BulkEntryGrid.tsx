import { useState, useMemo, useCallback, useEffect } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { RateMaster, ProductionEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Check, X, ClipboardPaste, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface GridRow {
  id: string; date: string; module: 'printing' | 'stitching'; orderId: string;
  colourwayId: string; shiftId: string; resourceId: string; workerTypeId: string;
  personsUsed: number; outputQty: number; valid: boolean; errors: string[]; costPreview: number;
}

function emptyRow(mod: 'printing' | 'stitching' = 'printing'): GridRow {
  return {
    id: generateId(), date: new Date().toISOString().slice(0, 10), module: mod,
    orderId: '', colourwayId: '', shiftId: '', resourceId: '', workerTypeId: '',
    personsUsed: 0, outputQty: 0, valid: false, errors: [], costPreview: 0,
  };
}

function findRate(rateMasters: RateMaster[], factoryId: string, shiftId: string, workerTypeId: string, date: string): RateMaster | null {
  return rateMasters.find(r =>
    r.active && r.factoryId === factoryId && r.shiftId === shiftId && r.workerTypeId === workerTypeId &&
    r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date)
  ) || null;
}

interface Props { defaultModule?: 'printing' | 'stitching'; }

export default function BulkEntryGrid({ defaultModule }: Props) {
  const { data, addItem, currentFactoryId, setCurrentFactoryId } = useData();
  const mod = defaultModule || 'printing';
  const [rows, setRows] = useState<GridRow[]>([emptyRow(mod)]);

  useEffect(() => {
    if (!currentFactoryId && data.factories.length === 1) setCurrentFactoryId(data.factories[0].id);
  }, [currentFactoryId, data.factories, setCurrentFactoryId]);

  const noFactory = !currentFactoryId;

  const allOrders = useMemo(() => [
    ...data.printingOrders.map(o => ({ ...o, module: 'printing' as const })),
    ...data.stitchingOrders.map(o => ({ ...o, module: 'stitching' as const })),
  ], [data.printingOrders, data.stitchingOrders]);

  const validateRow = useCallback((row: GridRow): GridRow => {
    const errors: string[] = [];
    if (!row.date) errors.push('Date required');
    if (!row.orderId) errors.push('Order required');
    if (!row.colourwayId) errors.push('Colour required');
    if (!row.shiftId) errors.push('Shift required');
    if (!row.resourceId) errors.push('Resource required');
    if (!row.workerTypeId) errors.push('Worker type required');
    if (row.personsUsed < 0) errors.push('Persons cannot be negative');
    if (row.outputQty < 0) errors.push('Output cannot be negative');
    const order = allOrders.find(o => o.id === row.orderId);
    if (order?.status === 'Cancelled') errors.push('Order is cancelled');
    let costPreview = 0;
    if (currentFactoryId && row.shiftId && row.workerTypeId && row.date) {
      const rate = findRate(data.rateMasters, currentFactoryId, row.shiftId, row.workerTypeId, row.date);
      if (!rate) errors.push('No active rate');
      else costPreview = rate.rateBasis === 'per_person_per_shift' ? row.personsUsed * rate.rateValue : row.outputQty * rate.rateValue;
    }
    return { ...row, valid: errors.length === 0, errors, costPreview };
  }, [allOrders, currentFactoryId, data.rateMasters]);

  const updateRow = (id: string, field: string, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'module') { updated.orderId = ''; updated.colourwayId = ''; updated.resourceId = ''; updated.workerTypeId = ''; }
      if (field === 'orderId') updated.colourwayId = '';
      return validateRow(updated);
    }));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow(mod)]);
  const removeRow = (id: string) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    const lines = text.trim().split('\n').map(line => line.split('\t'));
    if (lines.length === 0) return;
    const shifts = data.shifts.filter(s => s.active);
    const workerTypes = data.workerTypes.filter(w => w.active);
    const newRows: GridRow[] = lines.map(cols => {
      const row = emptyRow(mod);
      if (cols[0]) row.date = cols[0];
      if (cols[1]) row.module = cols[1].toLowerCase().includes('stitch') ? 'stitching' : 'printing';
      if (cols[2]) { const order = allOrders.find(o => o.internalPO.toLowerCase() === cols[2].toLowerCase()); if (order) { row.orderId = order.id; row.module = order.module; } }
      if (cols[3] && row.orderId) { const colourways = row.module === 'printing' ? data.printingColourways : data.stitchingColourways; const cw = colourways.find(c => c.orderId === row.orderId && c.colourName.toLowerCase() === cols[3].toLowerCase()); if (cw) row.colourwayId = cw.id; }
      if (cols[4]) { const shift = shifts.find(s => s.code.toLowerCase() === cols[4].toLowerCase() || s.name.toLowerCase() === cols[4].toLowerCase()); if (shift) row.shiftId = shift.id; }
      if (cols[5] && currentFactoryId) { const resources = row.module === 'printing' ? data.printingTables : data.stitchingLines; const res = (resources as any[]).find(r => r.code.toLowerCase() === cols[5].toLowerCase() && r.factoryId === currentFactoryId); if (res) row.resourceId = res.id; }
      if (cols[6]) { const wt = workerTypes.find(w => w.name.toLowerCase() === cols[6].toLowerCase()); if (wt) row.workerTypeId = wt.id; }
      if (cols[7]) row.personsUsed = parseInt(cols[7]) || 0;
      if (cols[8]) row.outputQty = parseFloat(cols[8]) || 0;
      return validateRow(row);
    });
    setRows(prev => [...prev.filter(r => r.orderId || r.shiftId), ...newRows]);
    toast.info(`Pasted ${newRows.length} rows`);
  };

  const validCount = rows.filter(r => r.valid).length;
  const totalCost = rows.reduce((s, r) => s + r.costPreview, 0);
  const totalOutput = rows.reduce((s, r) => s + r.outputQty, 0);

  const handleSaveAll = () => {
    if (!currentFactoryId) { toast.error('Select a factory first'); return; }
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) { toast.error('No valid rows to save'); return; }
    validRows.forEach(row => {
      const rate = findRate(data.rateMasters, currentFactoryId, row.shiftId, row.workerTypeId, row.date)!;
      const entry: ProductionEntry = {
        id: generateId(), date: row.date, module: row.module, orderId: row.orderId,
        colourwayId: row.colourwayId, factoryId: currentFactoryId, shiftId: row.shiftId,
        resourceId: row.resourceId, workerTypeId: row.workerTypeId, personsUsed: row.personsUsed,
        outputQty: row.outputQty, outputUOM: '', rateMasterId: rate.id, rateBasis: rate.rateBasis,
        rateValue: rate.rateValue, costAmount: row.costPreview, createdAt: new Date().toISOString(),
      };
      addItem('entries', entry);
    });
    toast.success(`Saved ${validRows.length} entries`);
    setRows([emptyRow(mod)]);
  };

  const getColourways = (row: GridRow) => row.orderId ? (row.module === 'printing' ? data.printingColourways : data.stitchingColourways).filter(c => c.orderId === row.orderId) : [];
  const getResources = (row: GridRow) => {
    if (!currentFactoryId) return [];
    return row.module === 'printing'
      ? data.printingTables.filter(t => t.active && t.factoryId === currentFactoryId)
      : data.stitchingLines.filter(l => l.active && l.factoryId === currentFactoryId);
  };
  const filteredWorkerTypes = (m: string) => data.workerTypes.filter(w => w.active && (w.module === m || w.module === 'both'));
  const workerLabel = (w: { name: string; module: string }) => w.module === 'both' ? `${w.name} (Both)` : `${w.name} (${w.module === 'printing' ? 'P' : 'S'})`;
  const shifts = data.shifts.filter(s => s.active && (!currentFactoryId || s.factoryId === currentFactoryId));

  return (
    <Card className="mt-3">
      <CardContent className="pt-4" onPaste={handlePaste}>
        {noFactory && (
          <Alert variant="destructive" className="py-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">Please select a factory from the header dropdown first.</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{rows.length} rows, {validCount} valid</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><ClipboardPaste className="h-3 w-3" /> Paste from Excel</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3 w-3 mr-1" /> Row</Button>
            <Button size="sm" onClick={handleSaveAll} disabled={validCount === 0 || noFactory}>Save {validCount} Entries</Button>
          </div>
        </div>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8 min-w-[100px]">Date</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[90px]">Module</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[140px]">Order</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[120px]">Colour</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[110px]">Shift</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[110px]">Resource</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[110px]">Worker Type</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[70px]">Persons</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[70px]">Output</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[80px]">Cost</TableHead>
                <TableHead className="text-[10px] h-8 w-[60px]">Status</TableHead>
                <TableHead className="text-[10px] h-8 w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id} className={row.errors.length > 0 && (row.orderId || row.shiftId) ? 'bg-destructive/5' : ''}>
                  <TableCell className="py-1"><Input className="h-7 text-[11px]" type="date" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} /></TableCell>
                  <TableCell className="py-1">
                    <Select value={row.module} onValueChange={v => updateRow(row.id, 'module', v)}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="printing">Printing</SelectItem><SelectItem value="stitching">Stitching</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1">
                    <Select value={row.orderId} onValueChange={v => updateRow(row.id, 'orderId', v)}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Order" /></SelectTrigger>
                      <SelectContent>{(row.module === 'printing' ? data.printingOrders : data.stitchingOrders).filter(o => o.status !== 'Cancelled').map((o: any) => <SelectItem key={o.id} value={o.id}>{o.internalPO}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1">
                    <Select value={row.colourwayId} onValueChange={v => updateRow(row.id, 'colourwayId', v)}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Colour" /></SelectTrigger>
                      <SelectContent>{getColourways(row).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.colourName}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1">
                    <Select value={row.shiftId} onValueChange={v => updateRow(row.id, 'shiftId', v)} disabled={noFactory}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Shift" /></SelectTrigger>
                      <SelectContent>{shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1">
                    <Select value={row.resourceId} onValueChange={v => updateRow(row.id, 'resourceId', v)} disabled={noFactory}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Resource" /></SelectTrigger>
                      <SelectContent>{getResources(row).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1">
                    <Select value={row.workerTypeId} onValueChange={v => updateRow(row.id, 'workerTypeId', v)}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>{filteredWorkerTypes(row.module).map(w => <SelectItem key={w.id} value={w.id}>{workerLabel(w)}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-[11px]" type="number" min={0} value={row.personsUsed} onChange={e => updateRow(row.id, 'personsUsed', parseInt(e.target.value) || 0)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-[11px]" type="number" min={0} value={row.outputQty} onChange={e => updateRow(row.id, 'outputQty', parseFloat(e.target.value) || 0)} /></TableCell>
                  <TableCell className="py-1 text-[11px] font-mono">₹{row.costPreview.toFixed(0)}</TableCell>
                  <TableCell className="py-1">
                    {row.valid ? <Check className="h-3.5 w-3.5 text-green-600" /> : row.errors.length > 0 && (row.orderId || row.shiftId) ? <span title={row.errors.join(', ')}><X className="h-3.5 w-3.5 text-destructive" /></span> : null}
                  </TableCell>
                  <TableCell className="py-1">{rows.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(row.id)}><Trash2 className="h-3 w-3" /></Button>}</TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={8} className="text-[11px] py-1.5 text-right">Totals:</TableCell>
                <TableCell className="text-[11px] py-1.5 font-mono">{totalOutput}</TableCell>
                <TableCell className="text-[11px] py-1.5 font-mono">₹{totalCost.toFixed(0)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
