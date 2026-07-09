import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const Login = lazy(() => import("@/pages/Login"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const HelpPage = lazy(() => import("@/pages/HelpPage"));
const ModuleSelect = lazy(() => import("@/pages/ModuleSelect"));
const SetupWizard = lazy(() => import("@/pages/SetupWizard"));
const PendingApproval = lazy(() => import("@/pages/PendingApproval"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const CompaniesPage = lazy(() => import("@/pages/masters/CompaniesPage"));
const FactoriesShiftsPage = lazy(() => import("@/pages/masters/FactoriesShiftsPage"));
const WorkersPage = lazy(() => import("@/pages/masters/WorkersPage"));
const WorkersRatesPage = lazy(() => import("@/pages/masters/WorkersRatesPage"));
const BuyersPage = lazy(() => import("@/pages/masters/BuyersPage"));
const FabricsPage = lazy(() => import("@/pages/masters/FabricsPage"));
const PrintingTablesPage = lazy(() => import("@/pages/masters/PrintingTablesPage"));
const StitchingLinesPage = lazy(() => import("@/pages/masters/StitchingLinesPage"));
const PrintingProductsPage = lazy(() => import("@/pages/masters/PrintingProductsPage"));
const StitchingProductsPage = lazy(() => import("@/pages/masters/StitchingProductsPage"));
const UsersPage = lazy(() => import("@/pages/masters/UsersPage"));
const PrintingOrdersPage = lazy(() => import("@/pages/PrintingOrdersPage"));
const StitchingOrdersPage = lazy(() => import("@/pages/StitchingOrdersPage"));
const OrderDetailPage = lazy(() => import("@/pages/OrderDetailPage"));
const EntriesPage = lazy(() => import("@/pages/EntriesPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const BomPage = lazy(() => import("@/pages/BomPage"));
const VendorsPage = lazy(() => import("@/pages/VendorsPage"));
const InventoryPage = lazy(() => import("@/pages/InventoryPage"));
const PurchaseOrdersPage = lazy(() => import("@/pages/PurchaseOrdersPage"));
const GRNPage = lazy(() => import("@/pages/GRNPage"));
const DispatchPage = lazy(() => import("@/pages/DispatchPage"));
const StockJobsPage = lazy(() => import("@/pages/StockJobsPage"));
const ProductionControlPage = lazy(() => import("@/pages/ProductionControlPage"));
const AttendancePage = lazy(() => import("@/pages/AttendancePage"));
const MaterialIssuesPage = lazy(() => import("@/pages/MaterialIssuesPage"));
const QuotationsPage = lazy(() => import("@/pages/QuotationsPage"));
const InvoicesPage = lazy(() => import("@/pages/InvoicesPage"));
const SubcontractJobsPage = lazy(() => import("@/pages/SubcontractJobsPage"));
const PODetailPage = lazy(() => import("@/pages/PODetailPage"));
const BOMDetailPage = lazy(() => import("@/pages/BOMDetailPage"));
const GRNDetailPage = lazy(() => import("@/pages/GRNDetailPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

function AppRoutes() {
  const { session, loading, profile, currentModule } = useAuth();
  const [wizardDone, setWizardDone] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <BrowserRouter>
        <SuspenseWrapper>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </SuspenseWrapper>
      </BrowserRouter>
    );
  }

  if (profile && profile.approval_status === 'pending' && profile.company_id) {
    return <SuspenseWrapper><PendingApproval /></SuspenseWrapper>;
  }

  if (profile && !profile.company_id && !wizardDone) {
    return <SuspenseWrapper><SetupWizard onComplete={() => setWizardDone(true)} /></SuspenseWrapper>;
  }

  if (!currentModule) return <SuspenseWrapper><ModuleSelect /></SuspenseWrapper>;

  return (
    <DataProvider>
      <BrowserRouter>
        <SuspenseWrapper>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/settings/companies" element={<CompaniesPage />} />
            <Route path="/settings/factories-shifts" element={<FactoriesShiftsPage />} />
            <Route path="/settings/workers" element={<WorkersPage />} />
            <Route path="/settings/workers-rates" element={<WorkersRatesPage />} />
            <Route path="/settings/buyers" element={<BuyersPage />} />
            <Route path="/settings/fabrics" element={<FabricsPage />} />
            <Route path="/settings/printing-tables" element={<PrintingTablesPage />} />
            <Route path="/settings/stitching-lines" element={<StitchingLinesPage />} />
            <Route path="/settings/printing-products" element={<PrintingProductsPage />} />
            <Route path="/settings/stitching-products" element={<StitchingProductsPage />} />
            <Route path="/settings/users" element={<UsersPage />} />
            <Route path="/settings/vendors" element={<VendorsPage />} />
            <Route path="/printing-orders" element={<PrintingOrdersPage />} />
            <Route path="/printing-orders/:id" element={<OrderDetailPage />} />
            <Route path="/stitching-orders" element={<StitchingOrdersPage />} />
            <Route path="/stitching-orders/:id" element={<OrderDetailPage />} />
            <Route path="/entries" element={<EntriesPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/material-issues" element={<MaterialIssuesPage />} />
            <Route path="/quotations" element={<QuotationsPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/subcontract-jobs" element={<SubcontractJobsPage />} />
            <Route path="/stock-jobs" element={<StockJobsPage />} />
            <Route path="/production-control" element={<ProductionControlPage />} />
            <Route path="/dispatch" element={<DispatchPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/bom" element={<BomPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/purchase-orders/:id" element={<PODetailPage />} />
            <Route path="/bom/:id" element={<BOMDetailPage />} />
            <Route path="/grn" element={<GRNPage />} />
            <Route path="/grn/:id" element={<GRNDetailPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </SuspenseWrapper>
      </BrowserRouter>
    </DataProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SuspenseWrapper>
            <AppRoutes />
          </SuspenseWrapper>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
