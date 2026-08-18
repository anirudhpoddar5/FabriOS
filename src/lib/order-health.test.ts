import { describe, it, expect } from 'vitest';
import { getOrderHealth } from './order-health';

describe('getOrderHealth', () => {
  it('falls back to order_rows quantity when the order has no colourways (colourless save)', () => {
    const order = { id: 'o1', status: 'Started', createdAt: '2026-08-01' };
    const entries = [{ orderId: 'o1', outputQty: 20 }];
    const result = getOrderHealth(order, [], entries, '2026-08-18', [{ orderId: 'o1', orderQty: 100 }]);
    expect(result.orderedQty).toBe(100);
    expect(result.producedQty).toBe(20);
  });

  it('prefers colourway quantity over order_rows when colourways exist', () => {
    const order = { id: 'o1', status: 'Started', createdAt: '2026-08-01' };
    const entries = [{ orderId: 'o1', outputQty: 20 }];
    const result = getOrderHealth(
      order,
      [{ orderId: 'o1', orderedQty: 50 }],
      entries,
      '2026-08-18',
      [{ orderId: 'o1', orderQty: 999 }],
    );
    expect(result.orderedQty).toBe(50);
  });

  it('has zero ordered qty (not a hidden order) when neither colourways nor order_rows exist', () => {
    const order = { id: 'o1', status: 'Started', createdAt: '2026-08-01' };
    const result = getOrderHealth(order, [], [], '2026-08-18');
    expect(result.orderedQty).toBe(0);
  });
});
