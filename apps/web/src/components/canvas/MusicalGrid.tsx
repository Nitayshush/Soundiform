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
  /**
   * ⭐ 2026-08-27 (לוח-תווים אבסולוטי): שם-תו אמיתי לכל שורה (מהעליונה לתחתונה), לתצוגה
   * לצד קו-השורה — ראה apps/(app)/studio/page.tsx. undefined = בלי תוויות (התנהגות ישנה,
   * זהה 1:1 לסגנונות שלא הוגדר להם absoluteNoteBoard).
   */
  rowLabels?: readonly string[];
}

/**
 * ⚠️ Sprint 1: ברירת-המחדל (8×8, בלי rowLabels) היא רשת גנרית — overlay ויזואלי בלבד, לא
 * מחוברת לתיאוריה אמיתית. ⭐ 2026-08-27: כשהקורא מעביר rows/columns/rowLabels (סגנונות עם
 * absoluteNoteBoard, ראה noteBoard.ts), הרשת הזו הופכת ללוח-התווים האמיתי בפועל — לא "סופית"
 * במובן שהיא עדיין יכולה לגדול לסגנונות נוספים, אבל כן מדויקת-לתיאוריה עבור מי שכבר הוגדר.
 */
export function MusicalGrid({
  columns = DEFAULT_COLUMNS,
  rows = DEFAULT_ROWS,
  rowLabels,
}: MusicalGridProps) {
  const columnLines = Array.from(
    { length: Math.max(0, columns - 1) },
    (_, index) => ((index + 1) / columns) * 100,
  );
  const rowLines = Array.from(
    { length: Math.max(0, rows - 1) },
    (_, index) => ((index + 1) / rows) * 100,
  );
  const rowLabelPositions =
    rowLabels?.map((label, index) => ({ label, centerPercent: ((index + 0.5) / rows) * 100 })) ??
    [];

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
      {rowLabelPositions.map(({ label, centerPercent }) => (
        <text
          key={`label-${label}-${centerPercent}`}
          x="4"
          y={`${centerPercent}%`}
          dominantBaseline="middle"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          fill="currentColor"
          fillOpacity={0.35}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
