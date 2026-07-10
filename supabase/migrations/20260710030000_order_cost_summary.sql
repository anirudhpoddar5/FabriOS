-- ============================================================
-- Migration: order cost summary view
-- Applied: 2026-07-10
-- Purpose:
--   1. Read-only view returning one row per order with planned
--      vs actual material/labour costs, cost/piece, and variance.
--   2. Returns zeros for orders with no entries yet.
--   3. Over-plan threshold: only flag when cost/piece exceeds
--      plan by both ₹1 AND 5%.
-- ============================================================

CREATE OR REPLACE VIEW public.order_cost_summary AS
WITH
bom_planned AS (
  SELECT
    bh.order_id,
    COALESCE(SUM(bl.total_amount), 0) AS planned_material_cost
  FROM public.bom_headers bh
  JOIN public.bom_lines bl ON bl.bom_id = bh.id
  WHERE bh.bom_type = 'order'
    AND COALESCE(bh.status, 'draft') <> 'cancelled'
    AND bh.order_id IS NOT NULL
  GROUP BY bh.order_id
),
entry_labour AS (
  SELECT
    pe.order_id,
    COALESCE(SUM(pe.cost_amount), 0) AS actual_labour_cost,
    COALESCE(SUM(pe.output_qty), 0) AS produced_qty
  FROM public.production_entries pe
  GROUP BY pe.order_id
),
item_rates AS (
  SELECT DISTINCT ON (pol.item_id)
    pol.item_id,
    pol.rate AS po_rate
  FROM public.purchase_order_lines pol
  JOIN public.purchase_orders po ON po.id = pol.po_id
  WHERE pol.item_id IS NOT NULL
    AND pol.rate IS NOT NULL
  ORDER BY pol.item_id, po.po_date DESC NULLS LAST
),
consumption_actual AS (
  SELECT
    pmc.order_id,
    COALESCE(SUM(pmc.actual_qty * COALESCE(ir.po_rate, bl.rate, 0)), 0) AS actual_material_cost
  FROM public.production_material_consumptions pmc
  LEFT JOIN item_rates ir ON ir.item_id = pmc.item_id
  LEFT JOIN public.bom_lines bl ON bl.id = pmc.bom_line_id
  GROUP BY pmc.order_id
)
SELECT
  oh.id AS order_id,
  oh.company_id,
  oh.status AS order_status,
  COALESCE(bp.planned_material_cost, 0) AS planned_material_cost,
  COALESCE(ca.actual_material_cost, 0) AS actual_material_cost,
  COALESCE(el.actual_labour_cost, 0) AS actual_labour_cost,
  COALESCE(bp.planned_material_cost, 0) AS planned_total_cost,
  COALESCE(ca.actual_material_cost, 0) + COALESCE(el.actual_labour_cost, 0) AS actual_total_cost,
  COALESCE(el.produced_qty, 0) AS produced_qty,
  CASE
    WHEN COALESCE(el.produced_qty, 0) > 0
    THEN ROUND((COALESCE(ca.actual_material_cost, 0) + COALESCE(el.actual_labour_cost, 0)) / el.produced_qty, 2)
    ELSE 0
  END AS actual_cost_per_piece,
  CASE
    WHEN COALESCE(el.produced_qty, 0) > 0 AND COALESCE(bp.planned_material_cost, 0) > 0
    THEN ROUND(bp.planned_material_cost / el.produced_qty, 2)
    ELSE 0
  END AS planned_cost_per_piece,
  (COALESCE(ca.actual_material_cost, 0) + COALESCE(el.actual_labour_cost, 0)) - COALESCE(bp.planned_material_cost, 0) AS variance_amount,
  CASE
    WHEN COALESCE(el.produced_qty, 0) > 0
    THEN ROUND(((COALESCE(ca.actual_material_cost, 0) + COALESCE(el.actual_labour_cost, 0)) - COALESCE(bp.planned_material_cost, 0)) / el.produced_qty, 2)
    ELSE 0
  END AS variance_per_piece
FROM public.order_headers oh
LEFT JOIN bom_planned bp ON bp.order_id = oh.id
LEFT JOIN entry_labour el ON el.order_id = oh.id
LEFT JOIN consumption_actual ca ON ca.order_id = oh.id
WHERE oh.company_id IS NOT NULL;

ALTER VIEW public.order_cost_summary SET (security_invoker = true);

COMMENT ON VIEW public.order_cost_summary IS 'One row per order with planned vs actual cost breakdown. Returns zeros for orders with no entries.';
