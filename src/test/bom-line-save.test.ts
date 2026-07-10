import { describe, expect, it } from 'vitest';
import { buildBomLinePayloads } from '@/lib/bom-line-save';

describe('BOM line saving', () => {
  it('sends the displayed calculated total, including zero, to the database', () => {
    const [line] = buildBomLinePayloads('bom-1', [{ item_name: 'Fabric', total_amount: 0 }]);

    expect(line).toMatchObject({ bom_id: 'bom-1', item_name: 'Fabric', total_amount: 0 });
  });
});
