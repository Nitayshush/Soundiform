/**
 * @file        geometryUtils.ts
 * @description פרימיטיבים גאומטריים משותפים לשכבת ה-analysis (לא מיוצא מ-index.ts — פנימי בלבד).
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { ShapePoint } from '@soundiform/shared';

export { at } from '../internal/arrayUtils';

export function distance(a: ShapePoint, b: ShapePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** ממוצע נקודות פשוט (לא משוקלל-שטח) — משמש לצורות פתוחות שאין להן פוליגון סגור. */
export function averagePoint(points: readonly ShapePoint[]): ShapePoint {
  if (points.length === 0) {
    throw new Error('averagePoint: לא ניתן לחשב ממוצע על מערך ריק');
  }
  const sum = points.reduce(
    (accumulator, point) => ({ x: accumulator.x + point.x, y: accumulator.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}
