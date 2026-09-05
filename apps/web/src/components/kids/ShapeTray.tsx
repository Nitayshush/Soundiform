/**
 * @file        ShapeTray.tsx
 * @description ⭐ 2026-09-04 (Kids Studio v1): שורת כפתורי-בחירה לצורות מוכנות.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ רק כפתורי הבחירה יושבים כאן — ShapePlacementOverlay עצמו (התצוגה המקדימה) **חייב**
 * לשבת בתוך מיכל-הבמה (יחד עם DrawingCanvas/MusicalGrid), לא כאן: הוא ממוקם `absolute
 * inset-0` יחסית להורה הכי קרוב עם position:relative — אם הוא היה מצויר בתוך הטולבר
 * (מחוץ למיכל-הבמה), הוא היה ממוקם ביחס למקום הלא-נכון לגמרי. לכן ה-state של "איזו צורה
 * ממתינה למיקום" גר בעמוד (studio/kids/page.tsx), לא כאן — ראה שם.
 *
 * ⭐ 2026-09-05 (דווח חי, מובייל): גודל-קטן-כברירת-מחדל (sm: מגדיל) — ראה ColorPicker.tsx
 * להסבר המלא, כולל למה בלי [@media(pointer:coarse)].
 */

'use client';

import { Circle, Heart, Square, Star, Triangle } from 'lucide-react';
import { KIDS_SHAPE_KINDS, type KidsShapeKind } from '@/lib/kidsShapes';

const SHAPE_ICONS: Record<KidsShapeKind, typeof Circle> = {
  circle: Circle,
  square: Square,
  triangle: Triangle,
  star: Star,
  heart: Heart,
};

export interface ShapeTrayProps {
  onSelect: (kind: KidsShapeKind) => void;
  /** true בזמן שכבר יש צורה בתצוגה מקדימה — מונע בחירת צורה שנייה לפני שהראשונה הונחה/בוטלה. */
  disabled: boolean;
}

export function ShapeTray({ onSelect, disabled }: ShapeTrayProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {KIDS_SHAPE_KINDS.map((kind) => {
        const Icon = SHAPE_ICONS[kind];
        return (
          <button
            key={kind}
            type="button"
            onClick={() => {
              onSelect(kind);
            }}
            aria-label={`Place a ${kind}`}
            disabled={disabled}
            className="flex size-8 items-center justify-center rounded-2xl border-2 border-border bg-card text-foreground shadow-sm transition-transform active:scale-90 disabled:opacity-40 sm:size-12"
          >
            <Icon className="size-4 sm:size-7" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
