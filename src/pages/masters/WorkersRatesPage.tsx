import { useState, useMemo } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { WorkerType, RateMaster } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Copy, AlertTriangle, Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const basisLabels: Record<string, string> = { per_person_per_shift: 'Per Person/Shift', per_piece: 'Per Piece', per_meter: 'Per Meter' };

function daysUntilExpiry(effectiveTo?: string): number | null {
  if (!effectiveTo) return null;
  const diff = (new Date(effectiveTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
}

export default function WorkersRatesPage() {
  const { data, addItem, addItems, updateItem } = useData();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [workerDialog, setWorkerDialog] = useState(false);
  const [rateDialog, setRateDialog] = useState(false);
  const [bulkMode, setBulkMode] = useState<'workers' | 'rates' | null>(null);
  const [copyDialog, setCopyDialog] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [bulkRows, setBulkRows] = useState<any[]>([]);

  const workers = data.workerTypes;
  const factories = data.factories.filter(f => f.active);
  const shifts = data.shifts.filter(s => s.active);
  const selectedWorker = workers.find(w => w.id === selectedWorkerId);
  const workerRates = useMemo(() => data.rateMasters.filter(r => r.workerTypeId === selectedWorkerId), [data.rateMasters, selectedWorkerId]);

  const filteredWorkers = useMemo(() => {
    if (!search) return workers;
    const s = search.toLowerCase();
    return workers.filter(w => w.name.toLowerCase().includes(s));
  }, [workers, search]);

  const getFactoryName = (id: string) => data.factories.find(f => f.id === id)?.name || id;
  const getShiftName = (id: string) => data.shifts.find(s => s.id === id)?.name || id;

  // Worker CRUD
  const handleAddWorker = () => {
    setEditingId(null);
    setForm({ name: '', factoryId: '', module: 'both', active: true, defaultRateBasis: 'per_person_per_shift', defaultRateValue: 0 });
    setWorkerDialog(true);
  };
  const handleEditWorker = (w: WorkerType) => { setEditingId(w.id); setForm({ ...w }); setWorkerDialog(true); };
  const handleSaveWorker = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    if (editingId) {
      const result = await updateItem('workerTypes', editingId, form);
      if (result.error) { toast.error(`Failed: ${result.error}`); return; }
      toast.success('Updated');
    } else {
      const workerId = generateId();
      const result = await addItem('workerTypes', { ...form, id: workerId } as WorkerType);
      if (result.error) { toast.error(`Failed: ${result.error}`); return; }
      if (form.defaultRateValue > 0 && factories.length > 0 && shifts.length > 0) {
        const factoryId = form.factoryId || factories[0]?.id;
        const factoryShifts = shifts.filter(s => s.factoryId === factoryId);
        if (factoryShifts.length > 0) {
          const rates = factoryShifts.map(s => ({
            id: generateId(), factoryId, shiftId: s.id, workerTypeId: workerId,
            rateBasis: form.defaultRateBasis || 'per_person_per_shift',
            rateValue: form.defaultRateValue,
            effectiveFrom: new Date().toISOString().slice(0, 10),
            effectiveTo: '', active: true,
          }));
          await addItems('rateMasters', rates as RateMaster[]);
          toast.success(`Added worker with ${rates.length} rate(s)`);
        } else {
          toast.success('Added worker');
        }
      } else {
        toast.success('Added worker');
      }
    }
    setWorkerDialog(false);
  };

  // Rate CRUD
  const handleAddRate = () => { setEditingId(null); setForm({ factoryId: '', shiftId: '', workerTypeId: selectedWorkerId, rateBasis: 'per_person_per_shift', rateValue: 0, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', active: true }); setRateDialog(true); };
  const handleEditRate = (r: RateMaster) => { setEditingId(r.id); setForm({ ...r }); setRateDialog(true); };
  const handleSaveRate = async () => {
    if (!form.factoryId || !form.shiftId) { toast.error('Factory and shift required'); return; }
    if (form.rateValue <= 0) { toast.error('Rate must be > 0'); return; }
    let result: { error: string | null };
    if (editingId) { result = await updateItem('rateMasters', editingId, form); }
    else { result = await addItem('rateMasters', { ...form, id: generateId() } as RateMaster); }
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(editingId ? 'Rate updated' : 'Rate added');
    setRateDialog(false);
  };

  // Bulk workers
  const handleBulkWorkers = () => {
    setBulkRows([{ id: crypto.randomUUID(), name: '', factoryId: '', module: 'both', rateBasis: 'per_person_per_shift', rateValue: 0 }]);
    setBulkMode('workers');
  };
  const saveBulkWorkers = async () => {
    const valid = bulkRows.filter(r => r.name);
    if (valid.length === 0) { toast.error('No valid rows'); return; }
    const result = await addItems('workerTypes', valid.map(r => ({ id: generateId(), name: r.name, factoryId: r.factoryId || '', module: r.module, active: true })) as WorkerType[]);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`Added ${valid.length} workers`);
    setBulkMode(null);
  };

  // Bulk rates
  const handleBulkRates = () => {
    setBulkRows([{ id: crypto.randomUUID(), factoryId: '', shiftId: '', rateBasis: 'per_person_per_shift', rateValue: 0, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '' }]);
    setBulkMode('rates');
  };
  const saveBulkRates = async () => {
    const valid = bulkRows.filter(r => r.factoryId && r.shiftId && r.rateValue > 0);
    if (valid.length === 0) { toast.error('No valid rows'); return; }
    const result = await addItems('rateMasters', valid.map(r => ({ id: generateId(), ...r, workerTypeId: selectedWorkerId!, active: true })) as RateMaster[]);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`Added ${valid.length} rates`);
    setBulkMode(null);
  };

  // Copy rates
  const handleCopyRates = async () => {
    if (!copySourceId || !selectedWorkerId) return;
    const sourceRates = data.rateMasters.filter(r => r.workerTypeId === copySourceId && r.active);
    if (sourceRates.length === 0) { toast.error('No rates to copy'); return; }
    const result = await addItems('rateMasters', sourceRates.map(r => ({ ...r, id: generateId(), workerTypeId: selectedWorkerId })) as RateMaster[]);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`Copied ${sourceRates.length} rates`);
    setCopyDialog(false);
  };

  const addBulkRow = () => setBulkRows(prev => [...prev, { id: crypto.randomUUID(), ...(bulkMode === 'workers' ? { name: '', factoryId: '', module: 'both', rateBasis: 'per_person_per_shift', rateValue: 0 } : { factoryId: '', shiftId: '', rateBasis: 'per_person_per_shift', rateValue: 0, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '' }) }]);
  const updateBulkRow = (id: string, field: string, value: any) => setBulkRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Workers & Rates</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleBulkWorkers}><Plus className="h-3 w-3 mr-1" /> Bulk Add Workers</Button>
          <Button size="sm" onClick={handleAddWorker}><Plus className="h-3.5 w-3.5 mr-1" /> Add Worker</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Search workers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {bulkMode === 'workers' ? (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs h-8">Name</TableHead>
                <TableHead className="text-xs h-8">Factory</TableHead>
                <TableHead className="text-xs h-8">Module</TableHead>
                <TableHead className="text-xs h-8">Rate Basis</TableHead>
                <TableHead className="text-xs h-8">Default Rate</TableHead>
              </TableRow></TableHeader>
              <TableBody>{bulkRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.name} onChange={e => updateBulkRow(r.id, 'name', e.target.value)} /></TableCell>
                  <TableCell className="py-1">
                    <Select value={r.factoryId || 'none'} onValueChange={v => updateBulkRow(r.id, 'factoryId', v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Any</SelectItem>{factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1">
                    <Select value={r.module} onValueChange={v => updateBulkRow(r.id, 'module', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="printing">Printing</SelectItem><SelectItem value="stitching">Stitching</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1">
                    <Select value={r.rateBasis} onValueChange={v => updateBulkRow(r.id, 'rateBasis', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="per_person_per_shift">Per Person/Shift</SelectItem><SelectItem value="per_piece">Per Piece</SelectItem><SelectItem value="per_meter">Per Meter</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" type="number" step="0.01" value={r.rateValue || ''} onChange={e => updateBulkRow(r.id, 'rateValue', parseFloat(e.target.value) || 0)} /></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={addBulkRow}>Add Row</Button>
              <Button size="sm" onClick={saveBulkWorkers}>Save All</Button>
              <Button size="sm" variant="ghost" onClick={() => setBulkMode(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs h-9">Worker Type</TableHead>
              <TableHead className="text-xs h-9">Factory</TableHead>
              <TableHead className="text-xs h-9">Module</TableHead>
              <TableHead className="text-xs h-9 w-[80px]">Rates</TableHead>
              <TableHead className="text-xs h-9 w-[80px]">Status</TableHead>
              <TableHead className="text-xs h-9 w-[40px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredWorkers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No workers</TableCell></TableRow>
              ) : filteredWorkers.map(w => (
                <TableRow key={w.id} className={`cursor-pointer ${selectedWorkerId === w.id ? 'bg-accent' : ''}`} onClick={() => setSelectedWorkerId(w.id)}>
                  <TableCell className="text-sm py-2">{w.name}</TableCell>
                  <TableCell className="text-sm py-2">{w.factoryId ? getFactoryName(w.factoryId) : 'Any'}</TableCell>
                  <TableCell className="text-sm py-2 capitalize">{w.module}</TableCell>
                  <TableCell className="text-sm py-2">{data.rateMasters.filter(r => r.workerTypeId === w.id).length}</TableCell>
                  <TableCell className="py-2">
                    <Switch checked={w.active} onCheckedChange={async () => { const r = await updateItem('workerTypes', w.id, { active: !w.active } as any); if (r.error) toast.error(r.error); }} className="scale-75" />
                  </TableCell>
                  <TableCell className="py-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); handleEditWorker(w); }}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedWorker && !bulkMode && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Rates — {selectedWorker.name}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setCopySourceId(''); setCopyDialog(true); }}><Copy className="h-3 w-3 mr-1" /> Copy From</Button>
                <Button size="sm" variant="outline" onClick={handleBulkRates}><Plus className="h-3 w-3 mr-1" /> Bulk Add</Button>
                <Button size="sm" onClick={handleAddRate}><Plus className="h-3 w-3 mr-1" /> Add Rate</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {bulkMode === 'rates' ? (
              <div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs h-8">Factory</TableHead>
                    <TableHead className="text-xs h-8">Shift</TableHead>
                    <TableHead className="text-xs h-8">Basis</TableHead>
                    <TableHead className="text-xs h-8">Rate</TableHead>
                    <TableHead className="text-xs h-8">From</TableHead>
                    <TableHead className="text-xs h-8">To</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{bulkRows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="py-1">
                        <Select value={r.factoryId || ''} onValueChange={v => updateBulkRow(r.id, 'factoryId', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Factory" /></SelectTrigger>
                          <SelectContent>{factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-1">
                        <Select value={r.shiftId || ''} onValueChange={v => updateBulkRow(r.id, 'shiftId', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Shift" /></SelectTrigger>
                          <SelectContent>{shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-1">
                        <Select value={r.rateBasis} onValueChange={v => updateBulkRow(r.id, 'rateBasis', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="per_person_per_shift">Per Person/Shift</SelectItem><SelectItem value="per_piece">Per Piece</SelectItem><SelectItem value="per_meter">Per Meter</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-1"><Input className="h-7 text-xs" type="number" step="0.01" value={r.rateValue || ''} onChange={e => updateBulkRow(r.id, 'rateValue', parseFloat(e.target.value) || 0)} /></TableCell>
                      <TableCell className="py-1"><Input className="h-7 text-xs" type="date" value={r.effectiveFrom} onChange={e => updateBulkRow(r.id, 'effectiveFrom', e.target.value)} /></TableCell>
                      <TableCell className="py-1"><Input className="h-7 text-xs" type="date" value={r.effectiveTo || ''} onChange={e => updateBulkRow(r.id, 'effectiveTo', e.target.value)} /></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={addBulkRow}>Add Row</Button>
                  <Button size="sm" onClick={saveBulkRates}>Save All</Button>
                  <Button size="sm" variant="ghost" onClick={() => setBulkMode(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs h-8">Factory</TableHead>
                  <TableHead className="text-xs h-8">Shift</TableHead>
                  <TableHead className="text-xs h-8">Basis</TableHead>
                  <TableHead className="text-xs h-8">Rate</TableHead>
                  <TableHead className="text-xs h-8">From</TableHead>
                  <TableHead className="text-xs h-8">To</TableHead>
                  <TableHead className="text-xs h-8 w-[80px]">Status</TableHead>
                  <TableHead className="text-xs h-8 w-[40px]"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {workerRates.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-4">No rates defined — click "Add Rate" to define rates for this worker</TableCell></TableRow>
                  ) : workerRates.map(r => {
                    const days = daysUntilExpiry(r.effectiveTo);
                    const expiryWarning = days !== null && days <= 5;
                    const expired = days !== null && days < 0;
                    return (
                      <TableRow key={r.id} className={expired ? 'bg-destructive/5' : expiryWarning ? 'bg-warning/10' : ''}>
                        <TableCell className="text-sm py-1">{getFactoryName(r.factoryId)}</TableCell>
                        <TableCell className="text-sm py-1">{getShiftName(r.shiftId)}</TableCell>
                        <TableCell className="text-sm py-1">{basisLabels[r.rateBasis]}</TableCell>
                        <TableCell className="text-sm py-1 font-mono">{r.rateValue}</TableCell>
                        <TableCell className="text-sm py-1">{r.effectiveFrom}</TableCell>
                        <TableCell className="text-sm py-1">
                          <div className="flex items-center gap-1">
                            {r.effectiveTo || 'Forever'}
                            {expiryWarning && !expired && <AlertTriangle className="h-3 w-3 text-warning" />}
                            {expired && <Badge variant="destructive" className="text-[9px]">Expired</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="py-1">
                          <Switch checked={r.active} onCheckedChange={() => updateItem('rateMasters', r.id, { active: !r.active } as any)} className="scale-75" />
                        </TableCell>
                        <TableCell className="py-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditRate(r)}><Pencil className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Worker Dialog */}
      <Dialog open={workerDialog} onOpenChange={setWorkerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Worker Type</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Factory (Location)</Label>
              <Select value={form.factoryId || 'none'} onValueChange={v => setForm((p: any) => ({ ...p, factoryId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Any Factory</SelectItem>{factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Module</Label>
              <Select value={form.module || 'both'} onValueChange={v => setForm((p: any) => ({ ...p, module: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="printing">Printing</SelectItem><SelectItem value="stitching">Stitching</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent>
              </Select>
            </div>
            {!editingId && (
              <>
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Default Rate (optional — will auto-create rates for all shifts in the selected factory)</p>
                </div>
                <div className="space-y-1"><Label className="text-xs">Rate Basis</Label>
                  <Select value={form.defaultRateBasis || 'per_person_per_shift'} onValueChange={v => setForm((p: any) => ({ ...p, defaultRateBasis: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="per_person_per_shift">Per Person/Shift</SelectItem><SelectItem value="per_piece">Per Piece</SelectItem><SelectItem value="per_meter">Per Meter</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Default Rate Value</Label><Input type="number" step="0.01" value={form.defaultRateValue || ''} onChange={e => setForm((p: any) => ({ ...p, defaultRateValue: parseFloat(e.target.value) || 0 }))} placeholder="0.00" /></div>
              </>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setWorkerDialog(false)}>Cancel</Button><Button onClick={handleSaveWorker}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Dialog */}
      <Dialog open={rateDialog} onOpenChange={setRateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Rate</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label className="text-xs">Factory *</Label>
              <Select value={form.factoryId || ''} onValueChange={v => setForm((p: any) => ({ ...p, factoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select factory" /></SelectTrigger>
                <SelectContent>{factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Shift *</Label>
              <Select value={form.shiftId || ''} onValueChange={v => setForm((p: any) => ({ ...p, shiftId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>{shifts.filter(s => !form.factoryId || s.factoryId === form.factoryId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Rate Basis *</Label>
              <Select value={form.rateBasis || 'per_person_per_shift'} onValueChange={v => setForm((p: any) => ({ ...p, rateBasis: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="per_person_per_shift">Per Person/Shift</SelectItem><SelectItem value="per_piece">Per Piece</SelectItem><SelectItem value="per_meter">Per Meter</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Rate Value *</Label><Input type="number" step="0.01" value={form.rateValue || ''} onChange={e => setForm((p: any) => ({ ...p, rateValue: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">From *</Label><Input type="date" value={form.effectiveFrom || ''} onChange={e => setForm((p: any) => ({ ...p, effectiveFrom: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">To (blank = forever)</Label><Input type="date" value={form.effectiveTo || ''} onChange={e => setForm((p: any) => ({ ...p, effectiveTo: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRateDialog(false)}>Cancel</Button><Button onClick={handleSaveRate}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Rates Dialog */}
      <Dialog open={copyDialog} onOpenChange={setCopyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Copy Rates From Worker</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={copySourceId} onValueChange={setCopySourceId}>
              <SelectTrigger><SelectValue placeholder="Select source worker" /></SelectTrigger>
              <SelectContent>{workers.filter(w => w.id !== selectedWorkerId).map(w => <SelectItem key={w.id} value={w.id}>{w.name} ({data.rateMasters.filter(r => r.workerTypeId === w.id).length} rates)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCopyDialog(false)}>Cancel</Button><Button onClick={handleCopyRates}>Copy Rates</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
