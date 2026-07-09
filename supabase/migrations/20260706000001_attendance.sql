-- ============================================================
-- Migration: attendance table
-- Applied: 2026-07-06
-- Purpose:
--   1. Create attendance table for daily worker attendance
--   2. Unique constraint per worker per date
--   3. Used by Feature 2b — Attendance Entry
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create attendance table
-- ------------------------------------------------------------
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  check_in TIME,
  check_out TIME,
  hours_worked NUMERIC(5,2),
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'leave')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One attendance record per worker per day
CREATE UNIQUE INDEX idx_attendance_worker_date ON public.attendance(company_id, worker_id, date);

-- Performance indexes
CREATE INDEX idx_attendance_company_date ON public.attendance(company_id, date);
CREATE INDEX idx_attendance_worker       ON public.attendance(worker_id);
CREATE INDEX idx_attendance_date         ON public.attendance(date);

-- ------------------------------------------------------------
-- 2. Row-Level Security
-- ------------------------------------------------------------
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_company_policy ON public.attendance
  USING (company_id = (SELECT get_user_company_id()));
