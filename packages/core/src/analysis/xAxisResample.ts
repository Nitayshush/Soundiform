/**
 * @file        xAxisResample.ts
 * @description ⭐ 2026-08-23 (§4.2 תיקון): מדגם מחדש את הצורה לפי מיקום-X ("הסורק עובר משמאל
 *              לימין"), לא לפי סדר-המכחול (arc-length, כמו contourExtractor.ts) — זה מה
 *              שבאמת הופך "ציר X → זמן" (§4.2) לנכון, במקום "סדר-ציור → זמן" שהיה בפועל.
 *              נצרך רק ע"י geometryToMusic.ts's pitchContour; extractContour.ts (arc-length)
 *              נשאר ללא שינוי ומשמש את shapeAnalyzer/symmetryDetector — אלה צריכים נאמנות
 *              גאומטרית אמיתית, לא פרשנות-ציר-זמן.
 * @author      Soundiform
 * @created     2026-08-23
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ צורה שמתפתלת וחוזרת על אותו X (מעגל, צורה סגורה) — כמה חיתוכים על אותו X נחשפים
 * וממוצעים (סוכם עם Nitay: ממוצע, לא רק "הענף הראשון שצויר"). קטע X שאף מקטע-קו לא חוצה
 * (ריצה כמעט-אנכית) מקבל אינטרפולציה ליניארית מהעוגנים המוגדרים הקרובים ביותר — פלט תמיד
 * מערך מלא ללא "חורים".
 *
 * ⭐ 2026-08-23: תומך בכמה paths בו-זמנית (לא רק ה-path הדומיננטי) — כל משיכת-עט נוספת
 * שהמשתמש מצייר צריכה להשפיע על המלודיה, לא רק על התצוגה החזותית (ראה geometryToMusic.ts).
 * ה-paths *לא* מחוברים לפוליליין אחד (זה היה יוצר קטע-חיבור מזויף בין שתי משיכות נפרדות) —
 * כל path נשאר עצמאי (כולל סגירה משלו אם closed), ורק החיתוכים-על-אותו-X שלהם מאוחדים יחד
 * לפני ממוצע, בדיוק כמו האיחוד בין שני ענפים של אותה צורה סגורה.
 */

import type { ShapePoint } from '@soundiform/shared';
import { at } from '../internal/arrayUtils';

const MIN_X_RANGE = 1e-6;
const MIN_SEGMENT_WIDTH = 1e-9;

export interface ResamplePath {
  points: ShapePoint[];
  closed: boolean;
}

interface Anchor {
  value: number;
  index: number;
}

function interpolatedYValuesAtXAlongPath(workingPoints: ShapePoint[], targetX: number): number[] {
  const values: number[] = [];
  for (let index = 1; index < workingPoints.length; index += 1) {
    const a = at(workingPoints, index - 1);
    const b = at(workingPoints, index);
    if (Math.abs(b.x - a.x) < MIN_SEGMENT_WIDTH) {
      continue;
    }
    const segmentMinX = Math.min(a.x, b.x);
    const segmentMaxX = Math.max(a.x, b.x);
    if (targetX < segmentMinX || targetX > segmentMaxX) {
      continue;
    }
    const t = (targetX - a.x) / (b.x - a.x);
    values.push(a.y + (b.y - a.y) * t);
  }
  return values;
}

function workingPointsFor(path: ResamplePath): ShapePoint[] {
  const firstPoint = path.points[0];
  if (!firstPoint) {
    return path.points;
  }
  return path.closed ? [...path.points, firstPoint] : path.points;
}

/** מאחד את חיתוכי-ה-X של כל ה-paths בנקודה נתונה — כל path נבדק בנפרד, לא מחובר לשכנו. */
function interpolatedYValuesAtX(paths: readonly ResamplePath[], targetX: number): number[] {
  return paths.flatMap((path) => interpolatedYValuesAtXAlongPath(workingPointsFor(path), targetX));
}

function interpolateFromAnchors(anchors: readonly Anchor[], index: number): number {
  const before = [...anchors].reverse().find((anchor) => anchor.index < index);
  const after = anchors.find((anchor) => anchor.index > index);
  if (!before) {
    return at(after ? [after] : anchors, 0).value;
  }
  if (!after) {
    return before.value;
  }
  const t = (index - before.index) / (after.index - before.index);
  return before.value + (after.value - before.value) * t;
}

/** ממלא ערכי null (buckets ללא חיתוך) באינטרפולציה מהעוגנים המוגדרים הקרובים ביותר. */
function fillGaps(samples: readonly (number | null)[]): number[] {
  const anchors: Anchor[] = [];
  samples.forEach((value, index) => {
    if (value !== null) {
      anchors.push({ value, index });
    }
  });
  if (anchors.length === 0) {
    return samples.map(() => 0);
  }
  return samples.map((value, index) => value ?? interpolateFromAnchors(anchors, index));
}

/**
 * מדגם מחדש `bucketCount` ערכי Y, שווי-מרווח לפי X (לא לפי אורך-קשת/סדר-ציור), לאורך כל
 * טווח ה-X המשולב של *כל* ה-paths שמועברים. משמש לבניית pitchContour — "מה הצליל בכל
 * רגע-זמן, סרוק משמאל לימין" — כל משיכת-עט תורמת את החלק שלה, לפי מיקומה על ה-X.
 */
export function resampleByX(paths: readonly ResamplePath[], bucketCount: number): number[] {
  const allPoints = paths.flatMap((path) => path.points);
  if (allPoints.length === 0) {
    throw new Error('resampleByX: לצורה אין אף נקודה — קלט לא תקף');
  }

  const xs = allPoints.map((point) => point.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xRange = maxX - minX;

  if (xRange < MIN_X_RANGE) {
    const averageY = allPoints.reduce((sum, point) => sum + point.y, 0) / allPoints.length;
    return Array.from({ length: bucketCount }, () => averageY);
  }

  const denominator = Math.max(1, bucketCount - 1);

  const rawSamples: (number | null)[] = Array.from({ length: bucketCount }, (_, index) => {
    const targetX = minX + (index / denominator) * xRange;
    const values = interpolatedYValuesAtX(paths, targetX);
    if (values.length === 0) {
      return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });

  return fillGaps(rawSamples);
}
