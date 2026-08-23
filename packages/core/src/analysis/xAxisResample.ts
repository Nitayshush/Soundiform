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
 */

import type { ShapePoint } from '@soundiform/shared';
import { at } from '../internal/arrayUtils';

const MIN_X_RANGE = 1e-6;
const MIN_SEGMENT_WIDTH = 1e-9;

interface Anchor {
  value: number;
  index: number;
}

function interpolatedYValuesAtX(workingPoints: ShapePoint[], targetX: number): number[] {
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
 * טווח ה-X של הצורה. משמש לבניית pitchContour — "מה הצליל בכל רגע-זמן, סרוק משמאל לימין."
 */
export function resampleByX(points: ShapePoint[], closed: boolean, bucketCount: number): number[] {
  if (points.length === 0) {
    throw new Error('resampleByX: לצורה אין אף נקודה — קלט לא תקף');
  }

  const xs = points.map((point) => point.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xRange = maxX - minX;

  if (xRange < MIN_X_RANGE) {
    const averageY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    return Array.from({ length: bucketCount }, () => averageY);
  }

  const firstPoint = at(points, 0);
  const workingPoints = closed ? [...points, firstPoint] : points;
  const denominator = Math.max(1, bucketCount - 1);

  const rawSamples: (number | null)[] = Array.from({ length: bucketCount }, (_, index) => {
    const targetX = minX + (index / denominator) * xRange;
    const values = interpolatedYValuesAtX(workingPoints, targetX);
    if (values.length === 0) {
      return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });

  return fillGaps(rawSamples);
}
