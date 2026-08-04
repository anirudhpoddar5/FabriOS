import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CompaniesPage() {
  return (
    <MasterCRUD
      title="Company"
      dataKey="companies"
      columns={[
        { key: 'name', header: 'Company Name' },
        { key: 'legalName', header: 'Legal Name' },
        { key: 'address', header: 'Address' },
        { key: 'baseCurrency', header: 'Base Currency' },
      ]}
      defaultValues={() => ({ name: '', legalName: '', address: '', baseCurrency: 'INR', active: true, workingDays: [1, 2, 3, 4, 5, 6] })}
      validate={d => !d.name ? 'Company name is required' : null}
      renderForm={(_item, onChange, formData) => {
        const workingDays: number[] = formData.workingDays || [];
        const toggleDay = (day: number) => {
          const next = workingDays.includes(day)
            ? workingDays.filter((d: number) => d !== day)
            : [...workingDays, day];
          onChange('workingDays', next.sort());
        };
        return (
          <>
            <div className="space-y-1"><Label className="text-xs">Company Name *</Label><Input value={formData.name || ''} onChange={e => onChange('name', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Legal Name</Label><Input value={formData.legalName || ''} onChange={e => onChange('legalName', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Address</Label><Textarea value={formData.address || ''} onChange={e => onChange('address', e.target.value)} rows={2} /></div>
            <div className="space-y-1"><Label className="text-xs">Base Currency (for costs)</Label>
              <Input value={formData.baseCurrency || 'INR'} onChange={e => onChange('baseCurrency', e.target.value.toUpperCase())} placeholder="INR" maxLength={3} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Weekly Working Days</Label>
              <div className="flex gap-1 flex-wrap">
                {DAY_LABELS.map((label, idx) => (
                  <label key={idx} className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${workingDays.includes(idx) ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/30 border-border/50 text-muted-foreground'}`}>
                    <Checkbox checked={workingDays.includes(idx)} onCheckedChange={() => toggleDay(idx)} className="h-3 w-3" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </>
        );
      }}
    />
  );
}
