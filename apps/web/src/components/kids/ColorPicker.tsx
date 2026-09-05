/**
 * @file        ColorPicker.tsx
 * @description ⭐ 2026-09-04 (Kids Studio v1): בורר צבע-קו גדול — כותב ל-shapeStore.currentColor.
 *              Studio הרגיל אף פעם לא מרכיב את הקומפוננטה הזו, אז currentColor נשאר בברירת
 *              המחדל שם (ראה shapeStore.ts) — אין שינוי התנהגות בסטודיו הרגיל.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-09-05 (דווח חי, מובייל): גודל-קטן-כברירת-מחדל, גדל רק מ-sm ומעלה — הגודל הקבוע
 * הקודם (size-9, פועל שווה בכל רוחב מסך) היה חלק ממה שדחק את לוח-הציור לתיבה קטנה בנייד.
 * ⚠️ בכוונה **בלי** [@media(pointer:coarse)] (כמו ב-button.tsx המשותף) — pointer:coarse
 * מזהה קלט-מגע, לא רוחב-מסך, אז הוא היה מגדיל את הכפתורים גם על טלפון צר (המקרה שבדיוק
 * רצינו לצמצם), ומבטל את אפקט ה-sm: לגמרי.
 */

'use client';

import { useShapeStore } from '@/stores/shapeStore';

/** ⚠️ ערכי hex פשוטים (6 ספרות) בכוונה — DrawingCanvas.tsx בונה מילוי-שקוף מ-`${color}33`. */
const COLORS = [
  '#211b4a', // כהה (ברירת המחדל של Studio הרגיל)
  '#e11d48', // אדום
  '#f59e0b', // כתום
  '#22c55e', // ירוק
  '#3b82f6', // כחול
  '#a855f7', // סגול
];

export function ColorPicker() {
  const currentColor = useShapeStore((state) => state.currentColor);
  const setCurrentColor = useShapeStore((state) => state.setCurrentColor);

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => {
            setCurrentColor(color);
          }}
          aria-label={`Pick color ${color}`}
          aria-pressed={currentColor === color}
          className="size-7 shrink-0 rounded-full border-2 shadow-sm transition-transform active:scale-90 sm:size-9"
          style={{
            backgroundColor: color,
            borderColor: currentColor === color ? 'var(--foreground)' : 'transparent',
          }}
        />
      ))}
    </div>
  );
}
