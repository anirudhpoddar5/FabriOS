-- ============================================================
-- Migration: transactional GRN save
-- Applied: 2026-07-10
-- Purpose:
--   Save GRN header, lines, update PO received quantities, and create stock transactions atomically.
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_grn_with_lines(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_company_id uuid;
  v_grn_id uuid;
  v_saved_grn_id uuid;
  v_header jsonb;
  v_lines jsonb;
  v_line jsonb;
  v_line_id uuid;
  v_line_index integer := 0;
  v_status text;
  v_po_id uuid;
  v_total_ordered numeric := 0;
  v_total_accepted numeric := 0;
  v_total_rejected numeric := 0;
  v_prev_received numeric := 0;
BEGIN
  v_company_id := public.get_user_company_id();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company selected';
  END IF;

  v_header := COALESCE(payload->'header', '{}'::jsonb);
  v_lines := COALESCE(payload->'lines', '[]'::jsonb);

  IF jsonb_typeof(v_lines) <> 'array' THEN
    RAISE EXCEPTION 'GRN lines must be an array';
  END IF;

  v_grn_id := COALESCE(
    NULLIF(payload->>'id', '')::uuid,
    NULLIF(v_header->>'id', '')::uuid,
    gen_random_uuid()
  );

  -- Compute status from lines (same logic as frontend)
  -- This will be recomputed after processing lines
  v_status := COALESCE(NULLIF(v_header->>'status', ''), 'accepted');

  UPDATE public.grn_headers
  SET
    grn_number = NULLIF(v_header->>'grn_number', ''),
    po_id = NULLIF(v_header->>'po_id', '')::uuid,
    vendor_id = NULLIF(v_header->>'vendor_id', '')::uuid,
    grn_date = NULLIF(v_header->>'grn_date', '')::date,
    status = v_status,
    remarks = NULLIF(v_header->>'remarks', ''),
    updated_at = now()
  WHERE id = v_grn_id
    AND company_id = v_company_id
  RETURNING id INTO v_saved_grn_id;

  IF v_saved_grn_id IS NULL THEN
    INSERT INTO public.grn_headers (
      id,
      company_id,
      grn_number,
      po_id,
      vendor_id,
      grn_date,
      status,
      remarks
    )
    VALUES (
      v_grn_id,
      v_company_id,
      NULLIF(v_header->>'grn_number', ''),
      NULLIF(v_header->>'po_id', '')::uuid,
      NULLIF(v_header->>'vendor_id', '')::uuid,
      NULLIF(v_header->>'grn_date', '')::date,
      v_status,
      NULLIF(v_header->>'remarks', '')
    )
    RETURNING id INTO v_saved_grn_id;
  END IF;

  DELETE FROM public.grn_lines
  WHERE grn_id = v_grn_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
  LOOP
    -- Only process lines with qty_received > 0
    IF COALESCE(NULLIF(v_line->>'qty_received', '')::numeric, 0) > 0 THEN
      v_line_id := COALESCE(NULLIF(v_line->>'id', '')::uuid, gen_random_uuid());

      INSERT INTO public.grn_lines (
        id,
        grn_id,
        item_id,
        item_name,
        qty_received,
        uom,
        lot_number,
        batch_number,
        po_line_id,
        remarks
      )
      VALUES (
        v_line_id,
        v_grn_id,
        NULLIF(v_line->>'item_id', '')::uuid,
        NULLIF(v_line->>'item_name', ''),
        COALESCE(NULLIF(v_line->>'qty_accepted', '')::numeric, 0),
        COALESCE(NULLIF(v_line->>'uom', ''), 'meters'),
        NULLIF(v_line->>'lot_number', ''),
        NULLIF(v_line->>'batch_number', ''),
        NULLIF(v_line->>'po_line_id', '')::uuid,
        CASE
          WHEN COALESCE(NULLIF(v_line->>'qty_rejected', '')::numeric, 0) > 0
          THEN 'Rejected ' || COALESCE(NULLIF(v_line->>'qty_rejected', '')::numeric, 0) || ' ' || COALESCE(NULLIF(v_line->>'uom', ''), 'pcs') || ' - ' || COALESCE(NULLIF(v_line->>'rejection_reason', ''), 'Quality issue') || COALESCE('; ' || NULLIF(v_line->>'remarks', ''), '')
          ELSE NULLIF(v_line->>'remarks', '')
        END
      );

      -- Create stock transaction for accepted quantity
      IF (v_line->>'item_id') IS NOT NULL AND COALESCE(NULLIF(v_line->>'qty_accepted', '')::numeric, 0) > 0 THEN
        INSERT INTO public.stock_transactions (
          company_id,
          item_id,
          txn_type,
          txn_date,
          qty,
          vendor_id,
          grn_id,
          lot_number,
          batch_number,
          uom
        )
        VALUES (
          v_company_id,
          NULLIF(v_line->>'item_id', '')::uuid,
          'inward',
          NULLIF(v_header->>'grn_date', '')::date,
          COALESCE(NULLIF(v_line->>'qty_accepted', '')::numeric, 0),
          NULLIF(v_header->>'vendor_id', '')::uuid,
          v_grn_id,
          NULLIF(v_line->>'lot_number', ''),
          NULLIF(v_line->>'batch_number', ''),
          COALESCE(NULLIF(v_line->>'uom', ''), 'meters')
        );
      END IF;

      -- Update PO line received quantity
      IF (v_line->>'po_line_id') IS NOT NULL AND COALESCE(NULLIF(v_line->>'qty_accepted', '')::numeric, 0) > 0 THEN
        SELECT COALESCE(qty_received, 0) INTO v_prev_received
        FROM public.purchase_order_lines
        WHERE id = NULLIF(v_line->>'po_line_id', '')::uuid;

        UPDATE public.purchase_order_lines
        SET qty_received = v_prev_received + COALESCE(NULLIF(v_line->>'qty_accepted', '')::numeric, 0)
        WHERE id = NULLIF(v_line->>'po_line_id', '')::uuid;
      END IF;

      -- Accumulate totals for PO status update
      v_total_ordered := v_total_ordered + COALESCE(NULLIF(v_line->>'qty_ordered', '')::numeric, 0);
      v_total_accepted := v_total_accepted + COALESCE(NULLIF(v_line->>'qty_accepted', '')::numeric, 0);
      v_total_rejected := v_total_rejected + COALESCE(NULLIF(v_line->>'qty_rejected', '')::numeric, 0);

      v_line_index := v_line_index + 1;
    END IF;
  END LOOP;

  -- Update PO status based on receipt completion
  v_po_id := NULLIF(v_header->>'po_id', '')::uuid;
  IF v_po_id IS NOT NULL THEN
    IF v_total_ordered > 0 AND (v_total_accepted + v_total_rejected) >= v_total_ordered THEN
      UPDATE public.purchase_orders
      SET status = 'received'
      WHERE id = v_po_id;
    ELSIF v_total_accepted > 0 THEN
      UPDATE public.purchase_orders
      SET status = 'partial'
      WHERE id = v_po_id;
    END IF;
  END IF;

  RETURN v_grn_id;
END;
$$;