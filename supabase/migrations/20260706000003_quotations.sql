-- ============================================================
-- Migration: quotations + quotation_lines
-- Applied: 2026-07-06
-- Purpose:
--   1. Create quotations table for sales quoting
--   2. Create quotation_lines table for quote line items
--   3. Add quotation_id to order_headers for tracking conversion
--   4. Used by Feature 5 — Quotation Module
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create quotations table
-- ------------------------------------------------------------
CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  quotation_number TEXT NOT NULL,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal * COALESCE(tax_percent,0) / 100, 2)) STORED,
  total NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + ROUND(subtotal * COALESCE(tax_percent,0) / 100, 2)) STORED,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_quotations_company_number ON public.quotations(company_id, quotation_number);
CREATE INDEX idx_quotations_company_id ON public.quotations(company_id);
CREATE INDEX idx_quotations_buyer_id   ON public.quotations(buyer_id);
CREATE INDEX idx_quotations_date       ON public.quotations(date);

-- ------------------------------------------------------------
-- 2. Create quotation_lines table
-- ------------------------------------------------------------
CREATE TABLE public.quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
  product_id UUID,
  description TEXT NOT NULL,
  qty NUMERIC(10,2) NOT NULL DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'pcs',
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) GENERATED ALWAYS AS (qty * rate) STORED,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_quotation_lines_quote ON public.quotation_lines(quotation_id);

-- ------------------------------------------------------------
-- 3. Add quotation_id to order_headers
-- ------------------------------------------------------------
ALTER TABLE public.order_headers
  ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL;

CREATE INDEX idx_order_headers_quotation ON public.order_headers(quotation_id);

-- ------------------------------------------------------------
-- 4. Row-Level Security
-- ------------------------------------------------------------
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotations_company_policy ON public.quotations
  USING (company_id = (SELECT get_user_company_id()));

CREATE POLICY quotation_lines_company_policy ON public.quotation_lines
  USING (quotation_id IN (SELECT id FROM public.quotations WHERE company_id = (SELECT get_user_company_id())));
