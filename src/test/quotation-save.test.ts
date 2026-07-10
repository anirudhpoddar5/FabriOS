import { describe, expect, it, vi } from 'vitest';
import { createQuotationWithLines } from '@/lib/quotation-save';

describe('quotation saving', () => {
  it('uses the ID returned by the database header insert for every line item', async () => {
    const insertHeader = vi.fn().mockResolvedValue('new-quotation-id');
    const insertLines = vi.fn().mockResolvedValue(undefined);

    await createQuotationWithLines(
      { quotation_number: 'Q-0001' },
      [{ productId: 'product-1', description: 'Fabric', qty: 10, uom: 'meters', rate: 5, sortOrder: 0 }],
      insertHeader,
      insertLines,
    );

    expect(insertLines).toHaveBeenCalledWith([expect.objectContaining({ quotation_id: 'new-quotation-id' })]);
  });
});
