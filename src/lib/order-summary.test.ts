import { describe, it, expect } from 'vitest';
import { summariseOrderRows } from './order-summary';
import { friendlyOrderDeleteError } from './delete-errors';

const getProduct = (id: string) => ({ p1: 'Amaltas Tee', p2: 'Gulzar Kurta' }[id] || '');
const getFabric = (id: string) => ({ f1: 'Cotton 120', f2: 'Rayon' }[id] || '');

describe('summariseOrderRows', () => {
  it('rolls a multi-row order up into one line: names joined, qty and value summed', () => {
    const s = summariseOrderRows([
      { orderId: 'o1', productId: 'p1', fabricId: 'f1', uom: 'meters', orderQty: 100, ratePerItem: 12.5 },
      { orderId: 'o1', productId: 'p2', fabricId: 'f2', uom: 'meters', orderQty: 50, ratePerItem: 10 },
      { orderId: 'o2', productId: 'p1', fabricId: 'f1', uom: 'pcs', orderQty: 7, ratePerItem: 3 },
    ], { getProduct, getFabric }).get('o1')!;

    expect(s.product).toBe('Amaltas Tee, Gulzar Kurta');
    expect(s.fabric).toBe('Cotton 120, Rayon');
    expect(s.qty).toBe(150);
    expect(s.uom).toBe('meters');
    expect(s.value).toBe(1750); // 100*12.5 + 50*10
  });

  it('dedupes repeated product/fabric names rather than listing them twice', () => {
    const s = summariseOrderRows([
      { orderId: 'o1', productId: 'p1', fabricId: 'f1', uom: 'meters', orderQty: 10, ratePerItem: 1 },
      { orderId: 'o1', productId: 'p1', fabricId: 'f1', uom: 'meters', orderQty: 10, ratePerItem: 1 },
    ], { getProduct, getFabric }).get('o1')!;
    expect(s.product).toBe('Amaltas Tee');
    expect(s.qty).toBe(20);
  });

  it('blanks the unit when an order mixes units, so no false "150 meters" is shown', () => {
    const s = summariseOrderRows([
      { orderId: 'o1', uom: 'meters', orderQty: 100 },
      { orderId: 'o1', uom: 'pcs', orderQty: 50 },
    ]).get('o1')!;
    expect(s.uom).toBe('');
    expect(s.qty).toBe(150);
  });

  it('survives missing and junk fields instead of producing NaN', () => {
    const s = summariseOrderRows([
      { orderId: 'o1', orderQty: null, ratePerItem: undefined },
      { orderId: 'o1', orderQty: '5', ratePerItem: '2' },
      { orderId: null, orderQty: 999 },
    ]).get('o1')!;
    expect(s.qty).toBe(5);
    expect(s.value).toBe(10);
    expect(s.product).toBe('');
  });

  it('has no entry for an order with no rows, so callers fall back to blank not NaN', () => {
    expect(summariseOrderRows([]).get('o1')).toBeUndefined();
  });
});

describe('friendlyOrderDeleteError', () => {
  it('turns the production-entry FK violation into an instruction', () => {
    const raw = 'update or delete on table "order_colourways" violates foreign key constraint "production_entries_colourway_id_fkey" on table "production_entries"';
    const msg = friendlyOrderDeleteError(raw, 'PO-P-0001');
    expect(msg).toContain('PO-P-0001');
    expect(msg).toContain('production entries');
    expect(msg).toContain('Cancelled');
    expect(msg).not.toContain('foreign key');
  });

  it('names dispatch records when that is what blocks the delete', () => {
    const raw = 'violates foreign key constraint "dispatch_records_order_id_fkey" on table "dispatch_records"';
    expect(friendlyOrderDeleteError(raw, 'PO-P-0002')).toContain('dispatch records');
  });

  it('falls through to the raw message for errors it does not recognise', () => {
    expect(friendlyOrderDeleteError('connection reset', 'PO-P-0003')).toBe('PO-P-0003 could not be deleted: connection reset');
  });
});
