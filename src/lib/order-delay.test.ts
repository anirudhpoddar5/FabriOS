import { describe, it, expect } from 'vitest';
import { getOrderDelay } from './order-delay';

const allWeek = [0, 1, 2, 3, 4, 5, 6];

describe('getOrderDelay', () => {
  it('falls back to order_rows quantity when the order has no colourways (colourless save)', () => {
    const order = { id: 'o1', status: 'Started' };
    const result = getOrderDelay(order, [], [], new Date('2026-08-18T10:00:00Z'), allWeek, [
      { orderId: 'o1', orderQty: 100 },
    ]);
    expect(result.remainingQty).toBe(100);
  });

  it('prefers colourway quantity over order_rows when colourways exist', () => {
    const order = { id: 'o1', status: 'Started' };
    const result = getOrderDelay(
      order,
      [{ orderId: 'o1', orderedQty: 50 }],
      [],
      new Date('2026-08-18T10:00:00Z'),
      allWeek,
      [{ orderId: 'o1', orderQty: 999 }],
    );
    expect(result.remainingQty).toBe(50);
  });

  it('has zero remaining qty (not a hidden order) when neither colourways nor order_rows exist', () => {
    const order = { id: 'o1', status: 'Started' };
    const result = getOrderDelay(order, [], [], new Date('2026-08-18T10:00:00Z'), allWeek, []);
    expect(result.exception).toBeNull();
    expect(result.remainingQty).toBe(0);
  });
});
