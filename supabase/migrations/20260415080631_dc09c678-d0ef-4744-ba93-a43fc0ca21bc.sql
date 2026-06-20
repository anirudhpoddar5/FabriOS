-- Vendors master
CREATE TABLE public.vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  code text NOT NULL,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  payment_terms text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View vendors" ON public.vendors FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage vendors" ON public.vendors FOR ALL TO authenticated USING (company_id = get_user_company_id());

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inventory items (material master)
CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'fabric', -- fabric, trim, accessory, other
  uom text NOT NULL DEFAULT 'meters',
  fabric_id uuid REFERENCES public.fabrics(id),
  reorder_level numeric DEFAULT 0,
  opening_stock numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View inventory_items" ON public.inventory_items FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage inventory_items" ON public.inventory_items FOR ALL TO authenticated USING (company_id = get_user_company_id());

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Stock transactions (all movements)
CREATE TABLE public.stock_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  txn_type text NOT NULL DEFAULT 'inward', -- inward, outward, adjustment, consumption, opening
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  qty numeric NOT NULL DEFAULT 0,
  uom text,
  lot_number text,
  batch_number text,
  roll_number text,
  order_id uuid REFERENCES public.order_headers(id),
  stock_job_id uuid,
  vendor_id uuid REFERENCES public.vendors(id),
  grn_id uuid,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View stock_transactions" ON public.stock_transactions FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage stock_transactions" ON public.stock_transactions FOR ALL TO authenticated USING (company_id = get_user_company_id());

CREATE TRIGGER update_stock_transactions_updated_at BEFORE UPDATE ON public.stock_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Purchase orders
CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  po_number text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  po_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft', -- draft, sent, partial, received, closed, cancelled
  order_id uuid REFERENCES public.order_headers(id),
  source_type text NOT NULL DEFAULT 'manual', -- manual, order_bom, stock_bom
  currency text NOT NULL DEFAULT 'USD',
  total_amount numeric DEFAULT 0,
  invoice_number text,
  invoice_date date,
  invoice_amount numeric,
  payment_status text DEFAULT 'pending', -- pending, partial, paid
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (company_id = get_user_company_id());

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Purchase order lines
CREATE TABLE public.purchase_order_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id),
  item_name text NOT NULL,
  uom text NOT NULL DEFAULT 'meters',
  qty_ordered numeric NOT NULL DEFAULT 0,
  qty_received numeric NOT NULL DEFAULT 0,
  rate numeric DEFAULT 0,
  amount numeric DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View po_lines" ON public.purchase_order_lines FOR SELECT TO authenticated
  USING (po_id IN (SELECT id FROM purchase_orders WHERE company_id = get_user_company_id()));
CREATE POLICY "Manage po_lines" ON public.purchase_order_lines FOR ALL TO authenticated
  USING (po_id IN (SELECT id FROM purchase_orders WHERE company_id = get_user_company_id()));

CREATE TRIGGER update_po_lines_updated_at BEFORE UPDATE ON public.purchase_order_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- GRN headers
CREATE TABLE public.grn_headers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  grn_number text NOT NULL,
  po_id uuid REFERENCES public.purchase_orders(id),
  vendor_id uuid REFERENCES public.vendors(id),
  grn_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft', -- draft, accepted, partial
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grn_headers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View grn_headers" ON public.grn_headers FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage grn_headers" ON public.grn_headers FOR ALL TO authenticated USING (company_id = get_user_company_id());

CREATE TRIGGER update_grn_headers_updated_at BEFORE UPDATE ON public.grn_headers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- GRN lines
CREATE TABLE public.grn_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id uuid NOT NULL REFERENCES public.grn_headers(id) ON DELETE CASCADE,
  po_line_id uuid REFERENCES public.purchase_order_lines(id),
  item_id uuid REFERENCES public.inventory_items(id),
  item_name text NOT NULL,
  qty_received numeric NOT NULL DEFAULT 0,
  uom text,
  lot_number text,
  batch_number text,
  roll_number text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grn_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View grn_lines" ON public.grn_lines FOR SELECT TO authenticated
  USING (grn_id IN (SELECT id FROM grn_headers WHERE company_id = get_user_company_id()));
CREATE POLICY "Manage grn_lines" ON public.grn_lines FOR ALL TO authenticated
  USING (grn_id IN (SELECT id FROM grn_headers WHERE company_id = get_user_company_id()));

CREATE TRIGGER update_grn_lines_updated_at BEFORE UPDATE ON public.grn_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dispatch records
CREATE TABLE public.dispatch_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  dispatch_date date NOT NULL DEFAULT CURRENT_DATE,
  order_id uuid REFERENCES public.order_headers(id),
  buyer_id uuid REFERENCES public.buyers(id),
  dispatch_type text NOT NULL DEFAULT 'order', -- order, stock
  product_name text,
  colour text,
  size text,
  qty numeric NOT NULL DEFAULT 0,
  uom text DEFAULT 'pcs',
  vehicle_number text,
  challan_number text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View dispatch_records" ON public.dispatch_records FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage dispatch_records" ON public.dispatch_records FOR ALL TO authenticated USING (company_id = get_user_company_id());

CREATE TRIGGER update_dispatch_records_updated_at BEFORE UPDATE ON public.dispatch_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Stock jobs (stock-based production)
CREATE TABLE public.stock_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  job_number text NOT NULL,
  product_name text NOT NULL,
  module text NOT NULL DEFAULT 'printing', -- printing, stitching, both
  target_qty numeric NOT NULL DEFAULT 0,
  produced_qty numeric NOT NULL DEFAULT 0,
  uom text DEFAULT 'meters',
  status text NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, cancelled
  start_date date,
  end_date date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View stock_jobs" ON public.stock_jobs FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage stock_jobs" ON public.stock_jobs FOR ALL TO authenticated USING (company_id = get_user_company_id());

CREATE TRIGGER update_stock_jobs_updated_at BEFORE UPDATE ON public.stock_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add stock_job_id FK on stock_transactions
ALTER TABLE public.stock_transactions ADD CONSTRAINT stock_transactions_stock_job_id_fkey FOREIGN KEY (stock_job_id) REFERENCES public.stock_jobs(id);

-- Add grn_id FK on stock_transactions
ALTER TABLE public.stock_transactions ADD CONSTRAINT stock_transactions_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.grn_headers(id);