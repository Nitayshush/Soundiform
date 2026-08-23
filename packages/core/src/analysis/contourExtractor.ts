/**
 * @file        contourExtractor.ts
 * @description מאחד את מסלולי הציור לקונטור אחד, מזהה אם הוא סגור, ומדגם מחדש למרווח קשת אחיד.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה דגימה מחדש למרווח אחיד:
 * ציור חופשי מייצר צפיפות נקודות לא-אחידה (איטי = הרבה נקודות, מהיר = מעט) — ללא נרמול,
 * זיהוי פינות וסימטריה (§4.2, §4.4) היו מוטים כלפי אזורים עתירי-נקודות ולא כלפי הגאומטריה עצמה.
 *
 * למה נבחר path "ראשי" יחיד ולא איחוד כל המסלולים:
 * צורה שצוירה במספר משיכות (strokes) עדיין לא ממוזגת לקונטור טופולוגי אחד — זו בעיה גאומטרית
 * נפרדת (זיהוי חפיפות/חיבורי קצוות) שלא נפתרה כאן. Sprint 2 עובד על המסלול הדומיננטי (הכי הרבה
 * נקודות) כקירוב סביר; מיזוג רב-משיכות אמיתי הוא שיפור עתידי.
 */

import type { ShapeData, ShapePath, ShapePoint } from '@soundiform/shared';
import { at, distance } from './geometryUtils';

const DEFAULT_RESAMPLE_COUNT = 64;
/** מרחק (בטווח הנורמלי 0–1) שמתחתיו נקודת ההתחלה והסיום נחשבות "אותה נקודה" — קונטור סגור. */
const CLOSED_GAP_THRESHOLD = 0.05;
/** אורך קשת מתחתיו הצורה נחשבת מנוונת (נקודה בודדת בפועל) — מונע חלוקה באפס בדגימה מחדש. */
const MIN_MEANINGFUL_LENGTH = 1e-6;

export interface Contour {
  /** נקודות מדוגמות מחדש למרווח קשת אחיד. */
  points: ShapePoint[];
  closed: boolean;
}

/** ⭐ מיוצא — נצרך גם ע"י xAxisResample.ts (אותה בחירת-מסלול-דומיננטי, לא כפילות). */
export function pickPrimaryPath(paths: ShapePath[]): ShapePath {
  if (paths.length === 0) {
    throw new Error('extractContour: לצורה אין אף מסלול — קלט לא תקף');
  }
  return paths.reduce((longest, candidate) =>
    candidate.points.length > longest.points.length ? candidate : longest,
  );
}

/** ⭐ מיוצא — נצרך גם ע"י xAxisResample.ts (אותה הגדרת "כמעט-סגור"). */
export function isNearlyClosed(points: ShapePoint[]): boolean {
  if (points.length === 0) {
    return false;
  }
  return distance(at(points, 0), at(points, points.length - 1)) <= CLOSED_GAP_THRESHOLD;
}

/** אורך קשת מצטבר בכל נקודה, ואורך כולל. */
function computeCumulativeLengths(points: ShapePoint[]): { cumulative: number[]; total: number } {
  const cumulative = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(at(points, index - 1), at(points, index));
    cumulative.push(total);
  }
  return { cumulative, total };
}

function interpolate(a: ShapePoint, b: ShapePoint, t: number): ShapePoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pointAtArcLength(
  points: ShapePoint[],
  cumulative: number[],
  targetLength: number,
): ShapePoint {
  for (let index = 1; index < points.length; index += 1) {
    const segmentEnd = at(cumulative, index);
    if (targetLength > segmentEnd) {
      continue;
    }
    const segmentStart = at(cumulative, index - 1);
    const segmentLength = segmentEnd - segmentStart;
    const previous = at(points, index - 1);
    const current = at(points, index);
    const t =
      segmentLength < MIN_MEANINGFUL_LENGTH ? 0 : (targetLength - segmentStart) / segmentLength;
    return interpolate(previous, current, t);
  }
  return at(points, points.length - 1);
}

/** מדגם מחדש פוליליין (פתוח או סגור) ל-`count` נקודות במרווח קשת אחיד. */
function resamplePolyline(points: ShapePoint[], count: number, closed: boolean): ShapePoint[] {
  const firstPoint = at(points, 0);
  const workingPoints = closed ? [...points, firstPoint] : points;
  const { cumulative, total } = computeCumulativeLengths(workingPoints);

  if (total < MIN_MEANINGFUL_LENGTH) {
    return Array.from({ length: count }, () => ({ x: firstPoint.x, y: firstPoint.y }));
  }

  const denominator = closed ? count : Math.max(1, count - 1);
  return Array.from({ length: count }, (_, sampleIndex) => {
    const targetLength = (sampleIndex / denominator) * total;
    return pointAtArcLength(workingPoints, cumulative, targetLength);
  });
}

/**
 * מחלץ קונטור יחיד, מנורמל למרווח קשת אחיד, מתוך ShapeData.
 */
export function extractContour(
  shape: ShapeData,
  resampleCount: number = DEFAULT_RESAMPLE_COUNT,
): Contour {
  const primaryPath = pickPrimaryPath(shape.paths);
  const closed = primaryPath.closed || isNearlyClosed(primaryPath.points);
  const points = resamplePolyline(primaryPath.points, resampleCount, closed);
  return { points, closed };
}
