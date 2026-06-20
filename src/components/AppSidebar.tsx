import {
  LayoutDashboard, Printer, Scissors, ClipboardList, BarChart3, Settings,
  Building2, Factory, Users, UserCircle, Shirt, Grid3X3, Columns3, Package, Box, ShoppingCart,
  Warehouse, Truck, PackageCheck, FileText, Store, Layers, Gauge, Briefcase, HelpCircle
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const settingsItems = [
  { title: 'Companies', url: '/settings/companies', icon: Building2 },
  { title: 'Factories & Shifts', url: '/settings/factories-shifts', icon: Factory },
  { title: 'Workers & Rates', url: '/settings/workers-rates', icon: Users },
  { title: 'Buyers', url: '/settings/buyers', icon: UserCircle },
  { title: 'Fabrics', url: '/settings/fabrics', icon: Shirt },
  { title: 'Printing Tables', url: '/settings/printing-tables', icon: Grid3X3 },
  { title: 'Stitching Lines', url: '/settings/stitching-lines', icon: Columns3 },
  { title: 'Printing Products', url: '/settings/printing-products', icon: Box },
  { title: 'Stitching Products', url: '/settings/stitching-products', icon: Package },
  { title: 'Vendors', url: '/settings/vendors', icon: Store },
  { title: 'Users', url: '/settings/users', icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { currentModule } = useAuth();
  const isSettingsActive = location.pathname.startsWith('/settings');
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);

  const linkClass = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent";
  const activeClass = "bg-sidebar-accent font-medium text-sidebar-primary";

  const showPrinting = currentModule === 'printing' || currentModule === 'both';
  const showStitching = currentModule === 'stitching' || currentModule === 'both';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" end className={linkClass} activeClassName={activeClass}>
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-medium px-3">Orders</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {showPrinting && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/printing-orders" className={linkClass} activeClassName={activeClass}>
                      <Printer className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Printing Orders</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {showStitching && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/stitching-orders" className={linkClass} activeClassName={activeClass}>
                      <Scissors className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Stitching Orders</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/stock-jobs" className={linkClass} activeClassName={activeClass}>
                    <Briefcase className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Stock Jobs</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-medium px-3">Production</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/entries" className={linkClass} activeClassName={activeClass}>
                    <ClipboardList className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Entries</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/production-control" className={linkClass} activeClassName={activeClass}>
                    <Gauge className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Control</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/dispatch" className={linkClass} activeClassName={activeClass}>
                    <Truck className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Dispatch</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/reports" className={linkClass} activeClassName={activeClass}>
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Reports</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-medium px-3">Inventory</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/inventory" className={linkClass} activeClassName={activeClass}>
                    <Warehouse className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Stock</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-medium px-3">Procurement</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/bom" className={linkClass} activeClassName={activeClass}>
                    <FileText className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>BOM</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/purchase-orders" className={linkClass} activeClassName={activeClass}>
                    <ShoppingCart className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Purchase Orders</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/grn" className={linkClass} activeClassName={activeClass}>
                    <PackageCheck className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>GRN / Inward</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed ? (
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SidebarGroup>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">
                <span className="flex items-center gap-2"><Settings className="h-3.5 w-3.5" /> Settings</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {settingsItems.map(item => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.url} className={`${linkClass} pl-5`} activeClassName={activeClass}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/settings/companies" className={linkClass} activeClassName={activeClass}>
                      <Settings className="h-4 w-4 shrink-0" />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/help" className={linkClass} activeClassName={activeClass}>
                    <HelpCircle className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Help & Guides</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
