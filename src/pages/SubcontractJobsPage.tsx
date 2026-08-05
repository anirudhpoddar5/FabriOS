import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Truck, Package, ArrowLeftRight } from 'lucide-react';
import DataTablePagination from '@/components/DataTablePagination';
import { usePagination } from '@/hooks/use-pagination';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-800',
  partial: 'bg-yellow-100 text-yellow-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-600',
};

const EMPTY_JOB = () => ({
  jobNumber: '',
  orderId: '',
  subcontractorId: '',
  process: 'printing' as const,
  productDescription: '',
  qtySent: 0,
  rate: 0,
  sendDate: new Date().toISOString().slice(0, 10),
  expectedReturnDate: '',
  notes: '',
});

export default function SubcontractJobsPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const { data: appData, addItem, updateItem } = useData();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState<number>(0);
  const [form, setForm] = useState<any>(EMPTY_JOB());

  const jobs = appData.subcontractJobs;
  const orders = [...appData.printingOrders, ...appData.stitchingOrders];

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('vendors').select('*').eq('company_id', companyId).eq('is_active', true);
      return data || [];
    },
    enabled: !!companyId,
  });

  const filtered = useMemo(() => {
    let list = [...jobs];
    if (statusFilter !== 'all') list = list.filter((j: any) => j.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((j: any) =>
        j.jobNumber?.toLowerCase().includes(s) ||
        j.productDescription?.toLowerCase().includes(s)
      );
    }
    return list.sort((a: any, b: any) => b.sendDate?.localeCompare(a.sendDate));
  }, [jobs, search, statusFilter]);

  const pagination = usePagination(filtered, 50);

  const handleAdd = () => {
    const nextNum = `SC-${String(jobs.length + 1).padStart(3, '0')}`;
    setForm({ ...EMPTY_JOB(), jobNumber: nextNum, sendDate: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.jobNumber) { toast.error('Job number required'); return; }
    if (!form.subcontractorId) { toast.error('Subcontractor required'); return; }
    if (!form.qtySent || form.qtySent <= 0) { toast.error('Qty sent must be > 0'); return; }
    const payload = {
      jobNumber: form.jobNumber,
      orderId: form.orderId || null,
      subcontractorId: form.subcontractorId || null,
      process: form.process,
      productDescription: form.productDescription || null,
      qtySent: Number(form.qtySent) || 0,
      rate: Number(form.rate) || 0,
      sendDate: form.sendDate,
      expectedReturnDate: form.expectedReturnDate || null,
      notes: form.notes || null,
      status: 'sent',
    };
    const { error } = await addItem('subcontractJobs', payload as any);
    if (error) { toast.error(error); return; }
    toast.success('Subcontract job created');
    setDialogOpen(false);
  };

  const openReceive = (job: any) => {
    setReceivingId(job.id);
    setReceiveQty(job.qtyReceived || 0);
    setReceiveOpen(true);
  };

  const handleReceive = async () => {
    if (!receivingId) return;
    const job = jobs.find((j: any) => j.id === receivingId);
    if (!job) return;
    const newStatus = receiveQty >= job.qtySent ? 'received' : 'partial';
    const { error } = await updateItem('subcontractJobs', receivingId, {
      qtyReceived: Number(receiveQty) || 0,
      receivedDate: new Date().toISOString().slice(0, 10),
      status: newStatus,
    } as any);
    if (error) toast.error(error);
    else toast.success(`Subcontract job ${newStatus}`);
    setReceiveOpen(false);
    setReceivingId(null);
  };

  const statusBadge = (status: string) => {
    return <Badge className={`${STATUS_COLORS[status] || ''} text-[10px] px-1.5 py-0`}>{status}</Badge>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Subcontract Jobs</h1>
        <Button size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> New Job</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-xs h-8">Job #</TableHead>
            <TableHead className="text-xs h-8">Process</TableHead>
            <TableHead className="text-xs h-8">Product</TableHead>
            <TableHead className="text-xs h-8 text-right">Sent</TableHead>
            <TableHead className="text-xs h-8 text-right">Received</TableHead>
            <TableHead className="text-xs h-8 text-right">Balance</TableHead>
            <TableHead className="text-xs h-8 text-right">Rate</TableHead>
            <TableHead className="text-xs h-8 text-right">Amount</TableHead>
            <TableHead className="text-xs h-8">Status</TableHead>
            <TableHead className="text-xs h-8 w-16"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-12">
                <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No subcontract jobs yet</p>
              </TableCell></TableRow>
            ) : filtered.map((job: any) => (
              <TableRow key={job.id}>
                <TableCell className="text-sm py-2 font-medium">{job.jobNumber}</TableCell>
                <TableCell className="text-sm py-2">{job.process}</TableCell>
                <TableCell className="text-sm py-2">{job.productDescription || '-'}</TableCell>
                <TableCell className="text-sm py-2 text-right">{job.qtySent}</TableCell>
                <TableCell className="text-sm py-2 text-right">{job.qtyReceived}</TableCell>
                <TableCell className="text-sm py-2 text-right font-medium">{job.qtyBalance}</TableCell>
                <TableCell className="text-sm py-2 text-right">${Number(job.rate).toFixed(2)}</TableCell>
                <TableCell className="text-sm py-2 text-right">${Number(job.amount).toFixed(2)}</TableCell>
                <TableCell className="py-2">{statusBadge(job.status)}</TableCell>
                <TableCell className="py-2">
                  {(job.status === 'sent' || job.status === 'partial') && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => openReceive(job)} title="Receive">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <DataTablePagination {...pagination} />

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Subcontract Job</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Job # *</Label><Input value={form.jobNumber || ''} onChange={e => setForm({ ...form, jobNumber: e.target.value })} className="h-9" /></div>
              <div>
                <Label className="text-xs">Process</Label>
                <Select value={form.process || 'printing'} onValueChange={v => setForm({ ...form, process: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="printing">Printing</SelectItem>
                    <SelectItem value="stitching">Stitching</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Order</Label>
                <Select value={form.orderId || ''} onValueChange={v => setForm({ ...form, orderId: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_order">None</SelectItem>
                    {orders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.internalPO}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Subcontractor *</Label>
                <Select value={form.subcontractorId || ''} onValueChange={v => setForm({ ...form, subcontractorId: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Send Date</Label><Input type="date" value={form.sendDate || ''} onChange={e => setForm({ ...form, sendDate: e.target.value })} className="h-9" /></div>
            </div>
            <div><Label className="text-xs">Product Description</Label><Input value={form.productDescription || ''} onChange={e => setForm({ ...form, productDescription: e.target.value })} className="h-9" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Qty Sent *</Label><Input type="number" min={0} value={form.qtySent || ''} onChange={e => setForm({ ...form, qtySent: Number(e.target.value) || 0 })} className="h-9" /></div>
              <div><Label className="text-xs">Rate</Label><Input type="number" min={0} step={0.01} value={form.rate || ''} onChange={e => setForm({ ...form, rate: Number(e.target.value) || 0 })} className="h-9" /></div>
              <div><Label className="text-xs">Amount</Label><div className="h-9 flex items-center text-sm font-medium">${((Number(form.qtySent) || 0) * (Number(form.rate) || 0)).toFixed(2)}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Expected Return</Label><Input type="date" value={form.expectedReturnDate || ''} onChange={e => setForm({ ...form, expectedReturnDate: e.target.value })} className="h-9" /></div>
              <div><Label className="text-xs">Notes</Label><Input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="h-9" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receive Subcontract Job</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Qty Received</Label><Input type="number" min={0} value={receiveQty || ''} onChange={e => setReceiveQty(Number(e.target.value) || 0)} className="h-9" /></div>
            {receivingId && (
              <div className="text-xs text-muted-foreground">
                Sent: {jobs.find((j: any) => j.id === receivingId)?.qtySent || 0}
                {' · Balance: '}<span className="font-medium">{(jobs.find((j: any) => j.id === receivingId)?.qtySent || 0) - receiveQty}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={handleReceive}>Receive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
