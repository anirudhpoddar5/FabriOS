import { useState, useMemo, useEffect } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { RateMaster, ProductionEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { saveProductionEntryWithConsumption } from '@/lib/material-auto-consumption';

function findActiveRate(rateMasters: RateMaster[], factoryId: string, shiftId: string, workerTypeId: string, date: string): RateMaster | null {
  return rateMasters.find(r =>
    r.active && r.factoryId === factoryId && r.shiftId === shiftId && r.workerTypeId === workerTypeId &&
    r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date)
  ) || null;
}

function calcCost(rate: RateMaster | null, personsUsed: number, outputQty: number): number {
  if (!rate) return 0;
  if (rate.rateBasis === 'per_person_per_shift') return personsUsed * rate.rateValue;
  return outputQty * rate.rateValue;
}

interface Props {
  defaultModule?: 'printing' | 'stitching';
}

interface ColourwayOption {
  id: string;
  colourName: string;
  orderRowId: string;
  productName: string;
  productCode: string;
}

export default function SingleEntryForm({ defaultModule }: Props) {
  const { data, refreshData, currentFactoryId, setCurrentFactoryId } = useData();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    module: (defaultModule || 'printing') as 'printing' | 'stitching',
    factoryId: currentFactoryId || '',
    orderId: '',
    colourwayId: '',
    shiftId: '',
    resourceId: '',
    workerTypeId: '',
    personsUsed: 0,
    outputQty: 0,
    outputUOM: '',
    notes: '',
  });
  const [orderRows, setOrderRows] = useState<any[]>([]);

  useEffect(() => {
    if (currentFactoryId && form.factoryId !== currentFactoryId) {
      setForm(prev => ({ ...prev, factoryId: currentFactoryId }));
    }
  }, [currentFactoryId]);

  useEffect(() => {
    if (!form.factoryId && data.factories.length === 1) {
      const fid = data.factories[0].id;
      setForm(prev => ({ ...prev, factoryId: fid }));
      setCurrentFactoryId(fid);
    }
  }, [data.factories]);

  useEffect(() => {
    if (defaultModule) {
      setForm(prev => ({ ...prev, module: defaultModule, orderId: '', colourwayId: '', resourceId: '', workerTypeId: '' }));
    }
  }, [defaultModule]);

  // Fetch order rows when order changes
  useEffect(() => {
    if (!form.orderId) { setOrderRows([]); return; }
    supabase.from('order_rows').select('*').eq('order_id', form.orderId).order('sort_order').then(({ data: rows }) => {
      if (rows) {
        const enriched = rows.map((r: any) => {
          const product = form.module === 'printing'
            ? data.printingProducts.find((p: any) => p.id === r.product_id)
            : data.stitchingProducts.find((p: any) => p.id === r.product_id);
          return { ...r, productName: product?.name || '—', productCode: product?.code || '' };
        });
        setOrderRows(enriched);
      }
    });
  }, [form.orderId, form.module, data.printingProducts, data.stitchingProducts]);

  const activeFactoryId = form.factoryId || currentFactoryId;
  const factories = data.factories.filter(f => f.active);

  const orders = form.module === 'printing'
    ? data.printingOrders.filter(o => o.status !== 'Cancelled')
    : data.stitchingOrders.filter(o => o.status !== 'Cancelled');

  // Build colourway options grouped by product row
  const colourwayOptions: ColourwayOption[] = useMemo(() => {
    const allColourways = form.module === 'printing' ? data.printingColourways : data.stitchingColourways;
    const result: ColourwayOption[] = [];
    for (const row of orderRows) {
      const rowColourways = allColourways.filter((c: any) => c.orderRowId === row.id);
      for (const cw of rowColourways) {
        result.push({
          id: cw.id,
          colourName: cw.colourName,
          orderRowId: row.id,
          productName: row.productName || '—',
          productCode: row.productCode || '',
        });
      }
    }
    return result;
  }, [orderRows, form.module, data.printingColourways, data.stitchingColourways]);

  // Derive orderRowId from selected colourway
  const selectedColourway = colourwayOptions.find(c => c.id === form.colourwayId);

  const shifts = data.shifts.filter(s => s.active && (!activeFactoryId || s.factoryId === activeFactoryId));
  const workerTypes = data.workerTypes.filter(w => w.active && (w.module === form.module || w.module === 'both'));
  const resources = activeFactoryId
    ? (form.module === 'printing'
      ? data.printingTables.filter(t => t.active && t.factoryId === activeFactoryId)
      : data.stitchingLines.filter(l => l.active && l.factoryId === activeFactoryId))
    : [];

  const activeRate = useMemo(() => {
    if (!activeFactoryId || !form.shiftId || !form.workerTypeId) return null;
    return findActiveRate(data.rateMasters, activeFactoryId, form.shiftId, form.workerTypeId, form.date);
  }, [data.rateMasters, activeFactoryId, form.shiftId, form.workerTypeId, form.date]);

  const costPreview = calcCost(activeRate, form.personsUsed, form.outputQty);
  const resourceLabel = form.module === 'printing' ? 'Table' : 'Line';

  const handleFactoryChange = (fid: string) => {
    setForm(prev => ({ ...prev, factoryId: fid, shiftId: '', resourceId: '' }));
    setCurrentFactoryId(fid);
  };

  const handleSave = async () => {
    if (!activeFactoryId) { toast.error('Select a factory'); return; }
    if (!form.orderId) { toast.error('Order is required'); return; }
    if (!form.colourwayId) { toast.error('Colour is required'); return; }
    if (!form.shiftId) { toast.error('Shift is required'); return; }
    if (!form.resourceId) { toast.error(`${resourceLabel} is required`); return; }
    if (!form.workerTypeId) { toast.error('Worker type is required'); return; }
    if (form.personsUsed < 0) { toast.error('Persons cannot be negative'); return; }
    if (form.outputQty < 0) { toast.error('Output cannot be negative'); return; }
    if (!activeRate) { toast.error('No active rate found for this combination'); return; }

    const entry: ProductionEntry = {
      id: generateId(), date: form.date, module: form.module, orderId: form.orderId,
      orderRowId: selectedColourway?.orderRowId,
      colourwayId: form.colourwayId, factoryId: activeFactoryId, shiftId: form.shiftId,
      resourceId: form.resourceId, workerTypeId: form.workerTypeId, personsUsed: form.personsUsed,
      outputQty: form.outputQty, outputUOM: form.outputUOM, rateMasterId: activeRate.id,
      rateBasis: activeRate.rateBasis, rateValue: activeRate.rateValue, costAmount: costPreview,
      notes: form.notes, createdAt: new Date().toISOString(),
    };

    const result = await saveProductionEntryWithConsumption(supabase, entry);
    if (result.error) { toast.error(`Failed to save: ${result.error}`); return; }
    await refreshData();
    toast.success(result.data?.consumptionStatus === 'consumed'
      ? 'Output saved. Material stock updated.'
      : 'Output saved. No BOM material was deducted.');
    setForm(prev => ({ ...prev, orderId: '', colourwayId: '', personsUsed: 0, outputQty: 0, notes: '' }));
    setOrderRows([]);
  };

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Card className="mt-3">
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1"><Label className="text-xs">Date *</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Module *</Label>
            <Select value={form.module} onValueChange={v => { set('module', v); set('orderId', ''); set('colourwayId', ''); set('resourceId', ''); set('workerTypeId', ''); setOrderRows([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="printing">Printing</SelectItem>
                <SelectItem value="stitching">Stitching</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Factory *</Label>
            <Select value={activeFactoryId || ''} onValueChange={handleFactoryChange}>
              <SelectTrigger><SelectValue placeholder="Select factory" /></SelectTrigger>
              <SelectContent>{factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Order *</Label>
            <Select value={form.orderId} onValueChange={v => { set('orderId', v); set('colourwayId', ''); }}>
              <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
              <SelectContent>{orders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.internalPO}{o.style ? ` - ${o.style}` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {orderRows.length > 1 && (
            <div className="space-y-1"><Label className="text-xs">Product Row *</Label>
              <Select value={selectedColourway?.orderRowId || ''} onValueChange={v => set('colourwayId', '')} disabled={!form.orderId}>
                <SelectTrigger><SelectValue placeholder={form.orderId ? 'Select product' : 'Select order first'} /></SelectTrigger>
                <SelectContent>
                  {orderRows.map(row => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.productCode && `${row.productCode} — `}{row.productName} ({row.uom})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1"><Label className="text-xs">Colour *</Label>
            <Select value={form.colourwayId} onValueChange={v => set('colourwayId', v)}
              disabled={!form.orderId || (orderRows.length > 1 && !selectedColourway?.orderRowId)}>
              <SelectTrigger><SelectValue placeholder={
                !form.orderId ? 'Select order first'
                : orderRows.length > 1 && !selectedColourway?.orderRowId ? 'Select product first'
                : 'Select colour'
              } /></SelectTrigger>
              <SelectContent>
                {orderRows.length === 0 && form.orderId && (
                  <SelectItem value="__loading__" disabled>Loading colours...</SelectItem>
                )}
                {colourwayOptions
                  .filter(c => !selectedColourway?.orderRowId || c.orderRowId === selectedColourway.orderRowId)
                  .map(cw => (
                    <SelectItem key={cw.id} value={cw.id}>
                      {cw.colourName}
                    </SelectItem>
                  ))}
                {colourwayOptions.length === 0 && form.orderId && orderRows.length > 0 && (
                  <SelectItem value="__none__" disabled>No colourways for this order</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedColourway && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Product: {selectedColourway.productCode} — {selectedColourway.productName}</Badge>
            <Badge variant="outline" className="text-[10px]">Colour: {selectedColourway.colourName}</Badge>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1"><Label className="text-xs">Shift *</Label>
            <Select value={form.shiftId} onValueChange={v => set('shiftId', v)} disabled={!activeFactoryId}>
              <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
              <SelectContent>{shifts.length === 0 ? <SelectItem value="__none__" disabled>No shifts available</SelectItem> : shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">{resourceLabel} *</Label>
            <Select value={form.resourceId} onValueChange={v => set('resourceId', v)} disabled={!activeFactoryId}>
              <SelectTrigger><SelectValue placeholder={`Select ${resourceLabel.toLowerCase()}`} /></SelectTrigger>
              <SelectContent>{resources.length === 0 ? <SelectItem value="__none__" disabled>No resources available</SelectItem> : resources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code ? `${r.code} - ` : ''}{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Worker Type *</Label>
            <Select value={form.workerTypeId} onValueChange={v => set('workerTypeId', v)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{workerTypes.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1"><Label className="text-xs">Persons Used</Label><Input type="number" min={0} value={form.personsUsed} onChange={e => set('personsUsed', parseInt(e.target.value) || 0)} /></div>
          <div className="space-y-1"><Label className="text-xs">Output Qty</Label><Input type="number" min={0} value={form.outputQty} onChange={e => set('outputQty', parseFloat(e.target.value) || 0)} /></div>
          <div className="space-y-1"><Label className="text-xs">UOM</Label><Input value={form.outputUOM} onChange={e => set('outputUOM', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Rate: </span>
            {activeRate ? <span className="font-mono">{activeRate.rateValue} ({activeRate.rateBasis.replace(/_/g, ' ')})</span> : <span className="text-destructive text-xs">No active rate</span>}
            <span className="mx-3 text-muted-foreground">|</span>
            <span className="text-muted-foreground">Cost: </span>
            <span className="font-semibold font-mono">₹{costPreview.toFixed(2)}</span>
          </div>
          <Button onClick={handleSave} disabled={!activeFactoryId}>Save Entry</Button>
        </div>
      </CardContent>
    </Card>
  );
}
