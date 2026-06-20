-- FabriOS — Part 1b: Lookup tables + order tables + BOM
-- Run AFTER part1a

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
  ('INR', 'Indian Rupee', 'INR'),
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
