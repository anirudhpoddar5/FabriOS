import { useData } from '@/context/DataContext';
import { Worker } from '@/types';
import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function WorkersPage() {
  const { data } = useData();
  const factories = data.factories.filter(f => f.active);
  const workerTypes = data.workerTypes.filter(w => w.active);

  const columns: any[] = [
    { key: 'employeeCode', header: 'Code' },
    { key: 'name', header: 'Name' },
    { header: 'Factory', accessor: (w: any) => data.factories.find((f: any) => f.id === w.factoryId)?.name || '-' },
    { header: 'Worker Type', accessor: (w: any) => data.workerTypes.find((t: any) => t.id === w.workerTypeId)?.name || '-' },
    { header: 'Hourly Rate', accessor: (w: any) => `₹${w.hourlyRate?.toFixed(2) || '0.00'}` },
  ];

  return (
    <MasterCRUD<Worker>
      title="Workers"
      dataKey="workers"
      columns={columns}
      defaultValues={() => ({
        factoryId: '', employeeCode: '', name: '',
        workerTypeId: '', phone: '', hourlyRate: 0, active: true,
      })}
      validate={d => !d.name ? 'Name required' : !d.employeeCode ? 'Employee code required' : null}
      renderForm={(_item, onChange, formData) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Employee Code *</Label><Input value={formData.employeeCode || ''} onChange={e => onChange('employeeCode', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={formData.name || ''} onChange={e => onChange('name', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Factory</Label>
              <Select value={formData.factoryId || ''} onValueChange={v => onChange('factoryId', v)}>
                <SelectTrigger><SelectValue placeholder="Select factory" /></SelectTrigger>
                <SelectContent>
                  {factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Worker Type</Label>
              <Select value={formData.workerTypeId || ''} onValueChange={v => onChange('workerTypeId', v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {workerTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={formData.phone || ''} onChange={e => onChange('phone', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Hourly Rate (₹)</Label><Input type="number" step="0.01" value={formData.hourlyRate || 0} onChange={e => onChange('hourlyRate', parseFloat(e.target.value) || 0)} /></div>
          </div>
        </>
      )}
    />
  );
}
