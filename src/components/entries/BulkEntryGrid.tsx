import { useState, useMemo, useCallback, useEffect } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { saveProductionEntryWithConsumption } from '@/lib/material-auto-consumption';
import { RateMaster, ProductionEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Check, X, ClipboardPaste, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { SaveButton } from '@/components/SaveButton';
import { useFormDraft } from '@/hooks/use-form-draft';

export interface GridRow {
  id: string; date: string; module: 'printing' | 'stitching'; orderId: string;
  colourwayId: string; orderRowId: string; productLabel: string;
  shiftId: string; resourceId: string; workerTypeId: string;
  personsUsed: number; outputQty: number; valid: boolean; errors: string[]; costPreview: number;
  rateBasis?: string;
  saveError?: string;
}

function emptyRow(mod: 'printing' | 'stitching' = 'printing'): GridRow {
  return {
    id: generateId(), date: new Date().toISOString().slice(0, 10), module: mod,
    orderId: '', colourwayId: '', orderRowId: '', productLabel: '',
    shiftId: '', resourceId: '', workerTypeId: '',
    personsUsed: 0, outputQty: 0, valid: false, errors: [], costPreview: 0,
  };
}

function findRate(rateMasters: RateMaster[], factoryId: string, shiftId: string, workerTypeId: string, date: string): RateMaster | null {
  return rateMasters.find(r =>
    r.active && r.factoryId === factoryId && r.shiftId === shiftId && r.workerTypeId === workerTypeId &&
    r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date)
  ) || null;
}

export async function saveBulkEntries(
  rows: GridRow[],
  factoryId: string,
  rateMasters: RateMaster[],
): Promise<Map<string, string>> {
  const failures = new Map<string, string>();
  for (const row of rows) {
    const rate = findRate(rateMasters, factoryId, row.shiftId, row.workerTypeId, row.date);
    if (!rate) {
      failures.set(row.id, 'No active rate found');
      continue;
    }
    const entry: ProductionEntry = {
      id: generateId(), date: row.date, module: row.module, orderId: row.orderId,
      orderRowId: row.orderRowId || undefined,
      colourwayId: row.colourwayId, factoryId, shiftId: row.shiftId,
      resourceId: row.resourceId, workerTypeId: row.workerTypeId, personsUsed: row.personsUsed,
      outputQty: row.outputQty, outputUOM: '', rateMasterId: rate.id, rateBasis: rate.rateBasis,
      rateValue: rate.rateValue, costAmount: row.costPreview, createdAt: new Date().toISOString(),
    };
    const { error } = await saveProductionEntryWithConsumption(supabase, entry);
    if (error) failures.set(row.id, error);
  }
  return failures;
}

interface ColourwayOption {
  id: string;
  colourName: string;
  orderRowId: string;
  productLabel: string;
  uom: string;
}

export interface QuickEntryDraft {
  date: string;
  module: 'printing' | 'stitching';
  factoryId: string;
  orderId: string;
  colourwayId: string;
  shiftId: string;
  resourceId: string;
  workerTypeId: string;
  personsUsed: number;
  outputQty: number;
  outputUOM: string;
}

export const QUICK_ENTRY_DRAFT_KEY = 'fabrios:draft:bulk-entry:quick';

export function createQuickEntryDraft(
  defaultModule: 'printing' | 'stitching' = 'printing',
  factoryId = '',
): QuickEntryDraft {
  return {
    date: new Date().toISOString().slice(0, 10),
    module: defaultModule,
    factoryId,
    orderId: '',
    colourwayId: '',
    shiftId: '',
    resourceId: '',
    workerTypeId: '',
    personsUsed: 0,
    outputQty: 0,
    outputUOM: '',
  };
}

export function prefillQuickEntryAfterSave(saved: QuickEntryDraft, factoryId: string): QuickEntryDraft {
  return {
    ...saved,
    factoryId,
    orderId: '',
    colourwayId: '',
    outputQty: 0,
  };
}

export function hasUnfinishedQuickEntry(draft: QuickEntryDraft): boolean {
  return Boolean(
    draft.orderId ||
    draft.colourwayId ||
    draft.outputQty > 0 ||
    draft.personsUsed > 0 ||
    draft.outputUOM.trim(),
  );
}

interface Props {
  defaultModule?: 'printing' | 'stitching';
  mode?: 'quick' | 'office';
}

export default function BulkEntryGrid({ defaultModule, mode = 'office' }: Props) {
  const { data, refreshData, addItem, currentFactoryId, setCurrentFactoryId } = useData();
  const mod = defaultModule || 'printing';
  const [rows, setRows] = useState<GridRow[]>([emptyRow(mod)]);
  const [quickForm, setQuickForm] = useState<QuickEntryDraft>(() => createQuickEntryDraft(mod, currentFactoryId || ''));
  const [quickError, setQuickError] = useState('');
  const [quickResourceCache, setQuickResourceCache] = useState<Record<string, any[]>>({});
  const [orderRowsCache, setOrderRowsCache] = useState<Record<string, any[]>>({});
  const [saving, setSaving] = useState(false);

  const clearQuickDraft = useFormDraft(
    QUICK_ENTRY_DRAFT_KEY,
    quickForm,
    mode === 'quick',
    draft => setQuickForm({ ...createQuickEntryDraft(mod, currentFactoryId || ''), ...draft }),
  );

  useEffect(() => {
    if (!currentFactoryId && data.factories.length === 1) setCurrentFactoryId(data.factories[0].id);
  }, [currentFactoryId, data.factories, setCurrentFactoryId]);

  useEffect(() => {
    if (currentFactoryId && quickForm.factoryId !== currentFactoryId) {
      setQuickForm(prev => ({ ...prev, factoryId: currentFactoryId }));
    }
  }, [currentFactoryId, quickForm.factoryId]);

  useEffect(() => {
    if (defaultModule) {
      setRows(prev => prev.map(row => row.orderId || row.shiftId ? row : emptyRow(defaultModule)));
      setQuickForm(prev => {
        if (prev.module === defaultModule || hasUnfinishedQuickEntry(prev)) return prev;
        return {
          ...prev,
          module: defaultModule,
          orderId: '',
          colourwayId: '',
          resourceId: '',
          workerTypeId: '',
        };
      });
    }
  }, [defaultModule]);

  const noFactory = !currentFactoryId;

  const allOrders = useMemo(() => [
    ...data.printingOrders.map(o => ({ ...o, module: 'printing' as const })),
    ...data.stitchingOrders.map(o => ({ ...o, module: 'stitching' as const })),
  ], [data.printingOrders, data.stitchingOrders]);

  const getColourwayOptions = useCallback((orderId: string, module: string): ColourwayOption[] => {
    if (!orderId) return [];
    const cached = orderRowsCache[orderId];
    if (!cached) return [];
    const allColourways = module === 'printing' ? data.printingColourways : data.stitchingColourways;
    const result: ColourwayOption[] = [];
    for (const row of cached) {
      const rowCws = allColourways.filter((c: any) => c.orderRowId === row.id);
      for (const cw of rowCws) {
        result.push({
          id: cw.id,
          colourName: cw.colourName,
          orderRowId: row.id,
          productLabel: row.productLabel || '',
          uom: cw.uom || row.uom || '',
        });
      }
    }
    return result;
  }, [orderRowsCache, data.printingColourways, data.stitchingColourways]);

  const loadOrderRows = useCallback(async (orderId: string, module: string) => {
    if (!orderId || orderRowsCache[orderId]) return;
    const { data: dbRows } = await supabase.from('order_rows').select('*').eq('order_id', orderId).order('sort_order');
    if (dbRows) {
      const products = module === 'printing' ? data.printingProducts : data.stitchingProducts;
      const enriched = dbRows.map((r: any) => {
        const p = products.find((x: any) => x.id === r.product_id);
        return { ...r, productLabel: p ? `${p.code} — ${p.name}` : '—' };
      });
      setOrderRowsCache(prev => ({ ...prev, [orderId]: enriched }));
    }
  }, [orderRowsCache, data.printingProducts, data.stitchingProducts]);

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
    let rateBasis: string | undefined;
    if (currentFactoryId && row.shiftId && row.workerTypeId && row.date) {
      const rate = findRate(data.rateMasters, currentFactoryId, row.shiftId, row.workerTypeId, row.date);
      if (!rate) errors.push('No active rate');
      else {
        rateBasis = rate.rateBasis;
        costPreview = rate.rateBasis === 'per_person_per_shift' ? row.personsUsed * rate.rateValue : row.outputQty * rate.rateValue;
      }
    }
    const cw = getColourwayOptions(row.orderId, row.module).find(c => c.id === row.colourwayId);
    return { ...row, valid: errors.length === 0, errors, costPreview, rateBasis, orderRowId: cw?.orderRowId || '', productLabel: cw?.productLabel || '' };
  }, [allOrders, currentFactoryId, data.rateMasters, getColourwayOptions]);

  const updateRow = (id: string, field: string, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'module') { updated.orderId = ''; updated.colourwayId = ''; updated.resourceId = ''; updated.workerTypeId = ''; }
      if (field === 'orderId') { updated.colourwayId = ''; loadOrderRows(value, updated.module); }
      return { ...validateRow(updated), saveError: undefined };
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
      if (cols[2]) { const order = allOrders.find(o => o.internalPO.toLowerCase() === cols[2].toLowerCase()); if (order) { row.orderId = order.id; row.module = order.module; loadOrderRows(order.id, order.module); } }
      if (cols[3] && row.orderId) { const cached = orderRowsCache[row.orderId]; if (cached) { const r = cached.find((rr: any) => (rr.productLabel || '').toLowerCase().includes(cols[3].toLowerCase())); if (r) { row.orderRowId = r.id; } } }
      if (cols[4] && row.orderId) { const cwOptions = getColourwayOptions(row.orderId, row.module); const filtered = row.orderRowId ? cwOptions.filter(c => c.orderRowId === row.orderRowId) : cwOptions; const cw = filtered.find(c => c.colourName.toLowerCase() === cols[4].toLowerCase()); if (cw) { row.colourwayId = cw.id; row.orderRowId = cw.orderRowId; row.productLabel = cw.productLabel; } }
      if (cols[5]) { const shift = shifts.find(s => s.code.toLowerCase() === cols[5].toLowerCase() || s.name.toLowerCase() === cols[5].toLowerCase()); if (shift) row.shiftId = shift.id; }
      if (cols[6] && currentFactoryId) { const resources = row.module === 'printing' ? data.printingTables : data.stitchingLines; const res = (resources as any[]).find(r => r.code.toLowerCase() === cols[6].toLowerCase() && r.factoryId === currentFactoryId); if (res) row.resourceId = res.id; }
      if (cols[7]) { const wt = workerTypes.find(w => w.name.toLowerCase() === cols[7].toLowerCase()); if (wt) row.workerTypeId = wt.id; }
      if (cols[8]) row.personsUsed = parseInt(cols[8]) || 0;
      if (cols[9]) row.outputQty = parseFloat(cols[9]) || 0;
      return validateRow(row);
    });
    setRows(prev => [...prev.filter(r => r.orderId || r.shiftId), ...newRows]);
    toast.info(`Pasted ${newRows.length} rows`);
  };

  const validCount = rows.filter(r => r.valid).length;
  const totalCost = rows.reduce((s, r) => s + r.costPreview, 0);
  const totalOutput = rows.reduce((s, r) => s + r.outputQty, 0);

  const handleSaveAll = async () => {
    if (!currentFactoryId) { toast.error('Select a factory first'); return; }
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) { toast.error('No valid rows to save'); return; }
    setSaving(true);
    const failedRows = new Map<string, string>();

    try {
      const failures = await saveBulkEntries(
        validRows,
        currentFactoryId,
        data.rateMasters,
      );
      failures.forEach((message, rowId) => failedRows.set(rowId, message));

      const savedCount = validRows.length - failedRows.size;
      setRows(previous => {
        const remaining = previous
          .filter(row => !row.valid || failedRows.has(row.id))
          .map(row => failedRows.has(row.id) ? { ...row, saveError: failedRows.get(row.id) } : row);
        return remaining.length > 0 ? remaining : [emptyRow(mod)];
      });

      if (savedCount > 0) {
        await refreshData();
        toast.success(`${savedCount} ${savedCount === 1 ? 'entry' : 'entries'} saved`);
      }
      if (failedRows.size > 0) toast.error(`${failedRows.size} ${failedRows.size === 1 ? 'entry was' : 'entries were'} not saved. Please correct the marked rows and try again.`);
    } finally {
      setSaving(false);
    }
  };

  const getResources = (row: GridRow) => {
    if (!currentFactoryId) return [];
    return row.module === 'printing'
      ? data.printingTables.filter(t => t.active && t.factoryId === currentFactoryId)
      : data.stitchingLines.filter(l => l.active && l.factoryId === currentFactoryId);
  };
  const filteredWorkerTypes = (m: string) => data.workerTypes.filter(w => w.active && (w.module === m || w.module === 'both'));
  const workerLabel = (w: { name: string; module: string }) => w.module === 'both' ? `${w.name} (Both)` : `${w.name} (${w.module === 'printing' ? 'P' : 'S'})`;
  const shifts = data.shifts.filter(s => s.active && (!currentFactoryId || s.factoryId === currentFactoryId));

  const updateQuickForm = (field: keyof QuickEntryDraft, value: any) => {
    setQuickError('');
    setQuickForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'factoryId') {
        updated.shiftId = '';
        updated.resourceId = '';
        setCurrentFactoryId(value || null);
      }
      if (field === 'module') {
        updated.orderId = '';
        updated.colourwayId = '';
        updated.resourceId = '';
        updated.workerTypeId = '';
      }
      if (field === 'orderId') {
        updated.colourwayId = '';
        loadOrderRows(value, updated.module);
      }
      if (field === 'colourwayId') {
        const cw = getColourwayOptions(updated.orderId, updated.module).find(option => option.id === value);
        if (cw?.uom && !updated.outputUOM) updated.outputUOM = cw.uom;
      }
      return updated;
    });
  };

  const quickFactoryId = quickForm.factoryId || currentFactoryId || '';

  useEffect(() => {
    if (mode !== 'quick' || !quickFactoryId) return;
    const cacheKey = `${quickForm.module}:${quickFactoryId}`;
    if (quickResourceCache[cacheKey]) return;
    const table = quickForm.module === 'printing' ? 'printing_tables' : 'stitching_lines';
    supabase.from(table).select('*').eq('factory_id', quickFactoryId).then(({ data: resources }) => {
      if (!resources) return;
      setQuickResourceCache(prev => ({
        ...prev,
        [cacheKey]: resources.map((resource: any) => ({
          ...resource,
          factoryId: resource.factory_id,
          active: resource.is_active,
          supervisorName: resource.supervisor_name,
        })),
      }));
    });
  }, [mode, quickFactoryId, quickForm.module, quickResourceCache]);

  const quickOrders = quickForm.module === 'printing'
    ? data.printingOrders.filter(o => o.status !== 'Cancelled')
    : data.stitchingOrders.filter(o => o.status !== 'Cancelled');
  const quickColourways = getColourwayOptions(quickForm.orderId, quickForm.module);
  const quickSelectedColourway = quickColourways.find(c => c.id === quickForm.colourwayId);
  const quickSelectedRow = orderRowsCache[quickForm.orderId]?.find((r: any) => r.id === quickSelectedColourway?.orderRowId);
  const quickShifts = data.shifts.filter(s => s.active && (!quickFactoryId || s.factoryId === quickFactoryId));
  const quickResources = quickFactoryId
    ? [
      ...(quickForm.module === 'printing'
        ? data.printingTables.filter(t => t.active && t.factoryId === quickFactoryId)
        : data.stitchingLines.filter(l => l.active && l.factoryId === quickFactoryId)),
      ...(quickResourceCache[`${quickForm.module}:${quickFactoryId}`] || []).filter(r => r.active),
    ].filter((resource, index, list) => list.findIndex(item => item.id === resource.id) === index)
    : [];
  const quickWorkerTypes = filteredWorkerTypes(quickForm.module);
  const quickRate = quickFactoryId && quickForm.shiftId && quickForm.workerTypeId
    ? findRate(data.rateMasters, quickFactoryId, quickForm.shiftId, quickForm.workerTypeId, quickForm.date)
    : null;
  const quickCost = quickRate
    ? quickRate.rateBasis === 'per_person_per_shift'
      ? quickForm.personsUsed * quickRate.rateValue
      : quickForm.outputQty * quickRate.rateValue
    : 0;
  const quickResourceLabel = quickForm.module === 'printing' ? 'Table' : 'Line';

  const quickValidationMessage = () => {
    if (!quickFactoryId) return 'Quick entry was not saved. Select a factory first.';
    if (!quickForm.orderId) return 'Quick entry was not saved. Select an order.';
    if (!quickForm.colourwayId) return 'Quick entry was not saved. Select a colour.';
    if (!quickForm.shiftId) return 'Quick entry was not saved. Select a shift.';
    if (!quickForm.resourceId) return `Quick entry was not saved. Select a ${quickResourceLabel.toLowerCase()}.`;
    if (!quickForm.workerTypeId) return 'Quick entry was not saved. Select a worker type.';
    if (quickForm.outputQty <= 0) return 'Quick entry was not saved. Enter an output quantity greater than zero.';
    if (quickForm.personsUsed < 0) return 'Quick entry was not saved. Persons cannot be negative.';
    if (!quickRate) return 'Quick entry was not saved. No active rate was found for this shift and worker type.';
    return '';
  };

  const handleQuickSave = async () => {
    const message = quickValidationMessage();
    if (message) {
      setQuickError(message);
      toast.error(message);
      return;
    }
    setSaving(true);
    try {
      const entry: ProductionEntry = {
        id: generateId(),
        date: quickForm.date,
        module: quickForm.module,
        orderId: quickForm.orderId,
        orderRowId: quickSelectedColourway?.orderRowId,
        colourwayId: quickForm.colourwayId,
        factoryId: quickFactoryId,
        shiftId: quickForm.shiftId,
        resourceId: quickForm.resourceId,
        workerTypeId: quickForm.workerTypeId,
        personsUsed: quickForm.personsUsed,
        outputQty: quickForm.outputQty,
        outputUOM: quickForm.outputUOM || quickSelectedColourway?.uom || '',
        rateMasterId: quickRate!.id,
        rateBasis: quickRate!.rateBasis,
        rateValue: quickRate!.rateValue,
        costAmount: quickCost,
        createdAt: new Date().toISOString(),
      };

      const { error } = await saveProductionEntryWithConsumption(supabase, entry);
      if (error) {
        const saveMessage = `Quick entry was not saved. ${error}`;
        setQuickError(saveMessage);
        toast.error(saveMessage);
        return;
      }

      toast.success('Output saved. Material stock updated.');
      setQuickError('');
      clearQuickDraft();
      await refreshData();
      setQuickForm(prev => prefillQuickEntryAfterSave(prev, quickFactoryId));
    } finally {
      setSaving(false);
    }
  };

  const colourwayOptionsForRow = (row: GridRow) => {
    const opts = getColourwayOptions(row.orderId, row.module);
    const groups: Record<string, { label: string; items: ColourwayOption[] }> = {};
    for (const o of opts) {
      const key = o.productLabel || '__unknown__';
      if (!groups[key]) groups[key] = { label: o.productLabel, items: [] };
      groups[key].items.push(o);
    }
    return Object.values(groups);
  };

  if (mode === 'quick') {
    return (
      <Card className="mt-3">
        <CardContent className="pt-4 space-y-4">
          {quickError && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription data-testid="quick-entry-error" className="text-sm">{quickError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-sm">Date</Label>
              <Input className="h-12 text-base" type="date" value={quickForm.date} onChange={e => updateQuickForm('date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Module</Label>
              <Select value={quickForm.module} onValueChange={v => updateQuickForm('module', v)}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="printing">Printing</SelectItem><SelectItem value="stitching">Stitching</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-sm">Factory</Label>
              <Select value={quickFactoryId} onValueChange={v => updateQuickForm('factoryId', v)}>
                <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select factory" /></SelectTrigger>
                <SelectContent>{data.factories.filter(f => f.active).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Order</Label>
              <Select value={quickForm.orderId} onValueChange={v => updateQuickForm('orderId', v)}>
                <SelectTrigger data-testid="quick-order" className="h-14 text-base"><SelectValue placeholder="Select order" /></SelectTrigger>
                <SelectContent>
                  {quickOrders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.internalPO}{o.style ? ` - ${o.style}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Colour</Label>
              <Select value={quickForm.colourwayId} onValueChange={v => updateQuickForm('colourwayId', v)} disabled={!quickForm.orderId}>
                <SelectTrigger data-testid="quick-colour" className="h-14 text-base"><SelectValue placeholder={quickForm.orderId ? 'Select colour' : 'Select order first'} /></SelectTrigger>
                <SelectContent>
                  {(orderRowsCache[quickForm.orderId] || []).length === 0 && quickForm.orderId && (
                    <SelectItem value="__loading__" disabled>Loading colours...</SelectItem>
                  )}
                  {quickColourways.map(cw => (
                    <SelectItem key={cw.id} value={cw.id}>
                      {cw.productLabel ? `${cw.productLabel} - ` : ''}{cw.colourName}
                    </SelectItem>
                  ))}
                  {quickForm.orderId && (orderRowsCache[quickForm.orderId]?.length || 0) > 0 && quickColourways.length === 0 && (
                    <SelectItem value="__none__" disabled>No colourways</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {quickForm.module === 'printing' && !!quickSelectedRow?.no_of_colours && (
                <Badge variant="outline" className="text-[10px]">{quickSelectedRow.no_of_colours}-colour print</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-sm">Shift</Label>
              <Select value={quickForm.shiftId} onValueChange={v => updateQuickForm('shiftId', v)} disabled={!quickFactoryId}>
                <SelectTrigger className="h-14 text-base"><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>{quickShifts.length === 0 ? <SelectItem value="__none__" disabled>No shifts</SelectItem> : quickShifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{quickResourceLabel}</Label>
              <Select value={quickForm.resourceId} onValueChange={v => updateQuickForm('resourceId', v)} disabled={!quickFactoryId}>
                <SelectTrigger data-testid="quick-resource" data-resource-count={quickResources.length} className="h-14 text-base"><SelectValue placeholder={`Select ${quickResourceLabel.toLowerCase()}`} /></SelectTrigger>
                <SelectContent>{quickResources.length === 0 ? <SelectItem value="__none__" disabled>No resources</SelectItem> : quickResources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code ? `${r.code} - ` : ''}{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Worker Type</Label>
              <Select value={quickForm.workerTypeId} onValueChange={v => updateQuickForm('workerTypeId', v)}>
                <SelectTrigger className="h-14 text-base"><SelectValue placeholder="Select worker type" /></SelectTrigger>
                <SelectContent>{quickWorkerTypes.map(w => <SelectItem key={w.id} value={w.id}>{workerLabel(w)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Persons</Label>
              <Input className="h-14 text-base" type="number" min={0} value={quickForm.personsUsed} onChange={e => updateQuickForm('personsUsed', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="space-y-1">
              <Label className="text-sm">Output</Label>
              <Input data-testid="quick-output" className="h-16 text-2xl font-semibold" type="number" min={0} value={quickForm.outputQty || ''} onChange={e => updateQuickForm('outputQty', parseFloat(e.target.value) || 0)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">UOM</Label>
              <Input className="h-16 text-base" value={quickForm.outputUOM} onChange={e => updateQuickForm('outputUOM', e.target.value)} placeholder={quickSelectedColourway?.uom || 'pcs'} />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Cost </span>
              <span className="font-semibold font-mono">₹{quickCost.toFixed(2)}</span>
              {quickRate ? <span className="ml-2 text-xs text-muted-foreground">{quickRate.rateBasis.replace(/_/g, ' ')}</span> : null}
            </div>
            <SaveButton data-testid="quick-save" className="h-14 text-base sm:min-w-[180px]" saving={saving} onClick={handleQuickSave}>
              Save Entry
            </SaveButton>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            <Button size="sm" onClick={handleSaveAll} disabled={saving || validCount === 0 || noFactory}>{saving ? 'Saving...' : `Save ${validCount} Entries`}</Button>
          </div>
        </div>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8 min-w-[100px]">Date</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[90px]">Module</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[140px]">Order</TableHead>
                <TableHead className="text-[10px] h-8 min-w-[230px]">Product / Colour</TableHead>
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
              {rows.map(row => {
                const cwGroups = colourwayOptionsForRow(row);
                return (
                  <TableRow key={row.id} className={row.saveError || (row.errors.length > 0 && (row.orderId || row.shiftId)) ? 'bg-destructive/5' : ''}>
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
                      <div className="flex gap-1">
                        <Select value={row.orderRowId} onValueChange={v => updateRow(row.id, 'orderRowId', v)} disabled={!row.orderId}>
                          <SelectTrigger className="h-7 text-[11px] w-[100px]"><SelectValue placeholder="Product" /></SelectTrigger>
                          <SelectContent>
                            {(orderRowsCache[row.orderId] || []).length === 0 && row.orderId && (
                              <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                            )}
                            {(orderRowsCache[row.orderId] || []).map((rr: any) => (
                              <SelectItem key={rr.id} value={rr.id} className="text-[11px]">
                                {rr.productLabel || rr.id.slice(0, 8)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={row.colourwayId} onValueChange={v => updateRow(row.id, 'colourwayId', v)}
                          disabled={!row.orderId || (!row.orderRowId && (orderRowsCache[row.orderId]?.length || 0) > 1)}>
                          <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue placeholder={
                            !row.orderId ? 'Order first'
                            : (!row.orderRowId && (orderRowsCache[row.orderId]?.length || 0) > 1) ? 'Product first'
                            : 'Colour'
                          } /></SelectTrigger>
                          <SelectContent>
                            {(row.orderRowId && cwGroups.length === 0) && (
                              <SelectItem value="__loading__" disabled>Loading colours...</SelectItem>
                            )}
                            {cwGroups
                              .filter(g => !row.orderRowId || g.items.some(c => c.orderRowId === row.orderRowId))
                              .flatMap(g => g.items.filter(c => !row.orderRowId || c.orderRowId === row.orderRowId))
                              .map(cw => (
                                <SelectItem key={cw.id} value={cw.id} className="text-[11px]">
                                  {cw.colourName}
                                </SelectItem>
                              ))}
                            {row.orderId && (orderRowsCache[row.orderId]?.length || 0) > 0 && cwGroups.flatMap(g => g.items).length === 0 && (
                              <SelectItem value="__none__" disabled>No colourways</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="py-1">
                      <Select value={row.shiftId} onValueChange={v => updateRow(row.id, 'shiftId', v)} disabled={noFactory}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Shift" /></SelectTrigger>
                        <SelectContent>
                          {shifts.length === 0 ? <SelectItem value="__none__" disabled>No shifts</SelectItem> : shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-1">
                      <Select value={row.resourceId} onValueChange={v => updateRow(row.id, 'resourceId', v)} disabled={noFactory}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Resource" /></SelectTrigger>
                        <SelectContent>
                          {getResources(row).length === 0 ? <SelectItem value="__none__" disabled>No resources</SelectItem> : getResources(row).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-1">
                      <Select value={row.workerTypeId} onValueChange={v => updateRow(row.id, 'workerTypeId', v)}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>{filteredWorkerTypes(row.module).map(w => <SelectItem key={w.id} value={w.id}>{workerLabel(w)}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-1"><Input className="h-7 text-[11px]" type="number" min={0} value={row.personsUsed} onChange={e => updateRow(row.id, 'personsUsed', parseInt(e.target.value) || 0)} /></TableCell>
                    <TableCell className="py-1">
                      <Input className="h-7 text-[11px]" type="number" min={0} value={row.outputQty} onChange={e => updateRow(row.id, 'outputQty', parseFloat(e.target.value) || 0)} />
                      {row.rateBasis === 'per_person_per_shift' && (
                        <div className="text-[9px] text-muted-foreground mt-0.5 leading-none">n/a — per-person rate</div>
                      )}
                    </TableCell>
                    <TableCell className="py-1 text-[11px] font-mono">₹{row.costPreview.toFixed(0)}</TableCell>
                    <TableCell className="py-1">
                      {row.saveError ? <span title={row.saveError}><X className="h-3.5 w-3.5 text-destructive" /></span> : row.valid ? <Check className="h-3.5 w-3.5 text-green-600" /> : row.errors.length > 0 && (row.orderId || row.shiftId) ? <span title={row.errors.join(', ')}><X className="h-3.5 w-3.5 text-destructive" /></span> : null}
                    </TableCell>
                    <TableCell className="py-1">{rows.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(row.id)}><Trash2 className="h-3 w-3" /></Button>}</TableCell>
                  </TableRow>
                );
              })}
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
