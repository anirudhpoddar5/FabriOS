import { useState } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { Fabric } from '@/types';
import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

function suggestShortForm(name: string, gsm?: string, width?: string): string {
  const initials = name.split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('');
  const parts = [initials];
  if (gsm) parts.push(gsm + 'g');
  if (width) parts.push(width + '"');
  return parts.join('-');
}

export default function FabricsPage() {
  const { addItems } = useData();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRows, setBulkRows] = useState<any[]>([]);

  const handleBulkOpen = () => {
    setBulkRows([{ id: crypto.randomUUID(), name: '', shortForm: '', gsm: '', width: '', widthUnit: 'inches' }]);
    setBulkMode(true);
  };

  const addBulkRow = () => setBulkRows(prev => [...prev, { id: crypto.randomUUID(), name: '', shortForm: '', gsm: '', width: '', widthUnit: 'inches' }]);
  const updateBulkRow = (id: string, field: string, value: string) => {
    setBulkRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if ((field === 'name' || field === 'gsm' || field === 'width') && !r._manualShort) {
        updated.shortForm = suggestShortForm(
          field === 'name' ? value : r.name,
          field === 'gsm' ? value : r.gsm,
          field === 'width' ? value : r.width
        );
      }
      if (field === 'shortForm') updated._manualShort = true;
      return updated;
    }));
  };

  const saveBulk = () => {
    const valid = bulkRows.filter(r => r.name);
    if (valid.length === 0) { toast.error('Name required'); return; }
    addItems('fabrics', valid.map(r => ({
      id: generateId(), name: r.name,
      shortForm: r.shortForm || suggestShortForm(r.name, r.gsm, r.width),
      gsm: r.gsm ? parseFloat(r.gsm) : undefined,
      width: r.width ? parseFloat(r.width) : undefined,
      widthUnit: r.widthUnit || 'inches',
      active: true
    })) as Fabric[]);
    toast.success(`Added ${valid.length} fabrics`);
    setBulkMode(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    const lines = text.trim().split('\n').map(l => l.split('\t'));
    setBulkRows(prev => [...prev, ...lines.map(cols => ({
      id: crypto.randomUUID(), name: cols[0] || '',
      gsm: cols[1] || '', width: cols[2] || '',
      shortForm: suggestShortForm(cols[0] || '', cols[1] || '', cols[2] || ''),
      widthUnit: 'inches',
    }))]);
    toast.info(`Pasted ${lines.length} rows`);
  };

  if (bulkMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Bulk Add Fabrics</h1>
          <Button size="sm" variant="ghost" onClick={() => setBulkMode(false)}>← Back</Button>
        </div>
        <Card>
          <CardContent className="pt-4" onPaste={handlePaste}>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs h-8">Name *</TableHead>
                <TableHead className="text-xs h-8">GSM</TableHead>
                <TableHead className="text-xs h-8">Width</TableHead>
                <TableHead className="text-xs h-8">Short Form</TableHead>
              </TableRow></TableHeader>
              <TableBody>{bulkRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.name} onChange={e => updateBulkRow(r.id, 'name', e.target.value)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" type="number" value={r.gsm} onChange={e => updateBulkRow(r.id, 'gsm', e.target.value)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" type="number" value={r.width} onChange={e => updateBulkRow(r.id, 'width', e.target.value)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.shortForm} onChange={e => updateBulkRow(r.id, 'shortForm', e.target.value)} /></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={addBulkRow}>Add Row</Button>
              <Button size="sm" onClick={saveBulk}>Save All</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="outline" onClick={handleBulkOpen}><Plus className="h-3 w-3 mr-1" /> Bulk Add</Button>
      </div>
      <MasterCRUD
        title="Fabric"
        dataKey="fabrics"
        columns={[
          { key: 'name', header: 'Fabric Name' },
          { key: 'gsm', header: 'GSM' },
          { key: 'width', header: 'Width' },
          { key: 'shortForm', header: 'Short Form' },
        ]}
        defaultValues={() => ({ name: '', shortForm: '', gsm: '', width: '', widthUnit: 'inches', active: true })}
        validate={d => !d.name ? 'Name required' : null}
        renderForm={(_item, onChange, formData) => {
          const autoUpdate = (field: string, value: string) => {
            onChange(field, value);
            if (!(formData as any)._manualShort) {
              const n = field === 'name' ? value : (formData.name || '');
              const g = field === 'gsm' ? value : (formData.gsm || '');
              const w = field === 'width' ? value : (formData.width || '');
              onChange('shortForm', suggestShortForm(n, String(g), String(w)));
            }
          };
          return (
            <>
              <div className="space-y-1"><Label className="text-xs">Fabric Name *</Label><Input value={formData.name || ''} onChange={e => autoUpdate('name', e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">GSM</Label><Input type="number" value={formData.gsm || ''} onChange={e => autoUpdate('gsm', e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Width</Label><Input type="number" value={formData.width || ''} onChange={e => autoUpdate('width', e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Width Unit</Label>
                  <Select value={formData.widthUnit || 'inches'} onValueChange={v => onChange('widthUnit', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inches">Inches</SelectItem>
                      <SelectItem value="cm">CM</SelectItem>
                      <SelectItem value="meters">Meters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Short Form (auto-suggested)</Label><Input value={formData.shortForm || ''} onChange={e => { onChange('shortForm', e.target.value); (formData as any)._manualShort = true; }} /></div>
            </>
          );
        }}
      />
    </div>
  );
}
