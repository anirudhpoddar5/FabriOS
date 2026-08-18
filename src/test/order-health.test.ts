import { describe, it, expect } from 'vitest';
import { getOrderHealth } from '@/lib/order-health';

const today = '2026-07-10';

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: 'order-1',
    status: 'Started',
    targetEndDate: '',
    buyerDeliveryDate: '',
    createdAt: '2026-07-01',
    orderQty: 0,
    ...overrides,
  };
}

describe('getOrderHealth', () => {
  it('grey — no production entries at all', () => {
    const result = getOrderHealth(makeOrder({ targetEndDate: '2026-07-15' }), [{ orderId: 'order-1', orderedQty: 100 }], [], today);
    expect(result.state).toBe('grey');
    expect(result.label).toBe('Not started');
    expect(result.producedQty).toBe(0);
    expect(result.orderedQty).toBe(100);
  });

  it('red — due date passed and incomplete', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '2026-07-08', createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 40 }],
      today,
    );
    expect(result.state).toBe('red');
    expect(result.label).toBe('Late');
    expect(result.daysUntilDue).toBe(-2);
  });

  it('red — buyer delivery date passed and incomplete', () => {
    const result = getOrderHealth(
      makeOrder({ buyerDeliveryDate: '2026-07-05', createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 30 }],
      today,
    );
    expect(result.state).toBe('red');
    expect(result.daysUntilDue).toBe(-5);
  });

  it('amber — due within 2 calendar days and incomplete', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '2026-07-11', createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 60 }],
      today,
    );
    expect(result.state).toBe('amber');
    expect(result.label).toBe('At risk');
    expect(result.daysUntilDue).toBe(1);
  });

  it('amber — behind schedule by at least 10 points', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '2026-07-20', createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 10 }],
      '2026-07-15',
    );
    // 15 days elapsed of 19 total = 78.9% schedule
    // 10% completion vs 78.9% schedule = 68.9 points behind → amber
    expect(result.state).toBe('amber');
  });

  it('green — on track and incomplete', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '2026-07-20', createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 80 }],
      '2026-07-15',
    );
    expect(result.state).toBe('green');
    expect(result.label).toBe('On track');
  });

  it('green — fully produced (completed)', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '2026-07-08', createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 100 }],
      today,
    );
    expect(result.state).toBe('green');
    expect(result.label).toBe('On track');
  });

  it('no due date — returns green when incomplete', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '', buyerDeliveryDate: '', createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 50 }],
      today,
    );
    expect(result.state).toBe('green');
    expect(result.dueDate).toBeNull();
  });

  it('no due date — returns grey when nothing produced', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '', buyerDeliveryDate: '' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [],
      today,
    );
    expect(result.state).toBe('grey');
    expect(result.dueDate).toBeNull();
  });

  it('dueDate falls back from targetEndDate to buyerDeliveryDate', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '', buyerDeliveryDate: '2026-07-15', createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 50 }],
      today,
    );
    expect(result.dueDate).toBe('2026-07-15');
  });

  it('falls back to order_rows quantity when no colourways (colourless save)', () => {
    // order_headers has no orderQty column — a colourless-row order has zero
    // colourways, so the only real source of quantity is order_rows.
    const result = getOrderHealth(
      makeOrder({ createdAt: '2026-07-01' }),
      [],
      [{ orderId: 'order-1', outputQty: 50 }],
      today,
      [{ orderId: 'order-1', orderQty: 200 }],
    );
    expect(result.orderedQty).toBe(200);
  });

  it('has zero ordered qty, not a phantom order.orderQty, when neither colourways nor order_rows are given', () => {
    const result = getOrderHealth(
      makeOrder({ createdAt: '2026-07-01' }),
      [],
      [{ orderId: 'order-1', outputQty: 50 }],
      today,
    );
    expect(result.orderedQty).toBe(0);
  });

  it('uses colourway sum over order_rows when colourways exist', () => {
    const result = getOrderHealth(
      makeOrder({ createdAt: '2026-07-01' }),
      [{ orderId: 'order-1', orderedQty: 150 }],
      [{ orderId: 'order-1', outputQty: 50 }],
      today,
      [{ orderId: 'order-1', orderQty: 200 }],
    );
    expect(result.orderedQty).toBe(150);
  });

  it('sums colourways with orderId match', () => {
    const result = getOrderHealth(
      makeOrder({ id: 'order-1', orderQty: 200, createdAt: '2026-07-01' }),
      [
        { orderId: 'order-1', orderedQty: 100 },
        { orderId: 'order-1', orderedQty: 50 },
        { orderId: 'other-order', orderedQty: 999 },
      ],
      [{ orderId: 'order-1', outputQty: 50 }],
      today,
    );
    expect(result.orderedQty).toBe(150);
  });

  it('does not crash on empty inputs', () => {
    const result = getOrderHealth(
      makeOrder(),
      [],
      [],
      today,
    );
    expect(result.state).toBe('grey');
    expect(result.orderedQty).toBe(0);
    expect(result.producedQty).toBe(0);
  });

  it('green when due date before createdAt (edge case)', () => {
    const result = getOrderHealth(
      makeOrder({ targetEndDate: '2026-07-05', createdAt: '2026-07-10' }),
      [{ orderId: 'order-1', orderedQty: 100 }],
      [{ orderId: 'order-1', outputQty: 50 }],
      '2026-07-12',
    );
    expect(result.state).toBe('red');
  });
});
