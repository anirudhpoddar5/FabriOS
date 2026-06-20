import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function CompaniesPage() {
  return (
    <MasterCRUD
      title="Company"
      dataKey="companies"
      columns={[
        { key: 'name', header: 'Company Name' },
        { key: 'legalName', header: 'Legal Name' },
        { key: 'address', header: 'Address' },
      ]}
      defaultValues={() => ({ name: '', legalName: '', address: '', active: true })}
      validate={d => !d.name ? 'Company name is required' : null}
      renderForm={(_item, onChange, formData) => (
        <>
          <div className="space-y-1"><Label className="text-xs">Company Name *</Label><Input value={formData.name || ''} onChange={e => onChange('name', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Legal Name</Label><Input value={formData.legalName || ''} onChange={e => onChange('legalName', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Address</Label><Textarea value={formData.address || ''} onChange={e => onChange('address', e.target.value)} rows={2} /></div>
        </>
      )}
    />
  );
}
