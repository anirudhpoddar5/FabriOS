-- ============================================================
-- Migration: material auto-consumption
-- Applied: 2026-07-10
-- Purpose:
--   1. Record per-entry BOM material consumption.
--   2. Save production output and stock consumption atomically.
--   3. Allow quantity corrections through later adjustment rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.production_material_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  production_entry_id UUID NOT NULL REFERENCES public.production_entries(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.order_headers(id) ON DELETE CASCADE,
  bom_line_id UUID NOT NULL REFERENCES public.bom_lines(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  planned_qty NUMERIC NOT NULL DEFAULT 0,
  actual_qty NUMERIC NOT NULL DEFAULT 0,
  uom TEXT,
  is_overridden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT production_material_consumptions_entry_line_key
    UNIQUE (production_entry_id, bom_line_id)
);

CREATE INDEX IF NOT EXISTS idx_pmc_company ON public.production_material_consumptions(company_id);
CREATE INDEX IF NOT EXISTS idx_pmc_order ON public.production_material_consumptions(order_id);
CREATE INDEX IF NOT EXISTS idx_pmc_entry ON public.production_material_consumptions(production_entry_id);
CREATE INDEX IF NOT EXISTS idx_pmc_bom_line ON public.production_material_consumptions(bom_line_id);
CREATE INDEX IF NOT EXISTS idx_pmc_item ON public.production_material_consumptions(item_id);

ALTER TABLE public.production_material_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View production_material_consumptions"
  ON public.production_material_consumptions
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Manage production_material_consumptions"
  ON public.production_material_consumptions
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE OR REPLACE FUNCTION public.save_production_entry_with_consumption(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_company_id UUID;
  v_entry public.production_entries%ROWTYPE;
  v_bom_id UUID;
  v_line RECORD;
  v_planned_qty NUMERIC;
  v_consumption_count INTEGER := 0;
BEGIN
  v_company_id := public.get_user_company_id();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company selected';
  END IF;

  INSERT INTO public.production_entries (
    id,
    company_id,
    date,
    module,
    order_id,
    order_row_id,
    colourway_id,
    factory_id,
    shift_id,
    resource_id,
    worker_type_id,
    persons_used,
    output_qty,
    output_uom,
    rate_master_id,
    rate_basis,
    rate_value,
    cost_amount,
    notes
  )
  VALUES (
    COALESCE((payload->>'id')::UUID, gen_random_uuid()),
    v_company_id,
    (payload->>'date')::DATE,
    payload->>'module',
    NULLIF(payload->>'order_id', '')::UUID,
    NULLIF(payload->>'order_row_id', '')::UUID,
    NULLIF(payload->>'colourway_id', '')::UUID,
    NULLIF(payload->>'factory_id', '')::UUID,
    NULLIF(payload->>'shift_id', '')::UUID,
    NULLIF(payload->>'resource_id', '')::UUID,
    NULLIF(payload->>'worker_type_id', '')::UUID,
    COALESCE((payload->>'persons_used')::INTEGER, 0),
    COALESCE((payload->>'output_qty')::NUMERIC, 0),
    NULLIF(payload->>'output_uom', ''),
    NULLIF(payload->>'rate_master_id', '')::UUID,
    NULLIF(payload->>'rate_basis', ''),
    COALESCE((payload->>'rate_value')::NUMERIC, 0),
    COALESCE((payload->>'cost_amount')::NUMERIC, 0),
    NULLIF(payload->>'notes', '')
  )
  RETURNING * INTO v_entry;

  SELECT bh.id
    INTO v_bom_id
  FROM public.bom_headers bh
  WHERE bh.company_id = v_company_id
    AND bh.order_id = v_entry.order_id
    AND bh.bom_type = 'order'
    AND COALESCE(bh.status, 'draft') <> 'cancelled'
  ORDER BY bh.updated_at DESC NULLS LAST, bh.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_bom_id IS NULL THEN
    RETURN jsonb_build_object(
      'production_entry_id', v_entry.id,
      'consumption_status', 'not_available',
      'consumption_count', 0
    );
  END IF;

  FOR v_line IN
    SELECT bl.*
    FROM public.bom_lines bl
    WHERE bl.bom_id = v_bom_id
      AND bl.item_id IS NOT NULL
      AND COALESCE(bl.avg_consumption, 0) > 0
    ORDER BY bl.sort_order NULLS LAST, bl.created_at
  LOOP
    v_planned_qty := COALESCE(v_line.avg_consumption, 0) * COALESCE(v_entry.output_qty, 0);

    IF v_planned_qty > 0 THEN
      INSERT INTO public.production_material_consumptions (
        company_id,
        production_entry_id,
        order_id,
        bom_line_id,
        item_id,
        planned_qty,
        actual_qty,
        uom,
        is_overridden
      )
      VALUES (
        v_company_id,
        v_entry.id,
        v_entry.order_id,
        v_line.id,
        v_line.item_id,
        v_planned_qty,
        v_planned_qty,
        v_line.uom,
        false
      )
      ON CONFLICT (production_entry_id, bom_line_id) DO NOTHING;

      IF FOUND THEN
        INSERT INTO public.stock_transactions (
          company_id,
          item_id,
          txn_type,
          txn_date,
          qty,
          uom,
          order_id,
          remarks
        )
        VALUES (
          v_company_id,
          v_line.item_id,
          'consumption',
          v_entry.date,
          v_planned_qty,
          v_line.uom,
          v_entry.order_id,
          'Auto-consumed from production entry ' || v_entry.id::TEXT
        );

        v_consumption_count := v_consumption_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'production_entry_id', v_entry.id,
    'consumption_status', CASE WHEN v_consumption_count > 0 THEN 'consumed' ELSE 'not_available' END,
    'consumption_count', v_consumption_count
  );
END;
$$;
