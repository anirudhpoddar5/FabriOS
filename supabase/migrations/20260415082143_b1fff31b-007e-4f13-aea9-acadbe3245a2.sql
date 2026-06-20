
-- Ensure the function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Attach triggers (DROP IF EXISTS to be idempotent)
DO $$ 
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'bom_headers','bom_lines','buyers','companies','dispatch_records',
    'fabrics','factories','grn_headers','grn_lines','inventory_items',
    'onboarding_progress','order_colourways','order_headers','order_rows',
    'printing_products','printing_tables','production_entries','profiles',
    'purchase_order_lines','purchase_orders','rate_masters','shifts',
    'stitching_lines','stitching_products','stock_jobs','stock_transactions',
    'vendors','worker_types'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;
