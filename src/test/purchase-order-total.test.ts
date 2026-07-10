import { describe, expect, it } from 'vitest';
import { calculatePurchaseOrderTotal } from '@/lib/purchase-order-total';

describe('purchase order totals', () => {
  it('keeps a zero-value total as zero instead of turning it into null', () => {
    expect(calculatePurchaseOrderTotal([{ total_amount: 0 }])).toBe(0);
  });
});
