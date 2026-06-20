import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Printer, Scissors, Layers, Factory } from 'lucide-react';
import { useAuth, AppModule } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const moduleLabels: Record<AppModule, { label: string; icon: typeof Printer }> = {
  printing: { label: 'Printing', icon: Printer },
  stitching: { label: 'Stitching', icon: Scissors },
  both: { label: 'Both', icon: Layers },
};

export function AppHeader() {
  const { signOut, currentModule, profile } = useAuth();
  const { data, currentFactoryId, setCurrentFactoryId } = useData();
  const mod = currentModule ? moduleLabels[currentModule] : null;
  const factories = data.factories.filter((f: any) => f.active !== false && f.isActive !== false);

  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <span className="text-sm font-semibold tracking-tight">fabriOS</span>
        {mod && (
          <Badge
            variant="secondary"
            className="cursor-pointer text-[10px] gap-1 font-normal hover:bg-secondary/80"
            onClick={() => { localStorage.removeItem('fabrios_module'); window.location.reload(); }}
          >
            <mod.icon className="h-3 w-3" />
            {mod.label}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        {factories.length > 0 && (
          <Select value={currentFactoryId || ''} onValueChange={v => setCurrentFactoryId(v || null)}>
            <SelectTrigger className="h-8 w-[90px] xs:w-[110px] sm:w-[140px] text-xs">
              <Factory className="h-3 w-3 shrink-0" />
              <SelectValue placeholder="Factory" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              {factories.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {profile && (
          <span className="text-xs text-muted-foreground hidden sm:inline">{profile.display_name || profile.email}</span>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
