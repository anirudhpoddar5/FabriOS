import { describe, expect, it } from 'vitest';
import { separateOrderData } from '@/lib/order-data';

describe('related order data', () => {
  it('keeps every product row and connects each colour to its own row', () => {
    const data = separateOrderData(
      [{ id: 'order-1', module: 'printing' }],
      [{ id: 'row-1', orderId: 'order-1' }, { id: 'row-2', orderId: 'order-1' }],
      [{ id: 'colour-1', orderRowId: 'row-1' }, { id: 'colour-2', orderRowId: 'row-2' }],
    );
    expect(data.orderRows).toHaveLength(2);
    expect(data.printingOrders[0]).not.toHaveProperty('orderQty');
    expect(data.printingColourways.map(colour => colour.orderId)).toEqual(['order-1', 'order-1']);
  });
});
