import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Printer, ClipboardList, BarChart3, Truck, FileText, Settings, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  {
    icon: LayoutDashboard, title: 'Dashboard',
    desc: 'This is your command center. View KPIs, active orders, production progress, and delayed items at a glance.',
    selector: '[href="/"]',
  },
  {
    icon: Printer, title: 'Orders',
    desc: 'Create and manage printing and stitching orders. Add colourways, assign fabrics, and track quantities.',
    selector: '[href="/printing-orders"]',
  },
  {
    icon: ClipboardList, title: 'Production Entries',
    desc: 'Log daily production output by order, colourway, shift, and worker type. Costs are auto-calculated from your rate masters.',
    selector: '[href="/entries"]',
  },
  {
    icon: Truck, title: 'Dispatch',
    desc: 'Record shipments against orders with automatic balance tracking. Manage challan numbers and vehicle details.',
    selector: '[href="/dispatch"]',
  },
  {
    icon: BarChart3, title: 'Reports',
    desc: '20+ report views: WIP status, cost analysis, profit/loss, monthly trends, buyer summaries, and more. Export to CSV, Excel, or PDF.',
    selector: '[href="/reports"]',
  },
  {
    icon: FileText, title: 'Settings',
    desc: 'Configure your factory: buyers, fabrics, worker types, rate masters, products, and user permissions.',
    selector: '[href="/settings/companies"]',
  },
];

const TOUR_KEY = 'fabrios_tour_done';

export function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setOpen(false);
  };

  if (!open) return null;

  const s = steps[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={dismiss} />
      <div className="relative bg-background border rounded-xl shadow-2xl max-w-sm w-full mx-4 p-5 animate-in zoom-in-95 duration-200">
        <button onClick={dismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <s.icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">{s.title}</div>
            <div className="text-[10px] text-muted-foreground">Step {step + 1} of {steps.length}</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? 'bg-foreground' : 'bg-muted-foreground/30'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-3 w-3 mr-1" /> Back
              </Button>
            ) : null}
            {step < steps.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={dismiss}>
                Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
