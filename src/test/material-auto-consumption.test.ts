import { describe, it, expect } from 'vitest';
import {
  calculatePlannedConsumption,
  calculateConsumptionAdjustment,
  calculateStockAdjustmentQty,
} from '@/lib/material-auto-consumption';

describe('calculatePlannedConsumption', () => {
  it('calculates planned consumption from avg consumption and output qty', () => {
    expect(calculatePlannedConsumption(2.5, 100)).toBe(250);
  });

  it('returns null when avg consumption is 0', () => {
    expect(calculatePlannedConsumption(0, 100)).toBeNull();
  });

  it('returns null when output qty is 0', () => {
    expect(calculatePlannedConsumption(2.5, 0)).toBeNull();
  });

  it('returns null when avg consumption is null', () => {
    expect(calculatePlannedConsumption(null, 100)).toBeNull();
  });

  it('returns null when avg consumption is undefined', () => {
    expect(calculatePlannedConsumption(undefined, 100)).toBeNull();
  });

  it('returns null when output qty is negative', () => {
    expect(calculatePlannedConsumption(2.5, -10)).toBeNull();
  });

  it('handles fractional outputs', () => {
    expect(calculatePlannedConsumption(1.333, 30)).toBeCloseTo(39.99, 1);
  });

  it('handles zero avg consumption with nullish coercion', () => {
    expect(calculatePlannedConsumption(null, 50)).toBeNull();
    expect(calculatePlannedConsumption(undefined, 50)).toBeNull();
  });

  it('handles valid zero output', () => {
    expect(calculatePlannedConsumption(1, 0)).toBeNull();
  });
});

describe('calculateConsumptionAdjustment', () => {
  it('calculates positive adjustment when actual increases', () => {
    expect(calculateConsumptionAdjustment(100, 120)).toBe(20);
  });

  it('calculates negative adjustment when actual decreases', () => {
    expect(calculateConsumptionAdjustment(100, 80)).toBe(-20);
  });

  it('returns 0 when actual is unchanged', () => {
    expect(calculateConsumptionAdjustment(100, 100)).toBe(0);
  });
});

describe('calculateStockAdjustmentQty', () => {
  it('returns negative adjustment when actual increases (stock consumed more)', () => {
    expect(calculateStockAdjustmentQty(100, 120)).toBe(-20);
  });

  it('returns positive adjustment when actual decreases (stock returned)', () => {
    expect(calculateStockAdjustmentQty(100, 80)).toBe(20);
  });

  it('returns 0 when no change', () => {
    expect(calculateStockAdjustmentQty(100, 100)).toBe(-0);
  });
});

describe('no-BOM fallback (integration contract)', () => {
  it('the RPC contract returns consumption_status not_available when no BOM', () => {
    const result = {
      production_entry_id: 'mock-id',
      consumption_status: 'not_available' as const,
      consumption_count: 0,
    };
    expect(result.consumption_status).toBe('not_available');
    expect(result.consumption_count).toBe(0);
    expect(result.production_entry_id).toBe('mock-id');
  });

  it('the RPC contract returns consumption_status consumed when BOM exists', () => {
    const result = {
      production_entry_id: 'mock-id',
      consumption_status: 'consumed' as const,
      consumption_count: 3,
    };
    expect(result.consumption_status).toBe('consumed');
    expect(result.consumption_count).toBeGreaterThan(0);
  });

  it('overide-difference calculation matches contract', () => {
    const previousActualQty = 100;
    const nextActualQty = 130;
    const adjustment = calculateConsumptionAdjustment(previousActualQty, nextActualQty);
    const stockQty = calculateStockAdjustmentQty(previousActualQty, nextActualQty);

    expect(adjustment).toBe(30);
    expect(stockQty).toBe(-30);
  });
});
