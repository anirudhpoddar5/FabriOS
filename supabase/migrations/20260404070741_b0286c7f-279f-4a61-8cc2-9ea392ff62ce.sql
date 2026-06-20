
-- Utility: update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ========== AUTH & USERS ==========

-- Profiles
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

-- User roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''), NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== COMPANY ==========

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

-- Link users to companies
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- ========== FACTORIES ==========

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

-- ========== SHIFTS ==========

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

-- ========== ONBOARDING ==========

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

-- ========== BUYERS ==========

CREATE TABLE public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT,
  country TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

-- ========== FABRICS ==========

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

-- ========== PRINTING PRODUCTS ==========

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

-- Link printing products to fabrics (many-to-many)
CREATE TABLE public.printing_product_fabrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printing_product_id UUID REFERENCES public.printing_products(id) ON DELETE CASCADE NOT NULL,
  fabric_id UUID REFERENCES public.fabrics(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (printing_product_id, fabric_id)
);
ALTER TABLE public.printing_product_fabrics ENABLE ROW LEVEL SECURITY;

-- ========== STITCHING PRODUCTS ==========

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

-- ========== PRINTING TABLES ==========

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

-- ========== STITCHING LINES ==========

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

-- ========== CURRENCIES ==========

CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

INSERT INTO public.currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'), ('EUR', 'Euro', '€'), ('GBP', 'British Pound', '£'),
  ('INR', 'Indian Rupee', '₹'), ('AUD', 'Australian Dollar', 'A$'), ('AED', 'UAE Dirham', 'د.إ'),
  ('CNY', 'Chinese Yuan', '¥'), ('PKR', 'Pakistani Rupee', '₨'), ('BDT', 'Bangladeshi Taka', '৳');

-- ========== UOM MASTER ==========

CREATE TABLE public.uom_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.uom_master ENABLE ROW LEVEL SECURITY;

INSERT INTO public.uom_master (code, name) VALUES
  ('pcs', 'Pieces'), ('meters', 'Meters'), ('yards', 'Yards'),
  ('kg', 'Kilograms'), ('sets', 'Sets'), ('rolls', 'Rolls'), ('sqm', 'Square Meters');

-- ========== WORKER TYPES ==========

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

-- ========== RATE MASTERS ==========

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

-- ========== ORDER HEADERS ==========

CREATE TABLE public.order_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('printing', 'stitching')),
  internal_po TEXT NOT NULL,
  buyer_po TEXT,
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

-- ========== ORDER ROWS (product level) ==========

CREATE TABLE public.order_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.order_headers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID, -- references printing_products or stitching_products depending on module
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

-- ========== ORDER COLOURWAYS (colour/size level) ==========

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

-- ========== PRODUCTION ENTRIES ==========

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
  resource_id UUID, -- printing_table or stitching_line
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

-- ========== BOM HEADERS ==========

CREATE TABLE public.bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.order_headers(id),
  bom_type TEXT NOT NULL DEFAULT 'order' CHECK (bom_type IN ('order', 'manual')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;

-- ========== BOM LINES ==========

CREATE TABLE public.bom_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES public.bom_headers(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL DEFAULT 'fabric' CHECK (category IN ('fabric', 'trim', 'other')),
  item_name TEXT NOT NULL,
  item_id UUID, -- optional link to fabrics or other masters
  quantity NUMERIC NOT NULL DEFAULT 0,
  uom TEXT,
  avg_consumption NUMERIC DEFAULT 0,
  extra_pct NUMERIC DEFAULT 0,
  rate NUMERIC DEFAULT 0,
  total_amount NUMERIC GENERATED ALWAYS AS (quantity * rate) STORED,
  vendor_name TEXT,
  remarks TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;

-- ========== TRIGGERS FOR updated_at ==========

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_factories_updated_at BEFORE UPDATE ON public.factories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_onboarding_updated_at BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
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

-- ========== RLS POLICIES ==========

-- Helper: get company_id for current user
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Profiles: users can read all profiles in their company, update own
CREATE POLICY "Users can view company profiles" ON public.profiles FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User roles: only admins manage, everyone reads
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Company-scoped tables: all authenticated users in same company
-- Companies
CREATE POLICY "Company members can view" ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company_id() OR created_by = auth.uid());
CREATE POLICY "Users can create company" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can update company" ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid()));

-- Macro for company-scoped tables
-- Factories
CREATE POLICY "View factories" ON public.factories FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage factories" ON public.factories FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Shifts
CREATE POLICY "View shifts" ON public.shifts FOR SELECT TO authenticated
  USING (factory_id IN (SELECT id FROM public.factories WHERE company_id = public.get_user_company_id()));
CREATE POLICY "Manage shifts" ON public.shifts FOR ALL TO authenticated
  USING (factory_id IN (SELECT id FROM public.factories WHERE company_id = public.get_user_company_id()));

-- Onboarding
CREATE POLICY "View onboarding" ON public.onboarding_progress FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage onboarding" ON public.onboarding_progress FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Buyers
CREATE POLICY "View buyers" ON public.buyers FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage buyers" ON public.buyers FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Fabrics
CREATE POLICY "View fabrics" ON public.fabrics FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage fabrics" ON public.fabrics FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Printing Products
CREATE POLICY "View printing_products" ON public.printing_products FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage printing_products" ON public.printing_products FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Printing Product Fabrics
CREATE POLICY "View printing_product_fabrics" ON public.printing_product_fabrics FOR SELECT TO authenticated
  USING (printing_product_id IN (SELECT id FROM public.printing_products WHERE company_id = public.get_user_company_id()));
CREATE POLICY "Manage printing_product_fabrics" ON public.printing_product_fabrics FOR ALL TO authenticated
  USING (printing_product_id IN (SELECT id FROM public.printing_products WHERE company_id = public.get_user_company_id()));

-- Stitching Products
CREATE POLICY "View stitching_products" ON public.stitching_products FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage stitching_products" ON public.stitching_products FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Printing Tables
CREATE POLICY "View printing_tables" ON public.printing_tables FOR SELECT TO authenticated
  USING (factory_id IN (SELECT id FROM public.factories WHERE company_id = public.get_user_company_id()));
CREATE POLICY "Manage printing_tables" ON public.printing_tables FOR ALL TO authenticated
  USING (factory_id IN (SELECT id FROM public.factories WHERE company_id = public.get_user_company_id()));

-- Stitching Lines
CREATE POLICY "View stitching_lines" ON public.stitching_lines FOR SELECT TO authenticated
  USING (factory_id IN (SELECT id FROM public.factories WHERE company_id = public.get_user_company_id()));
CREATE POLICY "Manage stitching_lines" ON public.stitching_lines FOR ALL TO authenticated
  USING (factory_id IN (SELECT id FROM public.factories WHERE company_id = public.get_user_company_id()));

-- Currencies (public read)
CREATE POLICY "Anyone can view currencies" ON public.currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage currencies" ON public.currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- UOM (public read)
CREATE POLICY "Anyone can view uom" ON public.uom_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage uom" ON public.uom_master FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Worker Types
CREATE POLICY "View worker_types" ON public.worker_types FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage worker_types" ON public.worker_types FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Rate Masters
CREATE POLICY "View rate_masters" ON public.rate_masters FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage rate_masters" ON public.rate_masters FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Order Headers
CREATE POLICY "View order_headers" ON public.order_headers FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage order_headers" ON public.order_headers FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- Order Rows
CREATE POLICY "View order_rows" ON public.order_rows FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.order_headers WHERE company_id = public.get_user_company_id()));
CREATE POLICY "Manage order_rows" ON public.order_rows FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM public.order_headers WHERE company_id = public.get_user_company_id()));

-- Order Colourways
CREATE POLICY "View order_colourways" ON public.order_colourways FOR SELECT TO authenticated
  USING (order_row_id IN (SELECT id FROM public.order_rows WHERE order_id IN (SELECT id FROM public.order_headers WHERE company_id = public.get_user_company_id())));
CREATE POLICY "Manage order_colourways" ON public.order_colourways FOR ALL TO authenticated
  USING (order_row_id IN (SELECT id FROM public.order_rows WHERE order_id IN (SELECT id FROM public.order_headers WHERE company_id = public.get_user_company_id())));

-- Production Entries
CREATE POLICY "View production_entries" ON public.production_entries FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage production_entries" ON public.production_entries FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- BOM Headers
CREATE POLICY "View bom_headers" ON public.bom_headers FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Manage bom_headers" ON public.bom_headers FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id());

-- BOM Lines
CREATE POLICY "View bom_lines" ON public.bom_lines FOR SELECT TO authenticated
  USING (bom_id IN (SELECT id FROM public.bom_headers WHERE company_id = public.get_user_company_id()));
CREATE POLICY "Manage bom_lines" ON public.bom_lines FOR ALL TO authenticated
  USING (bom_id IN (SELECT id FROM public.bom_headers WHERE company_id = public.get_user_company_id()));
