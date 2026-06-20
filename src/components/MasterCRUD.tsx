import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Search } from 'lucide-react';
import { useData, generateId } from '@/context/DataContext';
import { AppData } from '@/types';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  accessor?: (item: T) => string | number;
}

interface MasterCRUDProps<K extends keyof AppData> {
  title: string;
  dataKey: K;
  columns: ColumnDef<AppData[K][number]>[];
  renderForm: (item: AppData[K][number] | null, onChange: (field: string, value: any) => void, formData: Record<string, any>) => React.ReactNode;
  defaultValues: () => Record<string, any>;
  validate?: (formData: Record<string, any>) => string | null;
}

export function MasterCRUD<K extends keyof AppData>({ title, dataKey, columns, renderForm, defaultValues, validate }: MasterCRUDProps<K>) {
  const { data, addItem, updateItem } = useData();
  const items = data[dataKey] as any[];
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((item: any) =>
      Object.values(item).some(v => String(v).toLowerCase().includes(s))
    );
  }, [items, search]);

  const handleAdd = () => {
    setEditingId(null);
    setFormData(defaultValues());
    setDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({ ...item });
    setDialogOpen(true);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (validate) {
      const err = validate(formData);
      if (err) { toast.error(err); return; }
    }
    let result: { error: string | null };
    if (editingId) {
      result = await updateItem(dataKey, editingId, formData as any);
    } else {
      result = await addItem(dataKey, { ...formData, id: generateId() } as any);
    }
    if (result.error) {
      toast.error(`Failed to save: ${result.error}`);
      return;
    }
    toast.success(editingId ? `${title} updated` : `${title} added`);
    setDialogOpen(false);
  };

  const handleToggleActive = async (item: any) => {
    const result = await updateItem(dataKey, item.id, { active: !item.active } as any);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`${item.active ? 'Deactivated' : 'Activated'}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">{title}</h1>
        <Button size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} records</span>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => <TableHead key={col.key} className="text-xs h-9">{col.header}</TableHead>)}
              <TableHead className="text-xs h-9 w-[100px]">Status</TableHead>
              <TableHead className="text-xs h-9 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-sm text-muted-foreground py-8">No records found</TableCell></TableRow>
            ) : filtered.map((item: any) => (
              <TableRow key={item.id}>
                {columns.map(col => (
                  <TableCell key={col.key} className="text-sm py-2">
                    {col.render ? col.render(item) : col.accessor ? col.accessor(item) : item[col.key]}
                  </TableCell>
                ))}
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={item.active} onCheckedChange={() => handleToggleActive(item)} className="scale-75" />
                    <Badge variant={item.active ? 'default' : 'secondary'} className="text-[10px]">{item.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add'} {title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {renderForm(editingId ? items.find((i: any) => i.id === editingId) : null, handleChange, formData)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
