-- ============================================================
-- Migration: workers table
-- Applied: 2026-07-06
-- Purpose:
--   1. Create workers table for tracking individual employees
--   2. Each worker belongs to a company, factory, and worker type
--   3. Used by attendance tracking (Feature 2b)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create workers table
-- ------------------------------------------------------------
CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  factory_id UUID REFERENCES public.factories(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL,
  name TEXT NOT NULL,
  worker_type_id UUID REFERENCES public.worker_types(id) ON DELETE SET NULL,
  phone TEXT,
  hourly_rate NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique employee code within a company
CREATE UNIQUE INDEX idx_workers_company_employee_code ON public.workers(company_id, employee_code);

-- Performance indexes
CREATE INDEX idx_workers_company_id     ON public.workers(company_id);
CREATE INDEX idx_workers_factory_id     ON public.workers(factory_id);
CREATE INDEX idx_workers_worker_type_id  ON public.workers(worker_type_id);

-- ------------------------------------------------------------
-- 2. Row-Level Security
-- ------------------------------------------------------------
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- Note: requires get_user_company_id() helper which should already exist
CREATE POLICY workers_company_policy ON public.workers
  USING (company_id = (SELECT get_user_company_id()));
