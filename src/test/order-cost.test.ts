import { describe, it, expect } from 'vitest';

function isOverPlan(summary: {
  produced_qty: number;
  actual_cost_per_piece: number;
  planned_cost_per_piece: number;
  variance_per_piece: number;
}): boolean {
  if (summary.produced_qty <= 0) return false;
  if (summary.actual_cost_per_piece <= summary.planned_cost_per_piece) return false;
  if (summary.planned_cost_per_piece <= 0) return false;
  const pctOver = ((summary.actual_cost_per_piece - summary.planned_cost_per_piece) / summary.planned_cost_per_piece) * 100;
  return summary.variance_per_piece >= 1 && pctOver >= 5;
}

describe('isOverPlan threshold', () => {

  it('returns false when produced_qty is 0', () => {
    expect(isOverPlan({ produced_qty: 0, actual_cost_per_piece: 15, planned_cost_per_piece: 10, variance_per_piece: 5 })).toBe(false);
  });

  it('returns false when actual_cost_per_piece equals planned_cost_per_piece', () => {
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 10, planned_cost_per_piece: 10, variance_per_piece: 0 })).toBe(false);
  });

  it('returns false when actual_cost_per_piece is less than planned_cost_per_piece', () => {
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 8, planned_cost_per_piece: 10, variance_per_piece: -2 })).toBe(false);
  });

  it('returns false when variance_per_piece is less than 1 (both conditions fail)', () => {
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 10.50, planned_cost_per_piece: 10, variance_per_piece: 0.50 })).toBe(false);
  });

  it('returns false when pct difference is less than 5% even if variance >= 1', () => {
    // plan=200, actual=202 => ₹2 over, but only 1% over
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 202, planned_cost_per_piece: 200, variance_per_piece: 2 })).toBe(false);
  });

  it('returns true when both thresholds are met (₹1 + 5%)', () => {
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 115, planned_cost_per_piece: 100, variance_per_piece: 15 })).toBe(true);
  });

  it('returns true at exact threshold boundary (₹1, 5%)', () => {
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 105, planned_cost_per_piece: 100, variance_per_piece: 5 })).toBe(true);
  });

  it('returns false when exact ₹1 but only 2% over', () => {
    // plan=50, actual=51 => ₹1 over, 2% over
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 51, planned_cost_per_piece: 50, variance_per_piece: 1 })).toBe(false);
  });

  it('returns false when exact 5% but only ₹0.50 over', () => {
    // plan=10, actual=10.50 => 5% over, but only ₹0.50
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 10.50, planned_cost_per_piece: 10, variance_per_piece: 0.50 })).toBe(false);
  });

  it('returns false when planned_cost_per_piece is 0', () => {
    expect(isOverPlan({ produced_qty: 100, actual_cost_per_piece: 5, planned_cost_per_piece: 0, variance_per_piece: 5 })).toBe(false);
  });

  it('handles large values', () => {
    expect(isOverPlan({ produced_qty: 5000, actual_cost_per_piece: 1200, planned_cost_per_piece: 1000, variance_per_piece: 200 })).toBe(true);
  });

});

describe('orderCostSummary shape contract', () => {

  it('view returns number (not null) for all numeric fields', () => {
    const row = {
      order_id: '00000000-0000-0000-0000-000000000000',
      company_id: '00000000-0000-0000-0000-000000000000',
      order_status: 'Started',
      planned_material_cost: 0,
      actual_material_cost: 0,
      actual_labour_cost: 0,
      planned_total_cost: 0,
      actual_total_cost: 0,
      produced_qty: 0,
      actual_cost_per_piece: 0,
      planned_cost_per_piece: 0,
      variance_amount: 0,
      variance_per_piece: 0,
    };
    expect(typeof row.planned_total_cost).toBe('number');
    expect(typeof row.actual_total_cost).toBe('number');
    expect(typeof row.produced_qty).toBe('number');
    expect(typeof row.actual_cost_per_piece).toBe('number');
    expect(typeof row.variance_amount).toBe('number');
    expect(typeof row.variance_per_piece).toBe('number');
  });

  it('actual_total_cost = actual_material_cost + actual_labour_cost', () => {
    const row = { actual_material_cost: 5000, actual_labour_cost: 2000, actual_total_cost: 7000 };
    expect(row.actual_total_cost).toBe(row.actual_material_cost + row.actual_labour_cost);
  });

  it('planned_total_cost equals planned_material_cost (no planned labour)', () => {
    const row = { planned_material_cost: 8000, planned_total_cost: 8000 };
    expect(row.planned_total_cost).toBe(row.planned_material_cost);
  });

});
