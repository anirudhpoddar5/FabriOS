import { useState, useMemo } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { Factory, Shift } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Copy, Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ExplainerTip } from '@/components/ExplainerTip';

export default function FactoriesShiftsPage() {
  const { data, addItem, addItems, updateItem } = useData();
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [factoryDialog, setFactoryDialog] = useState(false);
  const [shiftDialog, setShiftDialog] = useState(false);
  const [bulkShiftMode, setBulkShiftMode] = useState(false);
  const [copyDialog, setCopyDialog] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [bulkRows, setBulkRows] = useState<any[]>([]);

  const factories = data.factories;
  const selectedFactory = factories.find(f => f.id === selectedFactoryId);
  const factoryShifts = useMemo(() =>
    data.shifts.filter(s => s.factoryId === selectedFactoryId),
    [data.shifts, selectedFactoryId]
  );

  const filteredFactories = useMemo(() => {
    if (!search) return factories;
    const s = search.toLowerCase();
    return factories.filter(f => f.name.toLowerCase().includes(s) || f.code.toLowerCase().includes(s));
  }, [factories, search]);

  // Factory CRUD
  const handleAddFactory = () => { setEditingId(null); setForm({ code: '', name: '', type: 'mixed', active: true }); setFactoryDialog(true); };
  const handleEditFactory = (f: Factory) => { setEditingId(f.id); setForm({ ...f }); setFactoryDialog(true); };
  const handleSaveFactory = async () => {
    if (!form.code) { toast.error('Code required'); return; }
    if (!form.name) { toast.error('Name required'); return; }
    let result: { error: string | null };
    if (editingId) { result = await updateItem('factories', editingId, form); }
    else { result = await addItem('factories', { ...form, id: generateId() } as Factory); }
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(editingId ? 'Factory updated' : 'Factory added');
    setFactoryDialog(false);
  };

  // Shift CRUD
  const handleAddShift = () => { setEditingId(null); setForm({ factoryId: selectedFactoryId, code: '', name: '', startTime: '08:00', endTime: '17:00', active: true }); setShiftDialog(true); };
  const handleEditShift = (s: Shift) => { setEditingId(s.id); setForm({ ...s }); setShiftDialog(true); };
  const handleSaveShift = async () => {
    if (!form.code || !form.name) { toast.error('Code and name required'); return; }
    let result: { error: string | null };
    if (editingId) { result = await updateItem('shifts', editingId, form); }
    else { result = await addItem('shifts', { ...form, id: generateId() } as Shift); }
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(editingId ? 'Shift updated' : 'Shift added');
    setShiftDialog(false);
  };

  // Bulk shift entry
  const handleOpenBulk = () => {
    setBulkRows([{ id: crypto.randomUUID(), code: '', name: '', startTime: '08:00', endTime: '17:00' }]);
    setBulkShiftMode(true);
  };
  const addBulkRow = () => setBulkRows(prev => [...prev, { id: crypto.randomUUID(), code: '', name: '', startTime: '08:00', endTime: '17:00' }]);
  const updateBulkRow = (id: string, field: string, value: string) => setBulkRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const saveBulkShifts = async () => {
    const valid = bulkRows.filter(r => r.code && r.name);
    if (valid.length === 0) { toast.error('No valid rows'); return; }
    const items = valid.map(r => ({ id: generateId(), factoryId: selectedFactoryId!, code: r.code, name: r.name, startTime: r.startTime, endTime: r.endTime, active: true }));
    const result = await addItems('shifts', items as Shift[]);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`Added ${items.length} shifts`);
    setBulkShiftMode(false);
  };

  // Copy shifts
  const handleCopyShifts = async () => {
    if (!copySourceId || !selectedFactoryId) return;
    const sourceShifts = data.shifts.filter(s => s.factoryId === copySourceId && s.active);
    if (sourceShifts.length === 0) { toast.error('No shifts to copy'); return; }
    const items = sourceShifts.map(s => ({ ...s, id: generateId(), factoryId: selectedFactoryId }));
    const result = await addItems('shifts', items as Shift[]);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`Copied ${items.length} shifts`);
    setCopyDialog(false);
  };

  // Paste handler for bulk
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    const lines = text.trim().split('\n').map(l => l.split('\t'));
    const newRows = lines.map(cols => ({
      id: crypto.randomUUID(),
      code: cols[0] || '',
      name: cols[1] || '',
      startTime: cols[2] || '08:00',
      endTime: cols[3] || '17:00',
    }));
    setBulkRows(prev => [...prev, ...newRows]);
    toast.info(`Pasted ${newRows.length} rows`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">Factories & Shifts <ExplainerTip text="Add factories for your production locations. Each factory can be Printing, Stitching, or Mixed. Configure shifts per factory with start/end times. Use the copy feature to duplicate shifts across factories." /></h1>
        <Button size="sm" onClick={handleAddFactory}><Plus className="h-3.5 w-3.5 mr-1" /> Add Factory</Button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Search factories..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs h-9">Code</TableHead>
              <TableHead className="text-xs h-9">Name</TableHead>
              <TableHead className="text-xs h-9">Type</TableHead>
              <TableHead className="text-xs h-9 w-[100px]">Status</TableHead>
              <TableHead className="text-xs h-9 w-[100px]">Shifts</TableHead>
              <TableHead className="text-xs h-9 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFactories.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No factories</TableCell></TableRow>
            ) : filteredFactories.map(f => (
              <TableRow key={f.id} className={`cursor-pointer ${selectedFactoryId === f.id ? 'bg-accent' : ''}`} onClick={() => setSelectedFactoryId(f.id)}>
                <TableCell className="text-sm py-2 font-mono">{f.code}</TableCell>
                <TableCell className="text-sm py-2">{f.name}</TableCell>
                <TableCell className="text-sm py-2 capitalize">{f.type}</TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={f.active} onCheckedChange={() => updateItem('factories', f.id, { active: !f.active } as any)} className="scale-75" />
                    <Badge variant={f.active ? 'default' : 'secondary'} className="text-[10px]">{f.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-sm py-2">{data.shifts.filter(s => s.factoryId === f.id).length}</TableCell>
                <TableCell className="py-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); handleEditFactory(f); }}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedFactory && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Shifts — {selectedFactory.name}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setCopySourceId(''); setCopyDialog(true); }}><Copy className="h-3 w-3 mr-1" /> Copy From</Button>
                <Button size="sm" variant="outline" onClick={handleOpenBulk}><Plus className="h-3 w-3 mr-1" /> Bulk Add</Button>
                <Button size="sm" onClick={handleAddShift}><Plus className="h-3 w-3 mr-1" /> Add Shift</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {bulkShiftMode ? (
              <div onPaste={handlePaste}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs h-8">Code</TableHead>
                      <TableHead className="text-xs h-8">Name</TableHead>
                      <TableHead className="text-xs h-8">Start</TableHead>
                      <TableHead className="text-xs h-8">End</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkRows.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="py-1"><Input className="h-7 text-xs" value={r.code} onChange={e => updateBulkRow(r.id, 'code', e.target.value)} /></TableCell>
                        <TableCell className="py-1"><Input className="h-7 text-xs" value={r.name} onChange={e => updateBulkRow(r.id, 'name', e.target.value)} /></TableCell>
                        <TableCell className="py-1"><Input className="h-7 text-xs" type="time" value={r.startTime} onChange={e => updateBulkRow(r.id, 'startTime', e.target.value)} /></TableCell>
                        <TableCell className="py-1"><Input className="h-7 text-xs" type="time" value={r.endTime} onChange={e => updateBulkRow(r.id, 'endTime', e.target.value)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={addBulkRow}>Add Row</Button>
                  <Button size="sm" onClick={saveBulkShifts}>Save All</Button>
                  <Button size="sm" variant="ghost" onClick={() => setBulkShiftMode(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Code</TableHead>
                    <TableHead className="text-xs h-8">Name</TableHead>
                    <TableHead className="text-xs h-8">Start</TableHead>
                    <TableHead className="text-xs h-8">End</TableHead>
                    <TableHead className="text-xs h-8 w-[80px]">Status</TableHead>
                    <TableHead className="text-xs h-8 w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factoryShifts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-4">No shifts for this factory</TableCell></TableRow>
                  ) : factoryShifts.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm py-1">{s.code}</TableCell>
                      <TableCell className="text-sm py-1">{s.name}</TableCell>
                      <TableCell className="text-sm py-1">{s.startTime}</TableCell>
                      <TableCell className="text-sm py-1">{s.endTime}</TableCell>
                      <TableCell className="py-1">
                        <Switch checked={s.active} onCheckedChange={() => updateItem('shifts', s.id, { active: !s.active } as any)} className="scale-75" />
                      </TableCell>
                      <TableCell className="py-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditShift(s)}><Pencil className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Factory Dialog */}
      <Dialog open={factoryDialog} onOpenChange={setFactoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Factory</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label className="text-xs">Factory Code *</Label><Input value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Factory Name *</Label><Input value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Type *</Label>
              <Select value={form.type || 'mixed'} onValueChange={v => setForm((p: any) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="printing">Printing</SelectItem>
                  <SelectItem value="stitching">Stitching</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFactoryDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveFactory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Dialog */}
      <Dialog open={shiftDialog} onOpenChange={setShiftDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Shift</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label className="text-xs">Shift Code *</Label><Input value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Shift Name *</Label><Input value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Start Time *</Label><Input type="time" value={form.startTime || ''} onChange={e => setForm((p: any) => ({ ...p, startTime: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">End Time *</Label><Input type="time" value={form.endTime || ''} onChange={e => setForm((p: any) => ({ ...p, endTime: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveShift}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Dialog */}
      <Dialog open={copyDialog} onOpenChange={setCopyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Copy Shifts From</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={copySourceId} onValueChange={setCopySourceId}>
              <SelectTrigger><SelectValue placeholder="Select source factory" /></SelectTrigger>
              <SelectContent>
                {factories.filter(f => f.id !== selectedFactoryId).map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name} ({data.shifts.filter(s => s.factoryId === f.id).length} shifts)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialog(false)}>Cancel</Button>
            <Button onClick={handleCopyShifts}>Copy Shifts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
