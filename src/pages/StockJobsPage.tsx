import { useState, useMemo, Fragment } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Plus, Search, Pencil, FileDown, Trash2, Printer } from 'lucide-react';
import { printDetailPage } from '@/lib/pdf-export';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePagination } from '@/hooks/use-pagination';
import DataTablePagination from '@/components/DataTablePagination';

// BUG FIX (Polish): distinct colors per status
const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

// Escape a value for safe inclusion in CSV
function csvEscape(val: any): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function StockJobsPage() {
  const { profile, currentModule } = useAuth();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  // BUG 3: field-level error states
  const [jobNumberError, setJobNumberError] = useState('');
  const [dateError, setDateError] = useState('');
  // BUG 1: export loading state
  const [isExporting, setIsExporting] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['stock_jobs', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from('stock_jobs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingId) {
        const { id, company_id, created_at, updated_at, ...updates } = payload;
        const { error } = await supabase.from('stock_jobs').update(updates).eq('id', editingId).select();
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stock_jobs').insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock_jobs'] });
      toast.success(editingId ? 'Job updated' : 'Job created');
      setDialogOpen(false);
    },
    onError: (err: any) => {
      // BUG 3: handle DB unique constraint gracefully
      if (err.code === '23505' || err.message?.includes('unique') || err.message?.includes('duplicate')) {
        setJobNumberError('Job number already exists. Please use a unique job number.');
      } else {
        toast.error(err.message);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stock_jobs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock_jobs'] });
      toast.success('Job deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // BUG 2: pre-select module based on active workspace
  const defaultModule = currentModule === 'both' || !currentModule ? 'printing' : currentModule;

  const handleAdd = () => {
    setEditingId(null);
    setJobNumberError('');
    setDateError('');
    setForm({
      job_number: `SJ-${Date.now().toString(36).toUpperCase()}`,
      product_name: '',
      module: defaultModule,
      target_qty: 0,
      produced_qty: 0,
      uom: 'meters',
      status: 'planned',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      remarks: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (j: any) => {
    setEditingId(j.id);
    setJobNumberError('');
    setDateError('');
    setForm({ ...j });
    setDialogOpen(true);
  };

  const handleSave = () => {
    // Basic required-field validation
    if (!form.job_number || !form.product_name) {
      toast.error('Job number and product required');
      return;
    }

    // BUG FIX (Polish): end date cannot be before start date
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setDateError('End date cannot be before start date.');
      return;
    }
    setDateError('');

    // BUG 3: client-side duplicate job number check (case-insensitive, exclude self when editing)
    const normalised = form.job_number.trim().toLowerCase();
    const duplicate = jobs.some((j: any) => {
      if (editingId && j.id === editingId) return false;
      return j.job_number?.trim().toLowerCase() === normalised;
    });
    if (duplicate) {
      setJobNumberError('Job number already exists. Please use a unique job number.');
      return;
    }
    setJobNumberError('');

    saveMutation.mutate({
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    });
  };

  // BUG 1: proper export with loading state, toast feedback, full columns, correct filename
  const exportCSV = async () => {
    setIsExporting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const columns = ['Job #', 'Product', 'Module', 'Target Qty', 'UOM', 'Produced', 'Balance', 'Progress (%)', 'Start Date', 'End Date', 'Status', 'Remarks'];
      const header = columns.join(',');
      const rows = filtered.map((j: any) => {
        const pct = j.target_qty > 0 ? ((j.produced_qty / j.target_qty) * 100).toFixed(1) : '0.0';
        return [
          j.job_number,
          j.product_name,
          j.module,
          j.target_qty,
          j.uom,
          j.produced_qty,
          j.target_qty - j.produced_qty,
          pct,
          j.start_date || '',
          j.end_date || '',
          j.status,
          j.remarks || '',
        ].map(csvEscape).join(',');
      });
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-jobs-export-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported successfully');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const filtered = useMemo(() => {
    let list = jobs as any[];
    if (currentModule && currentModule !== 'both') {
      list = list.filter((j: any) => j.module === currentModule);
    }
    if (statusFilter !== 'all') {
      list = list.filter((j: any) => j.status === statusFilter);
    }
    if (dateFrom) list = list.filter((j: any) => !j.start_date || j.start_date >= dateFrom);
    if (dateTo) list = list.filter((j: any) => !j.start_date || j.start_date <= dateTo);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((j: any) =>
        j.job_number?.toLowerCase().includes(s) ||
        j.product_name?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [jobs, search, currentModule, statusFilter, dateFrom, dateTo]);

  const pagination = usePagination(filtered, 50);

  const monthlyGroups = useMemo(() => {
    const groups: Record<string, { label: string; items: typeof filtered; qty: number }> = {};
    for (const j of pagination.pageItems) {
      const month = j.start_date ? j.start_date.slice(0, 7) : '__no_date__';
      if (!groups[month]) groups[month] = { label: month === '__no_date__' ? 'No Date' : month, items: [], qty: 0 };
      groups[month].items.push(j);
      groups[month].qty += j.target_qty || 0;
    }
    return groups;
  }, [pagination.pageItems]);

  const printFiltered = () => {
    printDetailPage(`Stock Jobs (${filtered.length})`, [
      { label: 'Filter', value: statusFilter !== 'all' ? `Status: ${statusFilter}` : 'All' },
      { label: 'Total Jobs', value: String(filtered.length) },
    ], [
      {
        title: 'Stock Jobs',
        headers: ['Job #', 'Product', 'Module', 'Target', 'Produced', 'Status'],
        rows: filtered.map((j: any) => [j.job_number || '—', j.product_name || '—', j.module || '—', String(j.target_qty || 0), String(j.produced_qty || 0), j.status]),
      },
    ]);
  };

  const emptyMessage = search
    ? 'No jobs match your search.'
    : "No stock jobs found. Click '+ New Job' to create one.";

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
        <h1 className="text-lg font-semibold">Stock Jobs</h1>
        <div className="flex gap-2">
          {/* BUG 1: loading state + feedback on export */}
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Job
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[130px] text-xs" placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[130px] text-xs" placeholder="To" />
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={printFiltered} title="Print filtered"><Printer className="h-3.5 w-3.5" /></Button>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {pagination.pageItems.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </CardContent>
          </Card>
        ) : pagination.pageItems.map((j: any) => {
          const pct = j.target_qty > 0 ? (j.produced_qty / j.target_qty) * 100 : 0;
          return (
            <Card key={j.id} className="cursor-pointer" onClick={() => handleEdit(j)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{j.job_number}</span>
                  <Badge className={`text-[10px] ${STATUS_COLORS[j.status] || ''}`}>
                    {j.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{j.product_name} · {j.module}</p>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(pct, 100)} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground">{j.produced_qty}/{j.target_qty}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs h-8">Job #</TableHead>
                <TableHead className="text-xs h-8">Product</TableHead>
                <TableHead className="text-xs h-8">Module</TableHead>
                <TableHead className="text-xs h-8 text-right">Target</TableHead>
                <TableHead className="text-xs h-8 text-right">Produced</TableHead>
                <TableHead className="text-xs h-8 text-right">Balance</TableHead>
                <TableHead className="text-xs h-8">Progress</TableHead>
                <TableHead className="text-xs h-8">Status</TableHead>
                <TableHead className="text-xs h-8 w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : pagination.pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : Object.entries(monthlyGroups).map(([monthKey, group]) => (
                <Fragment key={monthKey}>
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={9} className="text-[11px] font-semibold py-1.5 px-3">
                      {monthKey === '__no_date__' ? 'No Start Date' : new Date(monthKey + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                      <span className="text-muted-foreground font-normal ml-2">({group.items.length} jobs, {group.qty} target qty)</span>
                    </TableCell>
                  </TableRow>
                  {group.items.map((j: any) => {
                    const pct = j.target_qty > 0 ? (j.produced_qty / j.target_qty) * 100 : 0;
                    return (
                      <TableRow key={j.id}>
                        <TableCell className="text-sm py-2 font-medium">{j.job_number}</TableCell>
                        <TableCell className="text-sm py-2">{j.product_name}</TableCell>
                        <TableCell className="text-sm py-2 capitalize">{j.module}</TableCell>
                        <TableCell className="text-sm py-2 text-right">{j.target_qty} {j.uom}</TableCell>
                        <TableCell className="text-sm py-2 text-right">{j.produced_qty}</TableCell>
                        <TableCell className="text-sm py-2 text-right font-medium">{j.target_qty - j.produced_qty}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1">
                            <Progress value={Math.min(pct, 100)} className="h-1.5 w-16" />
                            <span className="text-[10px]">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={`text-[10px] ${STATUS_COLORS[j.status] || ''}`}>
                            {j.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(j)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(j.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DataTablePagination {...pagination} />

      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setJobNumberError(''); setDateError(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'New'} Stock Job</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Job Number *</Label>
                <Input
                  value={form.job_number || ''}
                  onChange={e => { setForm({ ...form, job_number: e.target.value }); setJobNumberError(''); }}
                  className={jobNumberError ? 'border-red-500' : ''}
                />
                {/* BUG 3: inline field error */}
                {jobNumberError && <p className="text-xs text-red-500 mt-1">{jobNumberError}</p>}
              </div>
              <div>
                <Label className="text-xs">Module</Label>
                <Select value={form.module || 'printing'} onValueChange={v => setForm({ ...form, module: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="printing">Printing</SelectItem>
                    <SelectItem value="stitching">Stitching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Product Name *</Label>
              <Input
                value={form.product_name || ''}
                onChange={e => setForm({ ...form, product_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Target Qty</Label>
                <Input type="number" value={form.target_qty || ''} onChange={e => setForm({ ...form, target_qty: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Produced</Label>
                <Input type="number" value={form.produced_qty || ''} onChange={e => setForm({ ...form, produced_qty: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">UOM</Label>
                <Input value={form.uom || 'meters'} onChange={e => setForm({ ...form, uom: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date || ''}
                  onChange={e => { setForm({ ...form, start_date: e.target.value }); setDateError(''); }}
                />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={form.end_date || ''}
                  onChange={e => { setForm({ ...form, end_date: e.target.value }); setDateError(''); }}
                  className={dateError ? 'border-red-500' : ''}
                />
              </div>
            </div>
            {/* BUG FIX (Polish): end date before start date error */}
            {dateError && <p className="text-xs text-red-500 -mt-1">{dateError}</p>}

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status || 'planned'} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Remarks</Label>
              <Input value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
