import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { AppLayout } from "@/components/AppLayout";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import HelpPage from "@/pages/HelpPage";
import ModuleSelect from "@/pages/ModuleSelect";
import SetupWizard from "@/pages/SetupWizard";
import PendingApproval from "@/pages/PendingApproval";
import DashboardPage from "@/pages/DashboardPage";
import CompaniesPage from "@/pages/masters/CompaniesPage";
import FactoriesShiftsPage from "@/pages/masters/FactoriesShiftsPage";
import WorkersRatesPage from "@/pages/masters/WorkersRatesPage";
import BuyersPage from "@/pages/masters/BuyersPage";
import FabricsPage from "@/pages/masters/FabricsPage";
import PrintingTablesPage from "@/pages/masters/PrintingTablesPage";
import StitchingLinesPage from "@/pages/masters/StitchingLinesPage";
import PrintingProductsPage from "@/pages/masters/PrintingProductsPage";
import StitchingProductsPage from "@/pages/masters/StitchingProductsPage";
import UsersPage from "@/pages/masters/UsersPage";
import PrintingOrdersPage from "@/pages/PrintingOrdersPage";
import StitchingOrdersPage from "@/pages/StitchingOrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import EntriesPage from "@/pages/EntriesPage";
import ReportsPage from "@/pages/ReportsPage";
import BomPage from "@/pages/BomPage";
import VendorsPage from "@/pages/VendorsPage";
import InventoryPage from "@/pages/InventoryPage";
import PurchaseOrdersPage from "@/pages/PurchaseOrdersPage";
import GRNPage from "@/pages/GRNPage";
import DispatchPage from "@/pages/DispatchPage";
import StockJobsPage from "@/pages/StockJobsPage";
import ProductionControlPage from "@/pages/ProductionControlPage";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const queryClient = new QueryClient();

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
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    );
  }

  if (profile && profile.approval_status === 'pending' && profile.company_id) {
    return <PendingApproval />;
  }

  if (profile && !profile.company_id && !wizardDone) {
    return <SetupWizard onComplete={() => setWizardDone(true)} />;
  }

  if (!currentModule) return <ModuleSelect />;

  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/settings/companies" element={<CompaniesPage />} />
            <Route path="/settings/factories-shifts" element={<FactoriesShiftsPage />} />
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
            <Route path="/stock-jobs" element={<StockJobsPage />} />
            <Route path="/production-control" element={<ProductionControlPage />} />
            <Route path="/dispatch" element={<DispatchPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/bom" element={<BomPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/grn" element={<GRNPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
