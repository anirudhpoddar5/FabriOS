-- FabriOS — Part 1c: Procurement + stock tables + get_user_company_id + all triggers
-- Run AFTER part1b

CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'fabric',
  uom TEXT NOT NULL DEFAULT 'meters',
  fabric_id UUID REFERENCES public.fabrics(id),
  reorder_level NUMERIC DEFAULT 0,
  opening_stock NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  job_number TEXT NOT NULL,
  product_name TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT 'printing',
  target_qty NUMERIC NOT NULL DEFAULT 0,
  produced_qty NUMERIC NOT NULL DEFAULT 0,
  uom TEXT DEFAULT 'meters',
  status TEXT NOT NULL DEFAULT 'planned',
  start_date DATE,
  end_date DATE,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  po_number TEXT NOT NULL,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  order_id UUID REFERENCES public.order_headers(id),
  source_type TEXT NOT NULL DEFAULT 'manual',
  currency TEXT NOT NULL DEFAULT 'USD',
  total_amount NUMERIC DEFAULT 0,
  invoice_number TEXT,
  invoice_date DATE,
  invoice_amount NUMERIC,
  payment_status TEXT DEFAULT 'pending',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id),
  item_name TEXT NOT NULL,
  uom TEXT NOT NULL DEFAULT 'meters',
  qty_ordered NUMERIC NOT NULL DEFAULT 0,
  qty_received NUMERIC NOT NULL DEFAULT 0,
  rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.grn_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  grn_number TEXT NOT NULL,
  po_id UUID REFERENCES public.purchase_orders(id),
  vendor_id UUID REFERENCES public.vendors(id),
  grn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grn_headers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.grn_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES public.grn_headers(id) ON DELETE CASCADE,
  po_line_id UUID REFERENCES public.purchase_order_lines(id),
  item_id UUID REFERENCES public.inventory_items(id),
  item_name TEXT NOT NULL,
  qty_received NUMERIC NOT NULL DEFAULT 0,
  uom TEXT,
  lot_number TEXT,
  batch_number TEXT,
  roll_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grn_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  txn_type TEXT NOT NULL DEFAULT 'inward',
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  qty NUMERIC NOT NULL DEFAULT 0,
  uom TEXT,
  lot_number TEXT,
  batch_number TEXT,
  roll_number TEXT,
  order_id UUID REFERENCES public.order_headers(id),
  stock_job_id UUID REFERENCES public.stock_jobs(id),
  vendor_id UUID REFERENCES public.vendors(id),
  grn_id UUID REFERENCES public.grn_headers(id),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dispatch_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_id UUID REFERENCES public.order_headers(id),
  buyer_id UUID REFERENCES public.buyers(id),
  dispatch_type TEXT NOT NULL DEFAULT 'order',
  product_name TEXT,
  colour TEXT,
  size TEXT,
  qty NUMERIC NOT NULL DEFAULT 0,
  uom TEXT DEFAULT 'pcs',
  vehicle_number TEXT,
  challan_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dispatch_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
$func$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_factories_updated_at BEFORE UPDATE ON public.factories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_onboarding_progress_updated_at BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_buyers_updated_at BEFORE UPDATE ON public.buyers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fabrics_updated_at BEFORE UPDATE ON public.fabrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_printing_products_updated_at BEFORE UPDATE ON public.printing_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stitching_products_updated_at BEFORE UPDATE ON public.stitching_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_printing_tables_updated_at BEFORE UPDATE ON public.printing_tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stitching_lines_updated_at BEFORE UPDATE ON public.stitching_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_worker_types_updated_at BEFORE UPDATE ON public.worker_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rate_masters_updated_at BEFORE UPDATE ON public.rate_masters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_order_headers_updated_at BEFORE UPDATE ON public.order_headers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_order_rows_updated_at BEFORE UPDATE ON public.order_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_order_colourways_updated_at BEFORE UPDATE ON public.order_colourways FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_production_entries_updated_at BEFORE UPDATE ON public.production_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bom_headers_updated_at BEFORE UPDATE ON public.bom_headers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bom_lines_updated_at BEFORE UPDATE ON public.bom_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_transactions_updated_at BEFORE UPDATE ON public.stock_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_order_lines_updated_at BEFORE UPDATE ON public.purchase_order_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_grn_headers_updated_at BEFORE UPDATE ON public.grn_headers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_grn_lines_updated_at BEFORE UPDATE ON public.grn_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dispatch_records_updated_at BEFORE UPDATE ON public.dispatch_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_jobs_updated_at BEFORE UPDATE ON public.stock_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
