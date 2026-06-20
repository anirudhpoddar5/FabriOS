-- ========== FABRIOS SCHEMA — PART 2: RLS POLICIES ==========
-- Run this AFTER schema_part1.sql

-- Profiles
CREATE POLICY "Users can view company profiles" ON public.profiles FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User roles
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can self-assign role during setup" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- Companies
CREATE POLICY "Company members can view" ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company_id() OR created_by = auth.uid());
CREATE POLICY "Users can create company" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can update company" ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid()));

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

-- Vendors
CREATE POLICY "View vendors" ON public.vendors FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage vendors" ON public.vendors FOR ALL TO authenticated USING (company_id = get_user_company_id());

-- Inventory Items
CREATE POLICY "View inventory_items" ON public.inventory_items FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage inventory_items" ON public.inventory_items FOR ALL TO authenticated USING (company_id = get_user_company_id());

-- Stock Transactions
CREATE POLICY "View stock_transactions" ON public.stock_transactions FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage stock_transactions" ON public.stock_transactions FOR ALL TO authenticated USING (company_id = get_user_company_id());

-- Purchase Orders
CREATE POLICY "View purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (company_id = get_user_company_id());

-- Purchase Order Lines
CREATE POLICY "View po_lines" ON public.purchase_order_lines FOR SELECT TO authenticated
  USING (po_id IN (SELECT id FROM purchase_orders WHERE company_id = get_user_company_id()));
CREATE POLICY "Manage po_lines" ON public.purchase_order_lines FOR ALL TO authenticated
  USING (po_id IN (SELECT id FROM purchase_orders WHERE company_id = get_user_company_id()));

-- GRN Headers
CREATE POLICY "View grn_headers" ON public.grn_headers FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage grn_headers" ON public.grn_headers FOR ALL TO authenticated USING (company_id = get_user_company_id());

-- GRN Lines
CREATE POLICY "View grn_lines" ON public.grn_lines FOR SELECT TO authenticated
  USING (grn_id IN (SELECT id FROM grn_headers WHERE company_id = get_user_company_id()));
CREATE POLICY "Manage grn_lines" ON public.grn_lines FOR ALL TO authenticated
  USING (grn_id IN (SELECT id FROM grn_headers WHERE company_id = get_user_company_id()));

-- Dispatch Records
CREATE POLICY "View dispatch_records" ON public.dispatch_records FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage dispatch_records" ON public.dispatch_records FOR ALL TO authenticated USING (company_id = get_user_company_id());

-- Stock Jobs
CREATE POLICY "View stock_jobs" ON public.stock_jobs FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Manage stock_jobs" ON public.stock_jobs FOR ALL TO authenticated USING (company_id = get_user_company_id());
