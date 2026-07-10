import { describe, expect, it, vi } from 'vitest';
import { saveBulkEntries, type GridRow } from '@/components/entries/BulkEntryGrid';
import type { RateMaster } from '@/types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: { production_entry_id: 'mock', consumption_status: 'not_available', consumption_count: 0 }, error: null }),
  },
}));

const rate: RateMaster = {
  id: 'rate-1', factoryId: 'factory-1', shiftId: 'shift-1', workerTypeId: 'worker-type-1',
  rateBasis: 'per_piece', rateValue: 2, effectiveFrom: '2026-01-01', active: true,
};

function row(id: string): GridRow {
  return {
    id, date: '2026-07-10', module: 'printing', orderId: 'order-1', colourwayId: 'colour-1',
    orderRowId: 'order-row-1', productLabel: 'Product', shiftId: 'shift-1', resourceId: 'table-1',
    workerTypeId: 'worker-type-1', personsUsed: 1, outputQty: 10, valid: true, errors: [], costPreview: 20,
  };
}

describe('bulk entry saving', () => {
  it('waits for every save and returns failures so their rows can stay on screen', async () => {
    const failures = await saveBulkEntries([row('one'), row('two')], 'factory-1', [rate]);

    expect(failures.size).toBe(0);
  });

  it('returns error when no rate is found', async () => {
    const failures = await saveBulkEntries([row('one')], 'factory-1', []);
    expect(failures.size).toBe(1);
    expect(failures.get('one')).toBe('No active rate found');
  });
});
