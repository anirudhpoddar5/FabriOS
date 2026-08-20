/**
 * Styling for inputs that sit in tight table cells and dense dialog grids.
 *
 * Two traps the base Input component sets, both of which have shipped bugs:
 *
 *  1. `px-3` — 24px of horizontal padding. In a ~70px cell that leaves less
 *     than one digit of visible text, so typed values are stored correctly but
 *     clipped out of sight. Users read that as "the field won't accept input".
 *  2. `md:text-sm` — a media-query rule, so it beats a plain `text-[11px]` on
 *     desktop no matter the source order. Every small font in a dense form was
 *     silently rendering at 14px, making the clipping worse.
 *
 * Use these instead of hand-rolling `h-7 text-[11px]` on a narrow field.
 */
export const COMPACT_INPUT = 'h-8 px-1.5 text-[11px] md:text-[11px]';

/** Compact + right-aligned, with the number spinners removed — they eat ~16px. */
export const COMPACT_NUMBER =
  `${COMPACT_INPUT} text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

/** Grid-row height variant (28px) for the entry grid, which packs 12 columns. */
export const GRID_INPUT = 'h-7 px-1 text-[11px] md:text-[11px]';
export const GRID_NUMBER =
  `${GRID_INPUT} text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
