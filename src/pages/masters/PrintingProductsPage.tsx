import { useState } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { PrintingProduct } from '@/types';
import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

function suggestCode(name: string, size?: string): string {
  const initials = name.split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('');
  return size ? `${initials}-${size}` : initials;
}

export default function PrintingProductsPage() {
  const { addItems } = useData();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRows, setBulkRows] = useState<any[]>([]);

  const handleBulkOpen = () => {
    setBulkRows([{ id: crypto.randomUUID(), name: '', code: '', size: '', uom: 'meters' }]);
    setBulkMode(true);
  };

  const addBulkRow = () => setBulkRows(prev => [...prev, { id: crypto.randomUUID(), name: '', code: '', size: '', uom: 'meters' }]);
  const updateBulkRow = (id: string, field: string, value: string) => {
    setBulkRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if ((field === 'name' || field === 'size') && !r._manualCode) {
        updated.code = suggestCode(field === 'name' ? value : r.name, field === 'size' ? value : r.size);
      }
      if (field === 'code') updated._manualCode = true;
      return updated;
    }));
  };

  const saveBulk = async () => {
    const valid = bulkRows.filter(r => r.name);
    if (valid.length === 0) { toast.error('Name required'); return; }
    const result = await addItems('printingProducts', valid.map(r => ({
      id: generateId(), name: r.name,
      code: r.code || suggestCode(r.name, r.size),
      size: r.size || '', uom: r.uom || 'meters', active: true
    })) as PrintingProduct[]);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`Added ${valid.length} printing products`);
    setBulkMode(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    const lines = text.trim().split('\n').map(l => l.split('\t'));
    setBulkRows(prev => [...prev, ...lines.map(cols => ({
      id: crypto.randomUUID(), name: cols[0] || '', size: cols[1] || '',
      code: suggestCode(cols[0] || '', cols[1] || ''),
      uom: cols[2] || 'meters',
    }))]);
    toast.info(`Pasted ${lines.length} rows`);
  };

  if (bulkMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Bulk Add Printing Products</h1>
          <Button size="sm" variant="ghost" onClick={() => setBulkMode(false)}>← Back</Button>
        </div>
        <Card>
          <CardContent className="pt-4" onPaste={handlePaste}>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs h-8">Name *</TableHead>
                <TableHead className="text-xs h-8">Size</TableHead>
                <TableHead className="text-xs h-8">Code</TableHead>
                <TableHead className="text-xs h-8">UOM</TableHead>
              </TableRow></TableHeader>
              <TableBody>{bulkRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.name} onChange={e => updateBulkRow(r.id, 'name', e.target.value)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.size} onChange={e => updateBulkRow(r.id, 'size', e.target.value)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.code} onChange={e => updateBulkRow(r.id, 'code', e.target.value)} /></TableCell>
                  <TableCell className="py-1">
                    <Select value={r.uom || 'meters'} onValueChange={v => updateBulkRow(r.id, 'uom', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pieces">Pieces</SelectItem>
                        <SelectItem value="meters">Meters</SelectItem>
                        <SelectItem value="yards">Yards</SelectItem>
                        <SelectItem value="kg">Kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
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
        title="Printing Product"
        dataKey="printingProducts"
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Product Name' },
          { key: 'size', header: 'Size' },
          { key: 'uom', header: 'UOM' },
        ]}
        defaultValues={() => ({ code: '', name: '', size: '', uom: 'meters', active: true })}
        validate={d => !d.name ? 'Name required' : !d.uom ? 'UOM required' : null}
        renderForm={(_item, onChange, formData) => {
          const handleNameChange = (val: string) => {
            onChange('name', val);
            if (!(formData as any)._manualCode) onChange('code', suggestCode(val, formData.size));
          };
          const handleSizeChange = (val: string) => {
            onChange('size', val);
            if (!(formData as any)._manualCode) onChange('code', suggestCode(formData.name || '', val));
          };
          return (
            <>
              <div className="space-y-1"><Label className="text-xs">Product Name *</Label><Input value={formData.name || ''} onChange={e => handleNameChange(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Size</Label><Input value={formData.size || ''} onChange={e => handleSizeChange(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Product Code (auto)</Label><Input value={formData.code || ''} onChange={e => { onChange('code', e.target.value); (formData as any)._manualCode = true; }} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">UOM *</Label>
                <Select value={formData.uom || 'meters'} onValueChange={v => onChange('uom', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="meters">Meters</SelectItem>
                    <SelectItem value="yards">Yards</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
