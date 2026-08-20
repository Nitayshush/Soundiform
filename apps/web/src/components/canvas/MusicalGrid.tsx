/**
 * @file        MusicalGrid.tsx
 * @description רשת מוזיקלית מוצגת מעל הקנבס (X=זמן, Y=דרגת סולם). ראה PROJECT.md §4.2.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

const DEFAULT_COLUMNS = 8;
const DEFAULT_ROWS = 8;

export interface MusicalGridProps {
  columns?: number;
  rows?: number;
}

/**
 * ⚠️ Sprint 1: רשת גנרית קבועה (8×8) — overlay ויזואלי בלבד, לא מחובר עדיין ל-subdivision/
 * allowedModes של GenrePack אמיתי (Sprint 3 תיאוריה, Sprint 5 סגנונות). אין לפרש כרשת "סופית".
 */
export function MusicalGrid({ columns = DEFAULT_COLUMNS, rows = DEFAULT_ROWS }: MusicalGridProps) {
  const columnLines = Array.from(
    { length: Math.max(0, columns - 1) },
    (_, index) => ((index + 1) / columns) * 100,
  );
  const rowLines = Array.from(
    { length: Math.max(0, rows - 1) },
    (_, index) => ((index + 1) / rows) * 100,
  );

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {columnLines.map((percent) => (
        <line
          key={`col-${percent}`}
          x1={`${percent}%`}
          y1="0%"
          x2={`${percent}%`}
          y2="100%"
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={1}
        />
      ))}
      {rowLines.map((percent) => (
        <line
          key={`row-${percent}`}
          x1="0%"
          y1={`${percent}%`}
          x2="100%"
          y2={`${percent}%`}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
