-- ============================================================
-- Migration: material_issues table
-- Applied: 2026-07-06
-- Purpose:
--   1. Create material_issues table for tracking material
--      issuance and consumption per order
--   2. Computed qty_wasted = qty_issued - qty_consumed
--   3. Used by Feature 4 — Material Consumption Tracking
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create material_issues table
-- ------------------------------------------------------------
CREATE TABLE public.material_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL,
  row_id UUID REFERENCES public.order_rows(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  uom TEXT NOT NULL DEFAULT 'meters',
  qty_issued NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_consumed NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_wasted NUMERIC(10,2) GENERATED ALWAYS AS (qty_issued - qty_consumed) STORED,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_material_issues_order    ON public.material_issues(order_id);
CREATE INDEX idx_material_issues_company  ON public.material_issues(company_id);
CREATE INDEX idx_material_issues_date     ON public.material_issues(date);

-- ------------------------------------------------------------
-- 2. Row-Level Security
-- ------------------------------------------------------------
ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_issues_company_policy ON public.material_issues
  USING (company_id = (SELECT get_user_company_id()));
