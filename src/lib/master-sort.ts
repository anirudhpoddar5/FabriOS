import type { ColumnDef } from '@/components/MasterCRUD';

export type SortDirection = 'asc' | 'desc';
export interface SortState { index: number; direction: SortDirection; }
export interface RowGroup<T> { label: string; items: T[]; }

/**
 * What the user actually SEES for a column: render() output, then accessor(), then the
 * raw field. A column that renders a looked-up label (e.g. Factory name from factoryId)
 * must sort on that label, not the underlying uuid — otherwise the order looks random.
 * Falls back to the raw field if render/accessor produced something non-primitive (JSX) —
 * none of today's columns do this, but it's cheap insurance against a blank/garbage sort.
 */
export function getDisplayValue<T>(col: ColumnDef<T>, item: T): string | number | null {
  const raw = col.render ? col.render(item) : col.accessor ? col.accessor(item) : (item as any)[col.key];
  if (typeof raw === 'string' || typeof raw === 'number') return raw === '' ? null : raw;
  const fallback = (item as any)[col.key];
  if (typeof fallback === 'string' || typeof fallback === 'number') return fallback === '' ? null : fallback;
  return null;
}

/** Numbers compare numerically (9 before 10), strings case-insensitively. Blanks sort last, both directions. */
export function compareDisplayValues(a: string | number | null, b: string | number | null, direction: SortDirection): number {
  const aBlank = a === null || a === undefined;
  const bBlank = b === null || b === undefined;
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;
  const cmp = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
  return direction === 'asc' ? cmp : -cmp;
}

/**
 * Applies the clicked-header sort, then (if grouping) a stable secondary sort by the
 * group column ascending — stable sort means rows keep their sorted-by-header order
 * within each group, while groups themselves become contiguous.
 */
export function sortAndGroupRows<T>(items: T[], columns: ColumnDef<T>[], sort: SortState | null, groupByKey?: string): T[] {
  let list = items;
  const sortCol = sort ? columns[sort.index] : undefined;
  if (sortCol) {
    list = [...list].sort((a, b) => compareDisplayValues(getDisplayValue(sortCol, a), getDisplayValue(sortCol, b), sort!.direction));
  }
  const groupCol = groupByKey ? columns.find(c => c.key === groupByKey) : undefined;
  if (groupCol) {
    list = [...list].sort((a, b) => compareDisplayValues(getDisplayValue(groupCol, a), getDisplayValue(groupCol, b), 'asc'));
  }
  return list;
}

/** Chunks an already-grouped-adjacent list into labelled runs, for the sub-heading rows. */
export function groupConsecutive<T>(items: T[], columns: ColumnDef<T>[], groupByKey: string): RowGroup<T>[] {
  const groupCol = columns.find(c => c.key === groupByKey);
  if (!groupCol) return [{ label: '', items }];
  const groups: RowGroup<T>[] = [];
  for (const item of items) {
    const val = getDisplayValue(groupCol, item);
    const label = val === null ? '—' : String(val);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
