-- Generic updated_at trigger backfill (idempotent). Function update_updated_at_column already exists.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'updated_at'
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = c.oid AND t.tgname = 'set_updated_at_' || c.relname
      )
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      r.tbl, r.tbl
    );
  END LOOP;
END $$;
