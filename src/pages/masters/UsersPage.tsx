import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function UsersPage() {
  const { data, updateItem, refreshData } = useData();
  const users = data.users as any[] || [];
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [editName, setEditName] = useState('');
  const [sending, setSending] = useState(false);

  const filtered = search
    ? users.filter((u: any) =>
        [u.display_name, u.email, u.name].some(v => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : users;

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) { toast.error('Name and email required'); return; }
    setSending(true);
    try {
      const { data: profile } = await supabase.auth.getUser();
      const companyId = profile?.user?.user_metadata?.company_id;
      if (!companyId) { toast.error('No company context'); return; }

      const { data: result, error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, display_name: inviteName, company_id: companyId },
      });

      if (error) { toast.error(`Invite failed: ${error.message}`); return; }
      if (result?.error) { toast.error(`Invite failed: ${result.error}`); return; }

      toast.success(`Invited ${inviteName}`);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      await refreshData();
    } catch (err: any) {
      toast.error(`Invite failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    setEditName(user.display_name || '');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName) { toast.error('Name is required'); return; }
    const result = await updateItem('users', editingId, { display_name: editName } as any);
    if (result.error) { toast.error(`Update failed: ${result.error}`); return; }
    toast.success('User updated');
    setEditOpen(false);
    setEditingId(null);
    await refreshData();
  };

  const handleToggleActive = async (user: any) => {
    const result = await updateItem('users', user.id, { is_active: !user.is_active } as any);
    if (result.error) { toast.error(`Failed: ${result.error}`); return; }
    toast.success(user.is_active ? 'Deactivated' : 'Activated');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Users</h1>
        <Button size="sm" onClick={() => { setInviteEmail(''); setInviteName(''); setInviteOpen(true); }}>
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite User
        </Button>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} users</span>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs h-9">Name</TableHead>
              <TableHead className="text-xs h-9">Email</TableHead>
              <TableHead className="text-xs h-9">Approval</TableHead>
              <TableHead className="text-xs h-9 w-[100px]">Status</TableHead>
              <TableHead className="text-xs h-9 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No users found</TableCell></TableRow>
            ) : filtered.map((user: any) => (
              <TableRow key={user.id}>
                <TableCell className="text-sm py-2">{user.display_name || user.name || '—'}</TableCell>
                <TableCell className="text-sm py-2">{user.email || '—'}</TableCell>
                <TableCell className="py-2">
                  <Badge variant={user.approval_status === 'approved' ? 'default' : user.approval_status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {user.approval_status || 'pending'}
                  </Badge>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={user.is_active} onCheckedChange={() => handleToggleActive(user)} className="scale-75" />
                    <Badge variant={user.is_active ? 'default' : 'secondary'} className="text-[10px]">{user.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(user)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Display Name *</Label>
              <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="john@example.com" />
            </div>
            <p className="text-[10px] text-muted-foreground">The user will receive an email to set their password. Their account will be pre-approved.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={sending}>{sending ? 'Sending...' : 'Send Invite'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Display Name *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
