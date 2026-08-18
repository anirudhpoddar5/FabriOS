import { useState, useMemo, useRef, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useData, generateId } from '@/context/DataContext';
import { AppData } from '@/types';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { SortState, sortAndGroupRows, groupConsecutive } from '@/lib/master-sort';

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
  /** Column key to group rows under a sub-heading (e.g. factory) — count shown per group. Opt-in. */
  groupBy?: string;
}

export function MasterCRUD<K extends keyof AppData>({ title, dataKey, columns, renderForm, defaultValues, validate, groupBy }: MasterCRUDProps<K>) {
  const { data, addItem, updateItem } = useData();
  const items = data[dataKey] as any[];
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  // ponytail: ref backs the guard so two clicks fired in the same tick (before React
  // re-renders the disabled button) can't both slip past a state-only check.
  const savingRef = useRef(false);

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((item: any) =>
      Object.values(item).some(v => String(v).toLowerCase().includes(s))
    );
  }, [items, search]);

  const sortedRows = useMemo(() => sortAndGroupRows(filtered, columns, sort, groupBy), [filtered, columns, sort, groupBy]);
  const groups = useMemo(() => groupBy ? groupConsecutive(sortedRows, columns, groupBy) : null, [sortedRows, columns, groupBy]);

  const handleSort = (index: number) => {
    setSort(prev => prev?.index === index ? { index, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { index, direction: 'asc' });
  };

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
    if (savingRef.current) return;
    if (validate) {
      const err = validate(formData);
      if (err) { toast.error(err); return; }
    }
    // ponytail: cheap dupe guard — only checks code/name against already-loaded rows,
    // not a real unique constraint. Upgrade to a DB constraint if dupes still slip through.
    if (!editingId) {
      const key = formData.code ? 'code' : formData.name ? 'name' : null;
      if (key) {
        const dupe = items.some((item: any) => String(item[key]).trim().toLowerCase() === String(formData[key]).trim().toLowerCase());
        if (dupe) { toast.error(`A ${title.toLowerCase()} with this ${key} already exists`); return; }
      }
    }
    savingRef.current = true;
    setSaving(true);
    try {
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
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: any) => {
    const result = await updateItem(dataKey, item.id, { active: !item.active } as any);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(`${item.active ? 'Deactivated' : 'Activated'}`);
  };

  const renderRow = (item: any) => (
    <TableRow key={item.id}>
      {columns.map((col, i) => (
        <TableCell key={col.key ?? i} className="text-sm py-2">
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
  );

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
              {columns.map((col, i) => (
                <TableHead
                  key={col.key ?? i}
                  className="text-xs h-9 cursor-pointer select-none"
                  onClick={() => handleSort(i)}
                  aria-sort={sort?.index === i ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(i); } }}
                    className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                  >
                    {col.header}
                    {sort?.index === i
                      ? (sort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                      : <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />}
                  </span>
                </TableHead>
              ))}
              <TableHead className="text-xs h-9 w-[100px]">Status</TableHead>
              <TableHead className="text-xs h-9 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-sm text-muted-foreground py-8">No records found</TableCell></TableRow>
            ) : groups ? (
              groups.map((group, gi) => (
                <Fragment key={gi}>
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={columns.length + 2} className="text-[11px] font-semibold py-1.5 px-3">
                      {group.label}
                      <span className="text-muted-foreground font-normal ml-2">({group.items.length} {group.items.length === 1 ? 'record' : 'records'})</span>
                    </TableCell>
                  </TableRow>
                  {group.items.map((item: any) => renderRow(item))}
                </Fragment>
              ))
            ) : sortedRows.map((item: any) => renderRow(item))}
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
