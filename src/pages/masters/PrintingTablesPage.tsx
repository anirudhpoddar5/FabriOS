import { useState } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { PrintingTable } from '@/types';
import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function PrintingTablesPage() {
  const { data, addItems } = useData();
  const factories = data.factories.filter(f => f.active);
  const getFactory = (id: string) => data.factories.find(f => f.id === id)?.name || id;
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRows, setBulkRows] = useState<any[]>([]);

  const handleBulkOpen = () => {
    setBulkRows([{ id: crypto.randomUUID(), factoryId: '', code: '', name: '', size: '', supervisorName: '' }]);
    setBulkMode(true);
  };
  const addBulkRow = () => setBulkRows(prev => [...prev, { id: crypto.randomUUID(), factoryId: '', code: '', name: '', size: '', supervisorName: '' }]);
  const updateBulkRow = (id: string, field: string, value: string) => setBulkRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const saveBulk = async () => {
    const valid = bulkRows.filter(r => r.factoryId && r.code && r.name);
    if (valid.length === 0) { toast.error('Factory, code, and name required'); return; }
    const result = await addItems('printingTables', valid.map(r => ({ id: generateId(), ...r, active: true })) as PrintingTable[]);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`Added ${valid.length} tables`);
    setBulkMode(false);
  };

  if (bulkMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Bulk Add Printing Tables</h1>
          <Button size="sm" variant="ghost" onClick={() => setBulkMode(false)}>← Back</Button>
        </div>
        <Card><CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs h-8">Factory *</TableHead>
              <TableHead className="text-xs h-8">Code *</TableHead>
              <TableHead className="text-xs h-8">Name *</TableHead>
              <TableHead className="text-xs h-8">Size</TableHead>
              <TableHead className="text-xs h-8">Supervisor</TableHead>
            </TableRow></TableHeader>
            <TableBody>{bulkRows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="py-1">
                  <Select value={r.factoryId || ''} onValueChange={v => updateBulkRow(r.id, 'factoryId', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Factory" /></SelectTrigger>
                    <SelectContent>{factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-1"><Input className="h-7 text-xs" value={r.code} onChange={e => updateBulkRow(r.id, 'code', e.target.value)} /></TableCell>
                <TableCell className="py-1"><Input className="h-7 text-xs" value={r.name} onChange={e => updateBulkRow(r.id, 'name', e.target.value)} /></TableCell>
                <TableCell className="py-1"><Input className="h-7 text-xs" value={r.size} onChange={e => updateBulkRow(r.id, 'size', e.target.value)} /></TableCell>
                <TableCell className="py-1"><Input className="h-7 text-xs" value={r.supervisorName} onChange={e => updateBulkRow(r.id, 'supervisorName', e.target.value)} /></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={addBulkRow}>Add Row</Button>
            <Button size="sm" onClick={saveBulk}>Save All</Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="outline" onClick={handleBulkOpen}><Plus className="h-3 w-3 mr-1" /> Bulk Add</Button>
      </div>
      <MasterCRUD
        title="Printing Table"
        dataKey="printingTables"
        columns={[
          { key: 'factoryId', header: 'Factory', render: item => getFactory((item as any).factoryId) },
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Name' },
          { key: 'size', header: 'Size' },
          { key: 'supervisorName', header: 'Supervisor' },
        ]}
        defaultValues={() => ({ factoryId: '', code: '', name: '', size: '', supervisorName: '', active: true })}
        validate={d => !d.factoryId ? 'Factory required' : !d.code ? 'Code required' : !d.name ? 'Name required' : null}
        renderForm={(_item, onChange, formData) => (
          <>
            <div className="space-y-1"><Label className="text-xs">Factory *</Label>
              <Select value={formData.factoryId || ''} onValueChange={v => onChange('factoryId', v)}>
                <SelectTrigger><SelectValue placeholder="Select factory" /></SelectTrigger>
                <SelectContent>{factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Table Code *</Label><Input value={formData.code || ''} onChange={e => onChange('code', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Table Name *</Label><Input value={formData.name || ''} onChange={e => onChange('name', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Size</Label><Input value={formData.size || ''} onChange={e => onChange('size', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Supervisor Name</Label><Input value={formData.supervisorName || ''} onChange={e => onChange('supervisorName', e.target.value)} /></div>
            </div>
          </>
        )}
      />
    </div>
  );
}
