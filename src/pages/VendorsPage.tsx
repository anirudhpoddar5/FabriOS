import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function VendorsPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('vendors').select('*').eq('company_id', companyId).order('name');
      return data || [];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingId) {
        const { id, company_id, created_at, updated_at, ...updates } = payload;
        const { error } = await supabase.from('vendors').update(updates).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vendors').insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success(editingId ? 'Vendor updated' : 'Vendor added');
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const s = search.toLowerCase();
    return vendors.filter((v: any) => v.name?.toLowerCase().includes(s) || v.code?.toLowerCase().includes(s));
  }, [vendors, search]);

  const handleAdd = () => {
    setEditingId(null);
    setForm({ code: '', name: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', is_active: true });
    setDialogOpen(true);
  };
  const handleEdit = (v: any) => { setEditingId(v.id); setForm({ ...v }); setDialogOpen(true); };
  const handleSave = () => {
    if (!form.code || !form.name) { toast.error('Code and name are required'); return; }
    saveMutation.mutate(form);
  };
  const toggleActive = async (v: any) => {
    const { error } = await supabase.from('vendors').update({ is_active: !v.is_active }).eq('id', v.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['vendors'] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Vendors</h1>
        <Button size="sm" onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Vendor</Button>
      </div>
      <div className="relative max-w-xs mb-3">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-xs h-8">Code</TableHead>
            <TableHead className="text-xs h-8">Name</TableHead>
            <TableHead className="text-xs h-8">Contact</TableHead>
            <TableHead className="text-xs h-8">Phone</TableHead>
            <TableHead className="text-xs h-8">Status</TableHead>
            <TableHead className="text-xs h-8 w-16"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No vendors</TableCell></TableRow>
            ) : filtered.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="text-sm py-2">{v.code}</TableCell>
                <TableCell className="text-sm py-2">{v.name}</TableCell>
                <TableCell className="text-sm py-2">{v.contact_person}</TableCell>
                <TableCell className="text-sm py-2">{v.phone}</TableCell>
                <TableCell className="py-2">
                  <Switch checked={v.is_active} onCheckedChange={() => toggleActive(v)} className="scale-75" />
                </TableCell>
                <TableCell className="py-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Vendor</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Code *</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label className="text-xs">Name *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Contact Person</Label><Input value={form.contact_person || ''} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Phone</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label className="text-xs">Email</Label><Input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Address</Label><Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label className="text-xs">Payment Terms</Label><Input value={form.payment_terms || ''} onChange={e => setForm({ ...form, payment_terms: e.target.value })} placeholder="e.g. Net 30" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
