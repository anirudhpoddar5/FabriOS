import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, BarChart3, ClipboardList, Truck, FileText, Layers, Sparkles, ArrowRight, Menu, X, CheckCircle2, Clock, Shield, ChevronRight } from 'lucide-react';

const features = [
  { icon: Printer, title: 'Orders & Colourways', desc: 'Create printing and stitching orders with multiple colour variants, fabric specs, and quantity tracking — all in one view.' },
  { icon: ClipboardList, title: 'Production Entry', desc: 'Log daily output by order, shift, and worker. Costs calculate automatically from your rate masters. No spreadsheet formulas.' },
  { icon: BarChart3, title: 'Reports & Insights', desc: '20+ ready-made reports — WIP, profit/loss, monthly trends, buyer summaries. Export to Excel, CSV, or PDF in one click.' },
  { icon: Truck, title: 'Dispatch & Balance', desc: 'Ship against orders with real-time balance tracking. The system prevents over-dispatch automatically.' },
  { icon: FileText, title: 'BOM & Procurement', desc: 'Convert orders into bills of material, generate purchase orders, and track goods receipt end-to-end.' },
  { icon: Layers, title: 'Everything Configurable', desc: 'Set up factories, shifts, worker types, rate masters, buyers, fabrics, and products — no coding required.' },
];

const steps = [
  { num: 1, title: 'Set up your factory', desc: 'Add your factory, shifts, workers, and rate masters in minutes. Do it once, use it everywhere.' },
  { num: 2, title: 'Create orders', desc: 'Enter printing or stitching orders with colourways, fabrics, and quantities. Everything flows from here.' },
  { num: 3, title: 'Log production, ship, repeat', desc: 'Daily entries auto-calculate costs. Track dispatch balances. Generate BOMs and POs when you need materials.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/85 backdrop-blur-xl border-b shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground text-xs font-black">F</span>
            </div>
            <span>fabri<span className="text-primary">OS</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign in</Button>
            <Button size="sm" className="shadow-sm" onClick={() => navigate('/login?signup=1')}>Get started <ChevronRight className="ml-0.5 h-3.5 w-3.5" /></Button>
          </nav>
          <button className="md:hidden p-1.5 rounded-md hover:bg-secondary transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t bg-background/95 backdrop-blur-xl px-5 py-4 space-y-3">
            <a href="#features" className="block text-sm text-muted-foreground py-1.5" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-sm text-muted-foreground py-1.5" onClick={() => setMenuOpen(false)}>How it works</a>
            <hr className="border-t" />
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/login')}>Sign in</Button>
            <Button size="sm" className="w-full shadow-sm" onClick={() => navigate('/login?signup=1')}>Get started</Button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-40 md:pb-32 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border bg-background/50 backdrop-blur text-xs text-muted-foreground mb-6 shadow-xs">
            <Sparkles className="h-3 w-3 text-primary" />
            Finally — a production OS built for print &amp; stitch
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.08]">
            Your factory runs on{' '}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-blue-600 bg-clip-text text-transparent">one platform</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            FabriOS replaces scattered spreadsheets and sticky notes with a single, simple platform
            for orders, production, inventory, and dispatch. Set up in 10 minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="w-full sm:w-auto text-base shadow-md gap-1.5" onClick={() => navigate('/login?signup=1')}>
              Start free <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No credit card</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-emerald-500" /> 10-min setup</span>
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-emerald-500" /> Your data stays yours</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-24 px-5 bg-secondary/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-primary tracking-widest uppercase mb-2">How it works</div>
            <h2 className="text-2xl sm:text-3xl font-bold">Three steps to get started</h2>
            <p className="mt-2 text-muted-foreground">No complicated setup. No training required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map(s => (
              <div key={s.num} className="relative p-6 rounded-2xl border bg-card hover:shadow-md transition-all group">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm mb-4">
                  {s.num}
                </div>
                <h3 className="font-semibold text-base mb-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-muted-foreground/20 group-last:hidden">
                  <ChevronRight className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-primary tracking-widest uppercase mb-2">Features</div>
            <h2 className="text-2xl sm:text-3xl font-bold">Everything you need to run production</h2>
            <p className="mt-2 text-muted-foreground">From order entry to final dispatch — on a single screen.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className="group p-5 rounded-xl border bg-card hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                  <f.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 px-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center relative">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to simplify your factory?</h2>
          <p className="mt-3 text-muted-foreground">Set up your company in minutes. No credit card, no commitment.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="w-full sm:w-auto text-base shadow-md gap-1.5" onClick={() => navigate('/login?signup=1')}>
              Get started free <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-black">F</span>
            </div>
            fabri<span className="text-primary">OS</span>
          </div>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} FabriOS. All rights reserved.</p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
