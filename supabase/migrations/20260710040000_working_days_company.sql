ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS working_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5,6}';

COMMENT ON COLUMN public.companies.working_days IS 'Days of the week considered working days (0=Sunday, 1=Monday, ..., 6=Saturday). Default Monday–Saturday.';
