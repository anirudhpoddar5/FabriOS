import { MasterCRUD } from '@/components/MasterCRUD';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function suggestShortForm(name: string): string {
  return name.split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('');
}

export default function StitchingProductsPage() {
  return (
    <MasterCRUD
      title="Stitching Product"
      dataKey="stitchingProducts"
      columns={[
        { key: 'code', header: 'Code' },
        { key: 'name', header: 'Product Name' },
        { key: 'sizeSpec', header: 'Size / Spec' },
        { key: 'uom', header: 'UOM' },
      ]}
      defaultValues={() => ({ code: '', name: '', sizeSpec: '', uom: 'pcs', active: true })}
      validate={d => !d.name ? 'Name required' : !d.uom ? 'UOM required' : null}
      renderForm={(_item, onChange, formData) => {
        const handleNameChange = (val: string) => {
          onChange('name', val);
          if (!(formData as any)._manualCode) onChange('code', suggestShortForm(val));
        };
        return (
          <>
            <div className="space-y-1"><Label className="text-xs">Product Name *</Label><Input value={formData.name || ''} onChange={e => handleNameChange(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Short Form / Code (auto-suggested)</Label><Input value={formData.code || ''} onChange={e => { onChange('code', e.target.value); (formData as any)._manualCode = true; }} /></div>
            <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={formData.description || ''} onChange={e => onChange('description', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Size / Specification</Label><Input value={formData.sizeSpec || ''} onChange={e => onChange('sizeSpec', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">UOM *</Label>
                <Select value={formData.uom || 'pcs'} onValueChange={v => onChange('uom', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces</SelectItem>
                    <SelectItem value="meters">Meters</SelectItem>
                    <SelectItem value="yards">Yards</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="sets">Sets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        );
      }}
    />
  );
}
