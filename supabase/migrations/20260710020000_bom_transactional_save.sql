-- ============================================================
-- Migration: transactional BOM save
-- Applied: 2026-07-10
-- Purpose:
--   Save BOM header and all lines atomically.
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_bom_with_lines(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_company_id uuid;
  v_bom_id uuid;
  v_saved_bom_id uuid;
  v_bom_type text;
  v_header jsonb;
  v_lines jsonb;
  v_line jsonb;
  v_line_id uuid;
  v_line_index integer := 0;
BEGIN
  v_company_id := public.get_user_company_id();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company selected';
  END IF;

  v_header := COALESCE(payload->'header', '{}'::jsonb);
  v_lines := COALESCE(payload->'lines', '[]'::jsonb);
  v_bom_type := COALESCE(NULLIF(payload->>'bom_type', ''), NULLIF(v_header->>'bom_type', ''));

  IF v_bom_type NOT IN ('order', 'stock', 'manual') THEN
    RAISE EXCEPTION 'Invalid BOM type: %', COALESCE(v_bom_type, '<null>');
  END IF;

  IF jsonb_typeof(v_lines) <> 'array' THEN
    RAISE EXCEPTION 'BOM lines must be an array';
  END IF;

  v_bom_id := COALESCE(
    NULLIF(payload->>'id', '')::uuid,
    NULLIF(v_header->>'id', '')::uuid,
    gen_random_uuid()
  );

  UPDATE public.bom_headers
  SET
    title = NULLIF(v_header->>'title', ''),
    bom_type = v_bom_type,
    order_id = NULLIF(v_header->>'order_id', '')::uuid,
    remarks = NULLIF(v_header->>'remarks', ''),
    status = COALESCE(NULLIF(v_header->>'status', ''), 'draft'),
    updated_at = now()
  WHERE id = v_bom_id
    AND company_id = v_company_id
  RETURNING id INTO v_saved_bom_id;

  IF v_saved_bom_id IS NULL THEN
    INSERT INTO public.bom_headers (
      id,
      company_id,
      title,
      bom_type,
      order_id,
      remarks,
      status
    )
    VALUES (
      v_bom_id,
      v_company_id,
      NULLIF(v_header->>'title', ''),
      v_bom_type,
      NULLIF(v_header->>'order_id', '')::uuid,
      NULLIF(v_header->>'remarks', ''),
      COALESCE(NULLIF(v_header->>'status', ''), 'draft')
    )
    RETURNING id INTO v_saved_bom_id;
  END IF;

  DELETE FROM public.bom_lines
  WHERE bom_id = v_bom_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
  LOOP
    v_line_id := COALESCE(NULLIF(v_line->>'id', '')::uuid, gen_random_uuid());

    INSERT INTO public.bom_lines (
      id,
      bom_id,
      category,
      item_name,
      item_id,
      quantity,
      avg_consumption,
      extra_pct,
      rate,
      total_amount,
      uom,
      vendor_name,
      remarks,
      sort_order
    )
    VALUES (
      v_line_id,
      v_bom_id,
      COALESCE(NULLIF(v_line->>'category', ''), 'fabric'),
      NULLIF(v_line->>'item_name', ''),
      NULLIF(v_line->>'item_id', '')::uuid,
      COALESCE(NULLIF(v_line->>'quantity', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'avg_consumption', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'extra_pct', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'rate', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'total_amount', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'uom', ''), 'meters'),
      NULLIF(v_line->>'vendor_name', ''),
      NULLIF(v_line->>'remarks', ''),
      COALESCE(NULLIF(v_line->>'sort_order', '')::integer, v_line_index)
    );

    v_line_index := v_line_index + 1;
  END LOOP;

  RETURN v_bom_id;
END;
$$;