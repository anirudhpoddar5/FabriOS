-- ============================================================
-- Migration: constraints and indexes
-- Applied: 2026-04-21
-- Purpose:
--   1. UNIQUE constraint on stock_jobs(company_id, job_number)
--   2. CHECK constraints for non-negative quantities
--   3. Performance indexes on foreign keys and frequent filter columns
-- ============================================================

-- ------------------------------------------------------------
-- 1. UNIQUE: stock job numbers must be unique within a company
-- ------------------------------------------------------------
ALTER TABLE stock_jobs
  ADD CONSTRAINT stock_jobs_company_job_number_key
  UNIQUE (company_id, job_number);

-- ------------------------------------------------------------
-- 2. CHECK constraints — quantities must be non-negative
-- ------------------------------------------------------------
ALTER TABLE stock_jobs
  ADD CONSTRAINT stock_jobs_target_qty_nonneg  CHECK (target_qty  >= 0),
  ADD CONSTRAINT stock_jobs_produced_qty_nonneg CHECK (produced_qty >= 0);

ALTER TABLE order_rows
  ADD CONSTRAINT order_rows_order_qty_nonneg  CHECK (order_qty  >= 0),
  ADD CONSTRAINT order_rows_chart_qty_nonneg  CHECK (chart_qty  >= 0);

ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_opening_stock_nonneg CHECK (opening_stock >= 0),
  ADD CONSTRAINT inventory_items_reorder_level_nonneg CHECK (reorder_level  >= 0);

ALTER TABLE purchase_order_lines
  ADD CONSTRAINT pol_qty_ordered_nonneg  CHECK (qty_ordered  >= 0),
  ADD CONSTRAINT pol_qty_received_nonneg CHECK (qty_received >= 0);

ALTER TABLE grn_lines
  ADD CONSTRAINT grn_lines_qty_received_nonneg CHECK (qty_received >= 0);

ALTER TABLE dispatch_records
  ADD CONSTRAINT dispatch_records_qty_pos CHECK (qty > 0);

-- ------------------------------------------------------------
-- 3. Indexes — company_id on all major tables (RLS + filters)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_factories_company          ON factories          (company_id);
CREATE INDEX IF NOT EXISTS idx_buyers_company             ON buyers             (company_id);
CREATE INDEX IF NOT EXISTS idx_fabrics_company            ON fabrics            (company_id);
CREATE INDEX IF NOT EXISTS idx_printing_products_company  ON printing_products  (company_id);
CREATE INDEX IF NOT EXISTS idx_stitching_products_company ON stitching_products (company_id);
CREATE INDEX IF NOT EXISTS idx_worker_types_company       ON worker_types       (company_id);
CREATE INDEX IF NOT EXISTS idx_rate_masters_company       ON rate_masters       (company_id);
CREATE INDEX IF NOT EXISTS idx_order_headers_company      ON order_headers      (company_id);
CREATE INDEX IF NOT EXISTS idx_production_entries_company ON production_entries (company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company            ON vendors            (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_company    ON inventory_items    (company_id);
CREATE INDEX IF NOT EXISTS idx_stock_jobs_company         ON stock_jobs         (company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company    ON purchase_orders    (company_id);
CREATE INDEX IF NOT EXISTS idx_grn_headers_company        ON grn_headers        (company_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_company   ON dispatch_records   (company_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_company        ON bom_headers        (company_id);

-- Foreign key indexes (speeds up JOINs and ON DELETE checks)
CREATE INDEX IF NOT EXISTS idx_order_rows_order_id          ON order_rows          (order_id);
CREATE INDEX IF NOT EXISTS idx_order_colourways_order_row   ON order_colourways    (order_row_id);
CREATE INDEX IF NOT EXISTS idx_production_entries_order     ON production_entries  (order_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_item      ON stock_transactions  (item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_grn       ON stock_transactions  (grn_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_order     ON stock_transactions  (order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_po      ON purchase_order_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_grn_lines_grn_id             ON grn_lines           (grn_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_order       ON dispatch_records    (order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_buyer       ON dispatch_records    (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bom_lines_bom_id             ON bom_lines           (bom_id);

-- Frequent filter columns
CREATE INDEX IF NOT EXISTS idx_order_headers_module         ON order_headers      (module);
CREATE INDEX IF NOT EXISTS idx_order_headers_status         ON order_headers      (status);
CREATE INDEX IF NOT EXISTS idx_stock_jobs_status            ON stock_jobs         (status);
CREATE INDEX IF NOT EXISTS idx_stock_jobs_module            ON stock_jobs         (module);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status       ON purchase_orders    (status);
CREATE INDEX IF NOT EXISTS idx_grn_headers_status           ON grn_headers        (status);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_txn_date  ON stock_transactions (txn_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_date        ON dispatch_records   (dispatch_date);
CREATE INDEX IF NOT EXISTS idx_production_entries_date      ON production_entries (date);
