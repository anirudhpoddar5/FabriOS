-- ============================================================
-- Migration: transactional PO save
-- Applied: 2026-07-10
-- Purpose:
--   Save PO header and all its lines atomically.
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_po_with_lines(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_company_id uuid;
  v_po_id uuid;
  v_saved_po_id uuid;
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

  IF jsonb_typeof(v_lines) <> 'array' THEN
    RAISE EXCEPTION 'PO lines must be an array';
  END IF;

  v_po_id := COALESCE(
    NULLIF(payload->>'id', '')::uuid,
    NULLIF(v_header->>'id', '')::uuid,
    gen_random_uuid()
  );

  UPDATE public.purchase_orders
  SET
    po_number = NULLIF(v_header->>'po_number', ''),
    vendor_id = NULLIF(v_header->>'vendor_id', '')::uuid,
    po_date = NULLIF(v_header->>'po_date', '')::date,
    status = COALESCE(NULLIF(v_header->>'status', ''), 'draft'),
    source_type = COALESCE(NULLIF(v_header->>'source_type', ''), 'manual'),
    currency = COALESCE(NULLIF(v_header->>'currency', ''), 'USD'),
    total_amount = COALESCE(NULLIF(v_header->>'total_amount', '')::numeric, 0),
    order_id = NULLIF(v_header->>'order_id', '')::uuid,
    remarks = NULLIF(v_header->>'remarks', ''),
    updated_at = now()
  WHERE id = v_po_id
    AND company_id = v_company_id
  RETURNING id INTO v_saved_po_id;

  IF v_saved_po_id IS NULL THEN
    INSERT INTO public.purchase_orders (
      id,
      company_id,
      po_number,
      vendor_id,
      po_date,
      status,
      source_type,
      currency,
      total_amount,
      order_id,
      remarks
    )
    VALUES (
      v_po_id,
      v_company_id,
      NULLIF(v_header->>'po_number', ''),
      NULLIF(v_header->>'vendor_id', '')::uuid,
      NULLIF(v_header->>'po_date', '')::date,
      COALESCE(NULLIF(v_header->>'status', ''), 'draft'),
      COALESCE(NULLIF(v_header->>'source_type', ''), 'manual'),
      COALESCE(NULLIF(v_header->>'currency', ''), 'USD'),
      COALESCE(NULLIF(v_header->>'total_amount', '')::numeric, 0),
      NULLIF(v_header->>'order_id', '')::uuid,
      NULLIF(v_header->>'remarks', '')
    )
    RETURNING id INTO v_saved_po_id;
  END IF;

  DELETE FROM public.purchase_order_lines
  WHERE po_id = v_po_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
  LOOP
    v_line_id := COALESCE(NULLIF(v_line->>'id', '')::uuid, gen_random_uuid());

    INSERT INTO public.purchase_order_lines (
      id,
      po_id,
      item_name,
      item_id,
      uom,
      qty_ordered,
      rate,
      amount,
      sort_order,
      remarks
    )
    VALUES (
      v_line_id,
      v_po_id,
      NULLIF(v_line->>'item_name', ''),
      NULLIF(v_line->>'item_id', '')::uuid,
      COALESCE(NULLIF(v_line->>'uom', ''), 'meters'),
      COALESCE(NULLIF(v_line->>'qty_ordered', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'rate', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'amount', '')::numeric, 0),
      COALESCE(NULLIF(v_line->>'sort_order', '')::integer, v_line_index),
      NULLIF(v_line->>'remarks', '')
    );

    v_line_index := v_line_index + 1;
  END LOOP;

  RETURN v_po_id;
END;
$$;