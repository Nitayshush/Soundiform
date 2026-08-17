/**
 * @file        geometryUtils.ts
 * @description פרימיטיבים גאומטריים משותפים לשכבת ה-analysis (לא מיוצא מ-index.ts — פנימי בלבד).
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { ShapePoint } from '@shape-sound/shared';

/**
 * גישה בטוחה למערך עם שגיאה מפורשת אם האינדקס מחוץ לתחום —
 * מונע `!` (non-null assertion אסור, §0.3) גם כשהאינדקס תמיד תקף לוגית מתוך הלולאה הקוראת.
 */
export function at<T>(array: readonly T[], index: number): T {
  const value = array[index];
  if (value === undefined) {
    throw new Error(`at: אינדקס ${String(index)} מחוץ לתחום המערך (אורך ${String(array.length)})`);
  }
  return value;
}

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
