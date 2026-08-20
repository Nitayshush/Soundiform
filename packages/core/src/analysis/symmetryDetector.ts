/**
 * @file        symmetryDetector.ts
 * @description מזהה סימטריית שיקוף (אופקי/אנכי) וסימטריה סיבובית בקונטור. הבסיס ל-§4.4 —
 *              איזומורפיזם בין חבורות דיהדרליות גאומטריות לטרנספורמציות קונטרפונקטיות.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מגבלת V1: מזוהה רק שיקוף בציר אופקי/אנכי (מיושר-צירים), לא ציר שיקוף בזווית שרירותית.
 * חיפוש זווית-שיקוף כללית הוא בעיית אופטימיזציה נפרדת — נדחה לגרסה עתידית אם יתברר שנדרש.
 * שיקוף אופקי (ציר אנכי, x→2cx-x) → רטרוגרד. שיקוף אנכי (ציר אופקי, y→2cy-y) → אינוורסיה (§4.4).
 */

import type { ShapePoint } from '@soundiform/shared';
import type { Contour } from './contourExtractor';
import { at, distance } from './geometryUtils';

/** מועמדי סדר סיבוב, מהגבוה לנמוך — כך שהראשון שעובר הוא הסדר המקסימלי. 8 = תקרה מעשית (עיגול "אינסופי"). */
const ROTATIONAL_ORDER_CANDIDATES = [8, 6, 5, 4, 3, 2];
/** שגיאת התאמה מותרת, כיחס מ"רדיוס" הצורה (RMS מרחק מהמרכז) — סקלה-בלתי-תלויה. */
const MATCH_TOLERANCE_RATIO = 0.12;

export interface SymmetryResult {
  /** שיקוף שמאל-ימין (ציר אנכי) — מתאים לרטרוגרד. */
  horizontalMirror: boolean;
  /** שיקוף למעלה-למטה (ציר אופקי) — מתאים לאינוורסיה. */
  verticalMirror: boolean;
  /** סדר הסימטריה הסיבובית: 1 = ללא (רק זהות), n = סימטריה מסדר n (מתאים לסקוונצה/טרנספוזיציה). */
  rotationalOrder: number;
}

function reflectHorizontal(points: ShapePoint[], center: ShapePoint): ShapePoint[] {
  return points.map((point) => ({ x: 2 * center.x - point.x, y: point.y }));
}

function reflectVertical(points: ShapePoint[], center: ShapePoint): ShapePoint[] {
  return points.map((point) => ({ x: point.x, y: 2 * center.y - point.y }));
}

function rotate(points: ShapePoint[], center: ShapePoint, angleRad: number): ShapePoint[] {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
}

/** "רדיוס" אפייני של הצורה — RMS מרחק מהמרכז — משמש לנרמל את סף ההתאמה לגודל הצורה. */
function shapeScale(points: ShapePoint[], center: ShapePoint): number {
  const sumSquares = points.reduce((sum, point) => sum + distance(point, center) ** 2, 0);
  return Math.sqrt(sumSquares / points.length);
}

/** ממוצע מרחק בין שתי סדרות מחזוריות באותו אורך, בהינתן היסט (shift) וכיוון מעבר. */
function meanCyclicDistance(
  base: ShapePoint[],
  candidate: ShapePoint[],
  shift: number,
  reversed: boolean,
): number {
  const count = base.length;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const candidateIndex = reversed
      ? (((shift - index) % count) + count) % count
      : (index + shift) % count;
    total += distance(at(base, index), at(candidate, candidateIndex));
  }
  return total / count;
}

/** שגיאת ההתאמה הטובה ביותר בין שתי סדרות מחזוריות, על פני כל היסט אפשרי (ושני כיווני מעבר). */
function bestCyclicMatchError(
  base: ShapePoint[],
  candidate: ShapePoint[],
  allowReversed: boolean,
): number {
  const count = base.length;
  let best = Infinity;
  for (let shift = 0; shift < count; shift += 1) {
    best = Math.min(best, meanCyclicDistance(base, candidate, shift, false));
    if (allowReversed) {
      best = Math.min(best, meanCyclicDistance(base, candidate, shift, true));
    }
  }
  return best;
}

function matchesWithinTolerance(error: number, scale: number): boolean {
  const normalizedScale = Math.max(scale, 1e-6);
  return error / normalizedScale <= MATCH_TOLERANCE_RATIO;
}

function detectRotationalOrder(points: ShapePoint[], center: ShapePoint, scale: number): number {
  for (const order of ROTATIONAL_ORDER_CANDIDATES) {
    const rotated = rotate(points, center, (2 * Math.PI) / order);
    const error = bestCyclicMatchError(points, rotated, false);
    if (matchesWithinTolerance(error, scale)) {
      return order;
    }
  }
  return 1;
}

/**
 * מזהה סימטריה בקונטור. משמעותי בעיקר עבור קונטור סגור — צורה פתוחה לרוב לא תראה סימטריה
 * אמיתית (§4.2 מתייחס לסימטריה בהקשר של קונטור סגור/צורות שלמות).
 */
export function detectSymmetry(contour: Contour): SymmetryResult {
  const { points } = contour;
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 },
  );
  const scale = shapeScale(points, center);

  const horizontalMirror = matchesWithinTolerance(
    bestCyclicMatchError(points, reflectHorizontal(points, center), true),
    scale,
  );
  const verticalMirror = matchesWithinTolerance(
    bestCyclicMatchError(points, reflectVertical(points, center), true),
    scale,
  );
  const rotationalOrder = detectRotationalOrder(points, center, scale);

  return { horizontalMirror, verticalMirror, rotationalOrder };
}
