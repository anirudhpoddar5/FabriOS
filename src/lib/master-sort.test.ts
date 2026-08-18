import { describe, it, expect } from 'vitest';
import { getDisplayValue, compareDisplayValues, sortAndGroupRows, groupConsecutive } from './master-sort';
import type { ColumnDef } from '@/components/MasterCRUD';

interface Row { id: string; factoryId: string; code: string; machines: number | null; }

const factoryNames: Record<string, string> = { f1: 'Sanganer', f2: '22 Godown' };
const columns: ColumnDef<Row>[] = [
  { key: 'factoryId', header: 'Factory', render: (r) => factoryNames[r.factoryId] || r.factoryId },
  { key: 'code', header: 'Code' },
  { key: 'machines', header: 'Machines' },
];

describe('getDisplayValue', () => {
  it('sorts on the looked-up label a render() produces, not the raw uuid', () => {
    expect(getDisplayValue(columns[0], { id: '1', factoryId: 'f1', code: 'A', machines: 1 })).toBe('Sanganer');
  });

  it('falls back to the raw field when there is no render/accessor', () => {
    expect(getDisplayValue(columns[1], { id: '1', factoryId: 'f1', code: 'B12', machines: 1 })).toBe('B12');
  });

  it('treats an empty string as blank', () => {
    expect(getDisplayValue(columns[1], { id: '1', factoryId: 'f1', code: '', machines: 1 })).toBeNull();
  });
});

describe('compareDisplayValues', () => {
  it('compares numbers numerically, so 9 sorts before 10', () => {
    expect(compareDisplayValues(9, 10, 'asc')).toBeLessThan(0);
    expect(compareDisplayValues('9', '10', 'asc')).toBeGreaterThan(0); // lexicographic string compare, for contrast
  });

  it('compares strings case-insensitively', () => {
    expect(compareDisplayValues('apple', 'Banana', 'asc')).toBeLessThan(0);
    expect(compareDisplayValues('APPLE', 'apple', 'asc')).toBe(0);
  });

  it('sorts blanks last regardless of direction', () => {
    expect(compareDisplayValues(null, 'a', 'asc')).toBeGreaterThan(0);
    expect(compareDisplayValues('a', null, 'asc')).toBeLessThan(0);
    expect(compareDisplayValues(null, 'a', 'desc')).toBeGreaterThan(0);
    expect(compareDisplayValues('a', null, 'desc')).toBeLessThan(0);
  });

  it('flips order for desc without disturbing blank-last', () => {
    expect(compareDisplayValues(1, 2, 'desc')).toBeGreaterThan(0);
  });
});

describe('sortAndGroupRows', () => {
  const rows: Row[] = [
    { id: 'a', factoryId: 'f1', code: 'T2', machines: 9 },
    { id: 'b', factoryId: 'f2', code: 'T1', machines: 10 },
    { id: 'c', factoryId: 'f1', code: 'T3', machines: null },
    { id: 'd', factoryId: 'f2', code: 'T4', machines: 2 },
  ];

  it('sorts by the clicked column using its displayed value', () => {
    const out = sortAndGroupRows(rows, columns, { index: 0, direction: 'asc' });
    // "22 Godown" < "Sanganer" case-insensitively
    expect(out.map(r => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sorts numeric column numerically with blanks last', () => {
    const out = sortAndGroupRows(rows, columns, { index: 2, direction: 'asc' });
    expect(out.map(r => r.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('with no sort clicked and no groupBy, preserves original order (opt-in safety)', () => {
    const out = sortAndGroupRows(rows, columns, null);
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('groups rows contiguously by the group column while keeping the active sort within each group', () => {
    const out = sortAndGroupRows(rows, columns, { index: 1, direction: 'asc' }, 'factoryId');
    // grouped by factory label ascending ("22 Godown" then "Sanganer"), code-sorted within each group
    expect(out.map(r => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('groupConsecutive', () => {
  it('chunks an already-grouped list into labelled runs with counts', () => {
    const sorted = [
      { id: 'b', factoryId: 'f2', code: 'T1', machines: 10 },
      { id: 'd', factoryId: 'f2', code: 'T4', machines: 2 },
      { id: 'a', factoryId: 'f1', code: 'T2', machines: 9 },
    ];
    const groups = groupConsecutive(sorted, columns, 'factoryId');
    expect(groups).toEqual([
      { label: '22 Godown', items: [sorted[0], sorted[1]] },
      { label: 'Sanganer', items: [sorted[2]] },
    ]);
  });
});
