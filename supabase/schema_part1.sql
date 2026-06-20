-- FabriOS — Part 1 of 2: Tables, Functions, Triggers
-- Run this first in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$func$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$func$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'pending'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  address TEXT,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);

CREATE TABLE public.factories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'mixed' CHECK (type IN ('printing', 'stitching', 'mixed')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.factories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID REFERENCES public.factories(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_done BOOLEAN NOT NULL DEFAULT false,
  buyers_done BOOLEAN NOT NULL DEFAULT false,
  fabrics_done BOOLEAN NOT NULL DEFAULT false,
  printing_products_done BOOLEAN NOT NULL DEFAULT false,
  stitching_products_done BOOLEAN NOT NULL DEFAULT false,
  printing_tables_done BOOLEAN NOT NULL DEFAULT false,
  stitching_lines_done BOOLEAN NOT NULL DEFAULT false,
  factories_done BOOLEAN NOT NULL DEFAULT false,
  wizard_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT,
  country TEXT NOT NULL,
  contact_person TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fabrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  short_form TEXT,
  gsm NUMERIC,
  width NUMERIC,
  width_unit TEXT DEFAULT 'inches',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fabrics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.printing_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  size TEXT,
  uom TEXT NOT NULL DEFAULT 'meters',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.printing_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.printing_product_fabrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printing_product_id UUID REFERENCES public.printing_products(id) ON DELETE CASCADE NOT NULL,
  fabric_id UUID REFERENCES public.fabrics(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (printing_product_id, fabric_id)
);
ALTER TABLE public.printing_product_fabrics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stitching_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  size_spec TEXT,
  short_form TEXT,
  uom TEXT NOT NULL DEFAULT 'pcs',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stitching_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.printing_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID REFERENCES public.factories(id) ON DELETE CASCADE NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  table_number INTEGER,
  size TEXT,
  operators INTEGER DEFAULT 0,
  supervisor_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.printing_tables ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stitching_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID REFERENCES public.factories(id) ON DELETE CASCADE NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  line_number INTEGER,
  machines INTEGER DEFAULT 0,
  operators INTEGER DEFAULT 0,
  supervisor_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stitching_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

INSERT INTO public.currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('INR', 'Indian Rupee', '₹'),
  ('AUD', 'Australian Dollar', 'A$'),
  ('AED', 'UAE Dirham', 'AED'),
  ('CNY', 'Chinese Yuan', 'CNY'),
  ('PKR', 'Pakistani Rupee', 'PKR'),
  ('BDT', 'Bangladeshi Taka', 'BDT');

CREATE TABLE public.uom_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.uom_master ENABLE ROW LEVEL SECURITY;

INSERT INTO public.uom_master (code, name) VALUES
  ('pcs', 'Pieces'),
  ('meters', 'Meters'),
  ('yards', 'Yards'),
  ('kg', 'Kilograms'),
  ('sets', 'Sets'),
  ('rolls', 'Rolls'),
  ('sqm', 'Square Meters');

CREATE TABLE public.worker_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  factory_id UUID REFERENCES public.factories(id),
  name TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT 'both' CHECK (module IN ('printing', 'stitching', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.worker_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rate_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  factory_id UUID REFERENCES public.factories(id),
  shift_id UUID REFERENCES public.shifts(id),
  worker_type_id UUID REFERENCES public.worker_types(id),
  rate_basis TEXT NOT NULL DEFAULT 'per_person_per_shift' CHECK (rate_basis IN ('per_person_per_shift', 'per_piece', 'per_meter')),
  rate_value NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_masters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('printing', 'stitching')),
  internal_po TEXT NOT NULL,
  buyer_po TEXT,
  buyer_p_o TEXT,
  buyer_id UUID REFERENCES public.buyers(id),
  style TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  target_end_date DATE,
  buyer_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'Started' CHECK (status IN ('Started', 'Completed', 'Cancelled', 'Shipped')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_headers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.order_headers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID,
  fabric_id UUID REFERENCES public.fabrics(id),
  fabric_width TEXT,
  uom TEXT NOT NULL DEFAULT 'meters',
  order_qty NUMERIC NOT NULL DEFAULT 0,
  chart_qty NUMERIC NOT NULL DEFAULT 0,
  rate_per_item NUMERIC DEFAULT 0,
  no_of_colours INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_rows ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_colourways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_row_id UUID REFERENCES public.order_rows(id) ON DELETE CASCADE NOT NULL,
  colour_name TEXT NOT NULL,
  size TEXT,
  ordered_qty NUMERIC NOT NULL DEFAULT 0,
  uom TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_colourways ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('printing', 'stitching')),
  order_id UUID REFERENCES public.order_headers(id),
  order_row_id UUID REFERENCES public.order_rows(id),
  colourway_id UUID REFERENCES public.order_colourways(id),
  factory_id UUID REFERENCES public.factories(id),
  shift_id UUID REFERENCES public.shifts(id),
  resource_id UUID,
  worker_type_id UUID REFERENCES public.worker_types(id),
  persons_used INTEGER NOT NULL DEFAULT 0,
  output_qty NUMERIC NOT NULL DEFAULT 0,
  output_uom TEXT,
  rate_master_id UUID REFERENCES public.rate_masters(id),
  rate_basis TEXT,
  rate_value NUMERIC DEFAULT 0,
  cost_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.order_headers(id),
  bom_type TEXT NOT NULL DEFAULT 'order' CHECK (bom_type IN ('order', 'stock', 'manual')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'po_generated', 'closed')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bom_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES public.bom_headers(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL DEFAULT 'fabric' CHECK (category IN ('fabric', 'trim', 'accessory', 'other')),
  item_name TEXT NOT NULL,
  item_id UUID,
  quantity NUMERIC NOT NULL DEFAULT 0,
  uom TEXT,
  avg_consumption NUMERIC DEFAULT 0,
  extra_pct NUMERIC DEFAULT 0,
  rate NUMERIC DEFAULT 0,
  total_amount NUMERIC,
  vendor_name TEXT,
  remarks TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;

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
  stock_job_id UUID,
  vendor_id UUID REFERENCES public.vendors(id),
  grn_id UUID,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.stock_transactions
  ADD CONSTRAINT stock_transactions_stock_job_id_fkey FOREIGN KEY (stock_job_id) REFERENCES public.stock_jobs(id);

ALTER TABLE public.stock_transactions
  ADD CONSTRAINT stock_transactions_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.grn_headers(id);

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
