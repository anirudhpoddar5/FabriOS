import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Printer, ClipboardList, Warehouse, BarChart3 } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/printing-orders', label: 'Orders', icon: Printer },
  { path: '/entries', label: 'Entries', icon: ClipboardList },
  { path: '/inventory', label: 'Stock', icon: Warehouse },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentModule } = useAuth();
  const showStitching = currentModule === 'stitching' && currentModule !== 'both';

  const items = navItems.map(item => {
    if (item.path === '/printing-orders' && showStitching) {
      return { ...item, path: '/stitching-orders' };
    }
    return item;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {items.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path === '/' && location.pathname === '/dashboard') ||
            (item.path === '/printing-orders' && location.pathname.startsWith('/printing-orders')) ||
            (item.path === '/stitching-orders' && location.pathname.startsWith('/stitching-orders')) ||
            (item.path === '/entries' && location.pathname.startsWith('/entries')) ||
            (item.path === '/inventory' && location.pathname.startsWith('/inventory')) ||
            (item.path === '/reports' && location.pathname.startsWith('/reports'));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 h-full px-3 transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
