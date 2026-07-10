export function separateOrderData(headers: any[], rows: any[], colourways: any[]) {
  const rowToOrder = new Map(rows.map(row => [row.id, row.orderId]));
  const printingOrderIds = new Set(headers.filter(header => header.module === 'printing').map(header => header.id));
  const stitchingOrderIds = new Set(headers.filter(header => header.module === 'stitching').map(header => header.id));
  const withOrderId = (colourway: any) => ({ ...colourway, orderId: rowToOrder.get(colourway.orderRowId) || null });
  return {
    printingOrders: headers.filter(header => header.module === 'printing'),
    stitchingOrders: headers.filter(header => header.module === 'stitching'),
    orderRows: rows,
    printingColourways: colourways.filter(colourway => printingOrderIds.has(rowToOrder.get(colourway.orderRowId))).map(withOrderId),
    stitchingColourways: colourways.filter(colourway => stitchingOrderIds.has(rowToOrder.get(colourway.orderRowId))).map(withOrderId),
  };
}
