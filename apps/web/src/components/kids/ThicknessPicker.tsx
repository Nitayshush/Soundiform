/**
 * @file        ThicknessPicker.tsx
 * @description ⭐ 2026-09-04 (Kids Studio v1): בורר עובי-קו — כותב ל-shapeStore.currentStrokeWidth.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useShapeStore } from '@/stores/shapeStore';

/** ⚠️ 6 = ברירת המחדל הקבועה ב-DrawingCanvas.tsx (LINE_WIDTH) — נשאר אחד משלושת הגדלים. */
const THICKNESSES = [3, 6, 12];

export function ThicknessPicker() {
  const currentStrokeWidth = useShapeStore((state) => state.currentStrokeWidth);
  const setCurrentStrokeWidth = useShapeStore((state) => state.setCurrentStrokeWidth);

  return (
    <div className="flex items-center gap-2">
      {THICKNESSES.map((width) => (
        <button
          key={width}
          type="button"
          onClick={() => {
            setCurrentStrokeWidth(width);
          }}
          aria-label={`Line thickness ${String(width)}`}
          aria-pressed={currentStrokeWidth === width}
          className="flex size-10 items-center justify-center rounded-full border-2 bg-card shadow-sm transition-transform active:scale-90 [@media(pointer:coarse)]:size-12"
          style={{ borderColor: currentStrokeWidth === width ? 'var(--primary)' : 'transparent' }}
        >
          <span
            className="rounded-full bg-foreground"
            style={{ width: width, height: width }}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
