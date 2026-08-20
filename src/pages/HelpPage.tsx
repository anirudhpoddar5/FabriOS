import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ArrowLeft, Printer, Scissors, ClipboardList, BarChart3, Settings, Truck, FileText, Package, HelpCircle, UserCircle, Factory } from 'lucide-react';

type Article = { id: string; icon: any; title: string; desc: string; section: string; body?: string[] };

const articles: Article[] = [
  { id: 'getting-started', icon: HelpCircle, title: 'Getting Started', desc: 'Create your account, set up your company, and configure master data.', section: 'Basics' },
  { id: 'factories-shifts', icon: Factory, title: 'Factories & Shifts', desc: 'Add factories, configure shifts with start/end times.', section: 'Settings' },
  { id: 'workers-rates', icon: UserCircle, title: 'Workers & Rate Masters', desc: 'Define worker types, set rate bases (per person or per piece), and manage rate history.', section: 'Settings', body: [
    'A rate belongs to one factory, one shift and one worker type, and applies from its effective-from date onwards. Production cannot be logged for a combination that has no rate, so add a rate for every factory you actually work in.',
    'If production entries suddenly refuse to save, check the factory selected in the top bar. Rates added for one factory do not apply to another.',
  ] },
  { id: 'buyers', icon: UserCircle, title: 'Buyers', desc: 'Manage buyer contacts, codes, and countries.', section: 'Settings' },
  { id: 'fabrics', icon: Printer, title: 'Fabrics', desc: 'Add fabric types with GSM, width, and short form codes.', section: 'Settings' },
  { id: 'printing-products', icon: Printer, title: 'Printing Products', desc: 'Define standard printing products with sizes and UOM.', section: 'Settings' },
  { id: 'stitching-products', icon: Scissors, title: 'Stitching Products', desc: 'Define stitching products with size specifications.', section: 'Settings' },
  { id: 'printing-tables', icon: Printer, title: 'Printing Tables', desc: 'Configure printing table resources per factory.', section: 'Settings', body: [
    'Rows are grouped under a heading for each factory, with a count, so one factory\u2019s tables read together instead of being mixed in with another\u2019s.',
    'Every settings list can also be sorted: click a column heading to sort by it, click again to reverse. This works on Buyers, Fabrics, Vendors, Workers, Rates and the product lists too.',
  ] },
  { id: 'stitching-lines', icon: Scissors, title: 'Stitching Lines', desc: 'Configure stitching line resources per factory.', section: 'Settings' },
  { id: 'printing-orders', icon: Printer, title: 'Printing Orders', desc: 'Create printing orders with colourways, fabrics, and quantity tracking.', section: 'Orders', body: [
    'The Product, Fabric and Qty columns summarise all of an order\u2019s line rows. An order with two products shows both, and the quantity is their total. The monthly sub-totals and the page total use the same figures, as do the CSV and print exports.',
    'Deleting an order removes its rows and colourways with it. If the order already has production entries, dispatches, a BOM or purchase orders against it, the delete is refused and a message tells you what is linked. That is deliberate: deleting would destroy production history. Set the order to Cancelled instead.',
  ] },
  { id: 'stitching-orders', icon: Scissors, title: 'Stitching Orders', desc: 'Create stitching orders with colourways and production specs.', section: 'Orders' },
  { id: 'order-detail', icon: FileText, title: 'Order Detail Page', desc: 'View order info, colourways, and linked production entries.', section: 'Orders', body: [
    'To mark an order Started, Completed, Shipped or Cancelled, use the status dropdown next to the order number at the top of this page. You can also tick orders in the list and use Change status to update several at once.',
    'The Status column in the order list is not the same thing. It is calculated from your production entries and dates: Not Started means nothing has been logged, WIP means work is in progress, and Delayed means the target date has passed. That is why it can differ from the status you set by hand.',
  ] },
  { id: 'entries', icon: ClipboardList, title: 'Production Entries', desc: 'Log daily production with order, colourway, shift, resource, and worker. View auto-calculated labour costs.', section: 'Production', body: [
    'There are four tabs. Entry List shows what has already been logged. Single Entry is one entry at a time. Quick Entry is a large-button layout for the shop floor. Office Grid is a spreadsheet-style grid for logging many rows at once, and accepts a paste straight from Excel.',
    'In the Office Grid, fill a row left to right: date, module, order, product, colour, shift, resource, worker type, then persons and output. Choose the product before the colour — the colour list is filtered to the product you picked.',
    'A row only counts towards "Save N Entries" once every field is filled AND a rate exists for that combination. If nothing can be saved, a red message above the grid names the exact reason.',
    'The most common reason is "No rate set for this factory + shift + worker type on this date". Rates are per factory. If you switch the factory in the top bar to one that has no rates yet, every row will be blocked until you add them under Settings, Workers and Rates.',
  ] },
  { id: 'bulk-entries', icon: ClipboardList, title: 'Bulk Entry', desc: 'Multi-row entry with clipboard paste support for rapid data entry.', section: 'Production' },
  { id: 'stock-jobs', icon: Package, title: 'Stock Jobs', desc: 'Create production jobs not linked to customer orders.', section: 'Production' },
  { id: 'dispatch', icon: Truck, title: 'Dispatch', desc: 'Record dispatches against orders with available balance validation.', section: 'Logistics' },
  { id: 'reports-overview', icon: BarChart3, title: 'Reports Overview', desc: '20+ report views: WIP, cost analysis, profit/loss, monthly trends, buyer summary, and more. Export to CSV, PDF, or Excel.', section: 'Reports' },
  { id: 'bom', icon: FileText, title: 'BOM & Purchase Orders', desc: 'Create bills of material from orders and generate purchase orders.', section: 'Procurement' },
  { id: 'inventory', icon: Package, title: 'Inventory', desc: 'Track stock levels, reorder points, and stock transactions.', section: 'Procurement' },
  { id: 'grn', icon: FileText, title: 'Goods Receipt (GRN)', desc: 'Record goods received against purchase orders.', section: 'Procurement' },
  { id: 'vendors', icon: UserCircle, title: 'Vendors', desc: 'Manage vendor master with contact info and payment terms.', section: 'Settings' },
  { id: 'users', icon: UserCircle, title: 'User Management', desc: 'Manage user accounts, approve pending users, and assign factories.', section: 'Settings' },
  { id: 'dashboard', icon: BarChart3, title: 'Dashboard', desc: 'View KPI cards, active/delayed orders, and production progress at a glance.', section: 'Basics' },
  { id: 'module-select', icon: Settings, title: 'Module Selection', desc: 'Choose which modules (printing, stitching, or both) are active for your company.', section: 'Basics' },
];

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = query
    ? articles.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.desc.toLowerCase().includes(query.toLowerCase()) || a.section.toLowerCase().includes(query.toLowerCase()))
    : articles;

  const sections = [...new Set(filtered.map(a => a.section))];
  const grouped = sections.map(s => ({ section: s, items: filtered.filter(a => a.section === s) }));

  const article = selected ? articles.find(a => a.id === selected) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Help &amp; Guides</h1>
          <p className="text-sm text-muted-foreground mt-1">Search articles or browse by section.</p>
        </div>

        <div className="relative max-w-lg mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-10"
            placeholder="Search help articles..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {article ? (
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" /> All articles
            </Button>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <article.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{article.title}</h2>
                  <Badge variant="secondary" className="mt-0.5 text-[10px]">{article.section}</Badge>
                </div>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                <p>{article.desc}</p>
                {article.body
                  ? article.body.map((para, i) => <p key={i}>{para}</p>)
                  : <p>Navigate to the <strong>{article.title}</strong> section from the sidebar to get started. All master data pages use a consistent pattern: click <strong>Add</strong> to create a new record, click a row to edit, and use the search bar to filter the table.</p>}
                <p>Need more help? Contact support at support@fabrios.app.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(g => (
              <div key={g.section}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{g.section}</h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {g.items.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a.id)}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <a.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{a.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No articles found for "{query}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
