export interface NewQuotationLine {
  productId?: string | null;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  sortOrder: number;
}

export async function createQuotationWithLines<THeader>(
  header: THeader,
  lines: NewQuotationLine[],
  insertHeader: (header: THeader) => Promise<string>,
  insertLines: (rows: Array<{ quotation_id: string; product_id: string | null; description: string; qty: number; uom: string; rate: number; sort_order: number }>) => Promise<void>,
): Promise<string> {
  const quotationId = await insertHeader(header);
  const validLines = lines.filter(line => line.description);
  if (validLines.length > 0) {
    await insertLines(validLines.map(line => ({
      quotation_id: quotationId,
      product_id: line.productId || null,
      description: line.description,
      qty: Number(line.qty) || 0,
      uom: line.uom || 'pcs',
      rate: Number(line.rate) || 0,
      sort_order: line.sortOrder,
    })));
  }
  return quotationId;
}
