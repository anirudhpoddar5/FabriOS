import { describe, expect, it } from 'vitest';
import {
  createQuickEntryDraft,
  hasUnfinishedQuickEntry,
  prefillQuickEntryAfterSave,
  type QuickEntryDraft,
} from '@/components/entries/BulkEntryGrid';

describe('quick entry prefill and draft behavior', () => {
  it('starts with phone-entry defaults for the selected module and factory', () => {
    const draft = createQuickEntryDraft('stitching', 'factory-1');

    expect(draft.module).toBe('stitching');
    expect(draft.factoryId).toBe('factory-1');
    expect(draft.orderId).toBe('');
    expect(draft.colourwayId).toBe('');
    expect(draft.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('prefills the next quick entry from the last successful save without carrying order output', () => {
    const saved: QuickEntryDraft = {
      date: '2026-07-10',
      module: 'printing',
      factoryId: 'factory-1',
      orderId: 'order-1',
      colourwayId: 'colour-1',
      shiftId: 'shift-1',
      resourceId: 'table-1',
      workerTypeId: 'worker-type-1',
      personsUsed: 2,
      outputQty: 42,
      outputUOM: 'meters',
    };

    const next = prefillQuickEntryAfterSave(saved, 'factory-2');

    expect(next).toMatchObject({
      date: '2026-07-10',
      module: 'printing',
      factoryId: 'factory-2',
      shiftId: 'shift-1',
      resourceId: 'table-1',
      workerTypeId: 'worker-type-1',
      personsUsed: 2,
      outputUOM: 'meters',
      orderId: '',
      colourwayId: '',
      outputQty: 0,
    });
  });

  it('treats selected order, entered output, persons, or UOM as unfinished draft input', () => {
    const blank = createQuickEntryDraft('printing', 'factory-1');
    expect(hasUnfinishedQuickEntry(blank)).toBe(false);

    expect(hasUnfinishedQuickEntry({ ...blank, orderId: 'order-1' })).toBe(true);
    expect(hasUnfinishedQuickEntry({ ...blank, outputQty: 1 })).toBe(true);
    expect(hasUnfinishedQuickEntry({ ...blank, personsUsed: 1 })).toBe(true);
    expect(hasUnfinishedQuickEntry({ ...blank, outputUOM: 'pcs' })).toBe(true);
  });
});
