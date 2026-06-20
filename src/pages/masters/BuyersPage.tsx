import { useState } from 'react';
import { useData, generateId } from '@/context/DataContext';
import { Buyer } from '@/types';
import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';
import { toast } from 'sonner';

export default function BuyersPage() {
  const { addItems } = useData();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRows, setBulkRows] = useState<any[]>([]);

  const handleBulkOpen = () => {
    setBulkRows([{ id: crypto.randomUUID(), code: '', name: '', contactPerson: '', country: '', phone: '', email: '', address: '' }]);
    setBulkMode(true);
  };

  const addBulkRow = () => setBulkRows(prev => [...prev, { id: crypto.randomUUID(), code: '', name: '', contactPerson: '', country: '', phone: '', email: '', address: '' }]);
  const updateBulkRow = (id: string, field: string, value: string) => setBulkRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const saveBulk = () => {
    const valid = bulkRows.filter(r => r.code && r.country);
    if (valid.length === 0) { toast.error('Code and country required for each row'); return; }
    addItems('buyers', valid.map(r => ({ id: generateId(), code: r.code, name: r.name, contactPerson: r.contactPerson, country: r.country, phone: r.phone, email: r.email, address: r.address, active: true })) as Buyer[]);
    toast.success(`Added ${valid.length} buyers`);
    setBulkMode(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    const lines = text.trim().split('\n').map(l => l.split('\t'));
    const newRows = lines.map(cols => ({
      id: crypto.randomUUID(), code: cols[0] || '', name: cols[1] || '', contactPerson: cols[2] || '', country: cols[3] || '',
      phone: cols[4] || '', email: cols[5] || '', address: cols[6] || '',
    }));
    setBulkRows(prev => [...prev, ...newRows]);
    toast.info(`Pasted ${newRows.length} rows`);
  };

  if (bulkMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Bulk Add Buyers</h1>
          <Button size="sm" variant="ghost" onClick={() => setBulkMode(false)}>← Back</Button>
        </div>
        <Card>
          <CardContent className="pt-4" onPaste={handlePaste}>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs h-8">Code *</TableHead>
                <TableHead className="text-xs h-8">Name</TableHead>
                <TableHead className="text-xs h-8">Contact Person</TableHead>
                <TableHead className="text-xs h-8">Country *</TableHead>
                <TableHead className="text-xs h-8">Phone</TableHead>
                <TableHead className="text-xs h-8">Email</TableHead>
              </TableRow></TableHeader>
              <TableBody>{bulkRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.code} onChange={e => updateBulkRow(r.id, 'code', e.target.value)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.name} onChange={e => updateBulkRow(r.id, 'name', e.target.value)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.contactPerson} onChange={e => updateBulkRow(r.id, 'contactPerson', e.target.value)} /></TableCell>
                  <TableCell className="py-1">
                    <Select value={r.country || ''} onValueChange={v => updateBulkRow(r.id, 'country', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Country" /></SelectTrigger>
                      <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.phone} onChange={e => updateBulkRow(r.id, 'phone', e.target.value)} /></TableCell>
                  <TableCell className="py-1"><Input className="h-7 text-xs" value={r.email} onChange={e => updateBulkRow(r.id, 'email', e.target.value)} /></TableCell>
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
        title="Buyer"
        dataKey="buyers"
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Name' },
          { key: 'contactPerson', header: 'Contact Person' },
          { key: 'country', header: 'Country' },
          { key: 'phone', header: 'Phone' },
          { key: 'email', header: 'Email' },
        ]}
        defaultValues={() => ({ code: '', name: '', contactPerson: '', country: '', phone: '', email: '', address: '', active: true })}
        validate={d => !d.code ? 'Code required' : !d.country ? 'Country required' : null}
        renderForm={(_item, onChange, formData) => (
          <>
            <div className="space-y-1"><Label className="text-xs">Buyer Code *</Label><Input value={formData.code || ''} onChange={e => onChange('code', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Buyer Name</Label><Input value={formData.name || ''} onChange={e => onChange('name', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Contact Person</Label><Input value={formData.contactPerson || ''} onChange={e => onChange('contactPerson', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Country *</Label>
              <Select value={formData.country || ''} onValueChange={v => onChange('country', v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={formData.phone || ''} onChange={e => onChange('phone', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={formData.email || ''} onChange={e => onChange('email', e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={formData.address || ''} onChange={e => onChange('address', e.target.value)} /></div>
          </>
        )}
      />
    </div>
  );
}
