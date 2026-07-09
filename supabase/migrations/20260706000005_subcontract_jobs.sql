CREATE TABLE public.subcontract_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  job_number TEXT NOT NULL,
  order_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL,
  subcontractor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  process TEXT NOT NULL CHECK (process IN ('printing', 'stitching', 'both')),
  product_description TEXT,
  qty_sent NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_received NUMERIC(10,2) NOT NULL DEFAULT 0,
  qty_balance NUMERIC(10,2) GENERATED ALWAYS AS (qty_sent - qty_received) STORED,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) GENERATED ALWAYS AS (qty_sent * rate) STORED,
  send_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  received_date DATE,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partial', 'received', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_subcontract_company_job ON public.subcontract_jobs(company_id, job_number);

ALTER TABLE public.subcontract_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY subcontract_jobs_company_policy ON public.subcontract_jobs
  USING (company_id = (SELECT get_user_company_id()));
