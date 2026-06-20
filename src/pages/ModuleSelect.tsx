import { Printer, Scissors, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth, AppModule } from '@/context/AuthContext';

const modules: { key: AppModule; title: string; desc: string; icon: typeof Printer }[] = [
  { key: 'printing', title: 'Printing', desc: 'Manage printing orders, tables, and production', icon: Printer },
  { key: 'stitching', title: 'Stitching', desc: 'Manage stitching orders, lines, and production', icon: Scissors },
  { key: 'both', title: 'Both', desc: 'Full access to printing and stitching', icon: Layers },
];

export default function ModuleSelect() {
  const { setCurrentModule } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-1">fabriOS</h1>
          <p className="text-sm text-muted-foreground">Select your workspace</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modules.map(m => (
            <Card
              key={m.key}
              className="cursor-pointer hover:border-foreground/20 hover:shadow-md transition-all group"
              onClick={() => setCurrentModule(m.key)}
            >
              <CardContent className="flex flex-col items-center text-center p-6 gap-3">
                <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-foreground/5 transition-colors">
                  <m.icon className="h-6 w-6 text-foreground/70" />
                </div>
                <h2 className="font-semibold text-sm">{m.title}</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
