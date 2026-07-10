-- ============================================================
-- Migration: transactional order save
-- Applied: 2026-07-10
-- Purpose:
--   Save order header, product rows, and colourways atomically.
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_order_with_rows_and_colourways(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_company_id uuid;
  v_order_id uuid;
  v_saved_order_id uuid;
  v_module text;
  v_header jsonb;
  v_rows jsonb;
  v_row jsonb;
  v_colour jsonb;
  v_row_id uuid;
  v_row_index integer := 0;
  v_colour_index integer;
BEGIN
  v_company_id := public.get_user_company_id();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company selected';
  END IF;

  v_header := COALESCE(payload->'header', '{}'::jsonb);
  v_rows := COALESCE(payload->'rows', '[]'::jsonb);
  v_module := COALESCE(NULLIF(payload->>'module', ''), NULLIF(v_header->>'module', ''));

  IF v_module NOT IN ('printing', 'stitching') THEN
    RAISE EXCEPTION 'Invalid order module: %', COALESCE(v_module, '<null>');
  END IF;

  IF jsonb_typeof(v_rows) <> 'array' THEN
    RAISE EXCEPTION 'Order rows must be an array';
  END IF;

  v_order_id := COALESCE(
    NULLIF(payload->>'id', '')::uuid,
    NULLIF(v_header->>'id', '')::uuid,
    gen_random_uuid()
  );

  UPDATE public.order_headers
  SET
    buyer_id = NULLIF(v_header->>'buyer_id', '')::uuid,
    buyer_po = NULLIF(v_header->>'buyer_po', ''),
    style = NULLIF(v_header->>'style', ''),
    currency = COALESCE(NULLIF(v_header->>'currency', ''), 'USD'),
    target_end_date = NULLIF(v_header->>'target_end_date', ''),
    buyer_delivery_date = NULLIF(v_header->>'buyer_delivery_date', ''),
    status = COALESCE(NULLIF(v_header->>'status', ''), 'Started'),
    remarks = NULLIF(v_header->>'remarks', ''),
    updated_at = now()
  WHERE id = v_order_id
    AND company_id = v_company_id
    AND module = v_module
  RETURNING id INTO v_saved_order_id;

  IF v_saved_order_id IS NULL THEN
    INSERT INTO public.order_headers (
      id,
      company_id,
      module,
      internal_po,
      buyer_id,
      buyer_po,
      style,
      currency,
      target_end_date,
      buyer_delivery_date,
      status,
      remarks
    )
    VALUES (
      v_order_id,
      v_company_id,
      v_module,
      NULLIF(v_header->>'internal_po', ''),
      NULLIF(v_header->>'buyer_id', '')::uuid,
      NULLIF(v_header->>'buyer_po', ''),
      NULLIF(v_header->>'style', ''),
      COALESCE(NULLIF(v_header->>'currency', ''), 'USD'),
      NULLIF(v_header->>'target_end_date', ''),
      NULLIF(v_header->>'buyer_delivery_date', ''),
      COALESCE(NULLIF(v_header->>'status', ''), 'Started'),
      NULLIF(v_header->>'remarks', '')
    )
    RETURNING id INTO v_saved_order_id;
  END IF;

  DELETE FROM public.order_colourways
  WHERE order_row_id IN (
    SELECT id FROM public.order_rows WHERE order_id = v_order_id
  );

  DELETE FROM public.order_rows
  WHERE order_id = v_order_id;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_rows)
  LOOP
    v_row_id := COALESCE(NULLIF(v_row->>'id', '')::uuid, gen_random_uuid());

    INSERT INTO public.order_rows (
      id,
      order_id,
      product_id,
      fabric_id,
      fabric_width,
      uom,
      order_qty,
      chart_qty,
      rate_per_item,
      no_of_colours,
      sort_order
    )
    VALUES (
      v_row_id,
      v_order_id,
      NULLIF(v_row->>'product_id', '')::uuid,
      NULLIF(v_row->>'fabric_id', '')::uuid,
      NULLIF(v_row->>'fabric_width', ''),
      COALESCE(NULLIF(v_row->>'uom', ''), 'pcs'),
      COALESCE(NULLIF(v_row->>'order_qty', '')::numeric, 0),
      COALESCE(NULLIF(v_row->>'chart_qty', '')::numeric, 0),
      COALESCE(NULLIF(v_row->>'rate_per_item', '')::numeric, 0),
      COALESCE(NULLIF(v_row->>'no_of_colours', '')::integer, 0),
      COALESCE(NULLIF(v_row->>'sort_order', '')::integer, v_row_index)
    );

    v_colour_index := 0;
    FOR v_colour IN SELECT value FROM jsonb_array_elements(COALESCE(v_row->'colourways', '[]'::jsonb))
    LOOP
      IF NULLIF(v_colour->>'colour_name', '') IS NOT NULL THEN
        INSERT INTO public.order_colourways (
          id,
          order_row_id,
          colour_name,
          ordered_qty,
          uom,
          size,
          notes,
          sort_order
        )
        VALUES (
          COALESCE(NULLIF(v_colour->>'id', '')::uuid, gen_random_uuid()),
          v_row_id,
          v_colour->>'colour_name',
          COALESCE(NULLIF(v_colour->>'ordered_qty', '')::numeric, 0),
          COALESCE(NULLIF(v_colour->>'uom', ''), NULLIF(v_row->>'uom', '')),
          NULLIF(v_colour->>'size', ''),
          NULLIF(v_colour->>'notes', ''),
          COALESCE(NULLIF(v_colour->>'sort_order', '')::integer, v_colour_index)
        );
      END IF;

      v_colour_index := v_colour_index + 1;
    END LOOP;

    v_row_index := v_row_index + 1;
  END LOOP;

  RETURN v_order_id;
END;
$$;
