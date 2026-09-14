/**
 * @file        ShapePreviewSvg.tsx
 * @description ⭐ 2026-09-13 (My Drafts): תצוגה-ממוזערת של ציור שנשמר אך **לא רונדר** —
 *              אין poster/video עבור טיוטה (אלה נוצרים רק ברינדור, ראה renders.posterKey),
 *              אז זו תצוגה ישירה של shapeData.paths עצמם (נקודות מנורמלות 0–1, בדיוק כמו
 *              שהקנבס בסטודיו מצייר אותן) — לא תלויה ברינדור בכלל.
 * @author      Soundiform
 * @created     2026-09-13
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ Server Component-friendly בכוונה — אין state/effects, רק JSX טהור מתוך paths, כדי
 * שדף /account/drafts (Server Component) יוכל לרנדר אותו ישירות בלי 'use client'.
 */

import type { ShapePath } from '@soundiform/shared';

export interface ShapePreviewSvgProps {
  paths: ShapePath[];
  className?: string;
}

export function ShapePreviewSvg({ paths, className }: ShapePreviewSvgProps) {
  return (
    <svg viewBox="0 0 1 1" className={className} aria-hidden="true">
      {paths.map((path, index) => (
        <polyline
          key={index}
          points={path.points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.012}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
