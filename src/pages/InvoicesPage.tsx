import { useState, useMemo } from 'react';
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
import { Plus, Search, FileDown, Printer, DollarSign, CheckSquare, X, Trash2, Pencil, HandCoins } from 'lucide-react';
import DataTablePagination from '@/components/DataTablePagination';
import { usePagination } from '@/hooks/use-pagination';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { printDetailPage } from '@/lib/pdf-export';
import { COMPACT_INPUT, COMPACT_NUMBER } from '@/lib/compact-input';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-200 text-gray-600',
};

export default function InvoicesPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const { data: appData, addItem, updateItem, refreshData } = useData();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ paymentDate: '', paymentMode: 'bank_transfer' });

  const invoices = appData.invoices;
  const buyers = appData.buyers.filter((b: any) => b.active !== false);

  const { data: dispatches } = useQuery({
    queryKey: ['dispatch_records', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('dispatch_records').select('*, buyers(name)').eq('company_id', companyId).order('dispatch_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const arAging = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const buckets = { current: 0, days31to60: 0, days61to90: 0, overdue90: 0 };
    for (const inv of invoices) {
      if (inv.status !== 'paid' && inv.status !== 'cancelled') {
        const due = inv.dueDate;
        const diff = Math.floor((new Date(today).getTime() - new Date(due).getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) buckets.current += inv.grandTotal;
        else if (diff <= 30) buckets.current += inv.grandTotal;
        else if (diff <= 60) buckets.days31to60 += inv.grandTotal;
        else if (diff <= 90) buckets.days61to90 += inv.grandTotal;
        else buckets.overdue90 += inv.grandTotal;
      }
    }
    return buckets;
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (buyerFilter !== 'all') list = list.filter((i: any) => i.buyerId === buyerFilter);
    if (statusFilter !== 'all') list = list.filter((i: any) => i.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((i: any) =>
        i.invoiceNumber?.toLowerCase().includes(s) ||
        buyers.find((b: any) => b.id === i.buyerId)?.name?.toLowerCase().includes(s)
      );
    }
    return list.sort((a: any, b: any) => b.invoiceDate?.localeCompare(a.invoiceDate));
  }, [invoices, search, buyerFilter, statusFilter]);

  const pagination = usePagination(filtered, 50);

  const pendingTotal = invoices.reduce((s: number, i: any) => i.status !== 'paid' && i.status !== 'cancelled' ? s + i.grandTotal : s, 0);
  const overdueTotal = invoices.reduce((s: number, i: any) => i.status === 'overdue' || (i.status === 'sent' && i.dueDate < new Date().toISOString().slice(0, 10)) ? s + i.grandTotal : s, 0);

  const handleGenerate = async () => {
    setGenerateOpen(true);
  };

  const generateFromDispatch = async (dispatchId: string) => {
    const dispatch = dispatches?.find((d: any) => d.id === dispatchId);
    if (!dispatch) { toast.error('Dispatch not found'); return; }
    const nextNum = `INV-${String(invoices.length + 1).padStart(4, '0')}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const subtotal = Number(dispatch.qty || 0) * 1;
    const { error } = await addItem('invoices', {
      invoiceNumber: nextNum,
      buyerId: dispatch.buyer_id,
      orderId: dispatch.order_id,
      dispatchId: dispatch.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      currency: 'USD',
      subtotal,
      taxPercent: 0,
      status: 'draft',
    } as any);
    if (error) toast.error(error);
    else {
      toast.success('Invoice generated from dispatch');
      qc.invalidateQueries({ queryKey: ['dispatch_records'] });
    }
  };

  const handlePay = async () => {
    if (!payingId) return;
    const { error } = await updateItem('invoices', payingId, {
      status: 'paid',
      paymentDate: payForm.paymentDate || new Date().toISOString().slice(0, 10),
      paymentMode: payForm.paymentMode,
    } as any);
    if (error) toast.error(error);
    else toast.success('Invoice marked as paid');
    setPayOpen(false);
    setPayingId(null);
  };

  const handleBulkDelete = async () => {
    // handled via checkbox
  };

  const statusBadge = (status: string) => {
    return <Badge className={`${STATUS_COLORS[status] || ''} text-[10px] px-1.5 py-0`}>{status}</Badge>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Invoices</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleGenerate}><Plus className="h-3.5 w-3.5 mr-1" /> Generate from Dispatch</Button>
        </div>
      </div>

      {/* AR Aging Summary */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase">Current (0-30d)</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">${arAging.current.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase">31-60 Days</div>
            <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">${arAging.days31to60.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase">61-90 Days</div>
            <div className="text-lg font-bold text-orange-700 dark:text-orange-400">${arAging.days61to90.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase">90+ Days</div>
            <div className="text-lg font-bold text-red-700 dark:text-red-400">${arAging.overdue90.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={buyerFilter} onValueChange={setBuyerFilter}>
          <SelectTrigger className={`${COMPACT_INPUT} h-9 w-[140px]`}><SelectValue placeholder="Buyer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buyers</SelectItem>
            {buyers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
          {' · Due: '}<span className="font-semibold text-red-600">${overdueTotal.toFixed(2)}</span>
        </span>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-xs h-8">Invoice #</TableHead>
            <TableHead className="text-xs h-8">Buyer</TableHead>
            <TableHead className="text-xs h-8">Date</TableHead>
            <TableHead className="text-xs h-8">Due Date</TableHead>
            <TableHead className="text-xs h-8">Status</TableHead>
            <TableHead className="text-xs h-8 text-right">Subtotal</TableHead>
            <TableHead className="text-xs h-8 text-right">Tax</TableHead>
            <TableHead className="text-xs h-8 text-right">Total</TableHead>
            <TableHead className="text-xs h-8 w-20"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                No invoices yet. Generate one from a dispatch.
              </TableCell></TableRow>
            ) : filtered.map((inv: any) => (
              <TableRow key={inv.id} className={inv.status === 'overdue' || (inv.status === 'sent' && inv.dueDate < new Date().toISOString().slice(0, 10)) ? 'bg-red-50/30 dark:bg-red-950/10' : ''}>
                <TableCell className="text-sm py-2 font-medium">{inv.invoiceNumber}</TableCell>
                <TableCell className="text-sm py-2">{buyers.find((b: any) => b.id === inv.buyerId)?.name || '-'}</TableCell>
                <TableCell className="text-sm py-2">{inv.invoiceDate}</TableCell>
                <TableCell className="text-sm py-2">
                  <span className={inv.dueDate < new Date().toISOString().slice(0, 10) && inv.status !== 'paid' && inv.status !== 'cancelled' ? 'text-red-600 font-medium' : ''}>
                    {inv.dueDate}
                  </span>
                </TableCell>
                <TableCell className="py-2">
                  <Select value={inv.status} onValueChange={v => updateItem('invoices', inv.id, { status: v } as any)}>
                    <SelectTrigger className={`h-7 text-[10px] w-[90px] ${STATUS_COLORS[inv.status] || ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm py-2 text-right">{inv.currency} {inv.subtotal.toFixed(2)}</TableCell>
                <TableCell className="text-sm py-2 text-right">{inv.taxPercent}%</TableCell>
                <TableCell className="text-sm py-2 text-right font-semibold">{inv.currency} {inv.grandTotal.toFixed(2)}</TableCell>
                <TableCell className="py-2">
                  <div className="flex gap-1">
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => { setPayingId(inv.id); setPayForm({ paymentDate: new Date().toISOString().slice(0, 10), paymentMode: 'bank_transfer' }); setPayOpen(true); }} title="Mark Paid">
                        <HandCoins className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <DataTablePagination {...pagination} />

      {/* Generate from Dispatch Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Generate Invoice from Dispatch</DialogTitle></DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs h-8">Date</TableHead>
                <TableHead className="text-xs h-8">Buyer</TableHead>
                <TableHead className="text-xs h-8">Product</TableHead>
                <TableHead className="text-xs h-8 text-right">Qty</TableHead>
                <TableHead className="text-xs h-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(dispatches || []).filter((d: any) => !invoices.find((i: any) => i.dispatchId === d.id)).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs py-2">{d.dispatch_date}</TableCell>
                    <TableCell className="text-xs py-2">{d.buyers?.name || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{d.product_name || '-'}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{d.qty}</TableCell>
                    <TableCell className="py-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { generateFromDispatch(d.id); setGenerateOpen(false); }}>
                        Generate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!dispatches || dispatches.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No dispatches available</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark Invoice as Paid</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Payment Date</Label><Input type="date" value={payForm.paymentDate} onChange={e => setPayForm({ ...payForm, paymentDate: e.target.value })} className="h-9" /></div>
            <div>
              <Label className="text-xs">Payment Mode</Label>
              <Select value={payForm.paymentMode} onValueChange={v => setPayForm({ ...payForm, paymentMode: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePay}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
