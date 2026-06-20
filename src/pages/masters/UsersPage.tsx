import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UsersPage() {
  return (
    <MasterCRUD
      title="User"
      dataKey="users"
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
      ]}
      defaultValues={() => ({ name: '', email: '', active: true })}
      validate={d => !d.name ? 'Name required' : !d.email ? 'Email required' : null}
      renderForm={(_item, onChange, formData) => (
        <>
          <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={formData.name || ''} onChange={e => onChange('name', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Email *</Label><Input type="email" value={formData.email || ''} onChange={e => onChange('email', e.target.value)} /></div>
        </>
      )}
    />
  );
}
