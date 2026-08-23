/**
 * @file        shapeReveal.ts
 * @description ⭐ 2026-08-22 (§11): גיאומטריה טהורה ל"שרטוט מסונכרן" של הצורה המקורית בתוך
 *              הוידאו/פריוויו — הצורה מצטיירת בהדרגה, במקביל להתקדמות הניגון (progress 0–1),
 *              כאילו העט מצייר אותה מחדש. משמש גם ב-apps/worker (frameRenderer.ts, הוידאו
 *              המיוצא) וגם ב-apps/web (ScoreStaff.tsx, הפריוויו החי) — מודול אחד, בלי תלות
 *              ב-Pixi/canvas, כדי ש"פריוויו ≈ פלט סופי" יתקיים גם ויזואלית, לא רק שמיעתית.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ הקרנה לריבוע ממורכז: paths מנורמלים ל-0..1 בלי הנחת יחס-רוחב/גובה מסוים (הקנבס בו
 * צויר יכול להיות כל צורה) — כדי שלא יתעוותו כשהם מוקרנים לפריים בפורמט אחר (9:16/16:9/1:1),
 * מקרינים לריבוע הגדול ביותר שנכנס בפריים, ממורכז.
 *
 * ⚠️ מסלולים מחוברים בסדר הציור (path0 ואז path1...) — כל path סגור (closed) מקבל גם קטע
 * סגירה חזרה לנקודה הראשונה שלו. המשמעות: מסלולים נפרדים (כמה קווים שצוירו) מצטיירים אחד
 * אחרי השני, לא בו-זמנית — תואם את סדר הציור המקורי של המשתמש.
 */

import type { ShapeData, ShapePoint } from './ShapeData';

export interface FrameDimensions {
  width: number;
  height: number;
}

interface Segment {
  pathIndex: number;
  start: ShapePoint;
  end: ShapePoint;
  length: number;
  cumulativeLengthAtEnd: number;
}

export interface ShapeLayout {
  segments: Segment[];
  totalLength: number;
}

function projectPoint(point: ShapePoint, dimensions: FrameDimensions): ShapePoint {
  const squareSize = Math.min(dimensions.width, dimensions.height);
  const offsetX = (dimensions.width - squareSize) / 2;
  const offsetY = (dimensions.height - squareSize) / 2;
  return { x: offsetX + point.x * squareSize, y: offsetY + point.y * squareSize };
}

function distance(a: ShapePoint, b: ShapePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** מחשב את פריסת המקטעים (מוקרנים לפריים + אורך מצטבר) — פעם אחת לכל רינדור, לא לכל פריים. */
export function computeShapeLayout(shape: ShapeData, dimensions: FrameDimensions): ShapeLayout {
  const segments: Segment[] = [];
  let cumulativeLength = 0;

  shape.paths.forEach((path, pathIndex) => {
    const projected = path.points.map((point) => projectPoint(point, dimensions));
    const orderedPoints = path.closed ? [...projected, projected[0]] : projected;
    for (let i = 0; i < orderedPoints.length - 1; i += 1) {
      const start = orderedPoints[i];
      const end = orderedPoints[i + 1];
      if (!start || !end) {
        continue;
      }
      const length = distance(start, end);
      cumulativeLength += length;
      segments.push({ pathIndex, start, end, length, cumulativeLengthAtEnd: cumulativeLength });
    }
  });

  return { segments, totalLength: cumulativeLength };
}

/**
 * מחזיר, עבור progress נתון (0–1), את הפוליליינים החלקיים שכבר "צוירו" — קבוצה נפרדת
 * לכל path מקורי (כדי לצייר אותם כ-strokes נפרדים, לא קו אחד רציף ביניהם).
 */
export function revealedSegments(layout: ShapeLayout, progress: number): ShapePoint[][] {
  if (layout.totalLength === 0) {
    return [];
  }
  const targetLength = Math.max(0, Math.min(1, progress)) * layout.totalLength;
  const pathsById = new Map<number, ShapePoint[]>();

  for (const segment of layout.segments) {
    if (segment.cumulativeLengthAtEnd - segment.length >= targetLength) {
      break;
    }
    const points = pathsById.get(segment.pathIndex) ?? [];
    if (points.length === 0) {
      points.push(segment.start);
    }
    if (segment.cumulativeLengthAtEnd <= targetLength) {
      points.push(segment.end);
    } else {
      const segmentStartLength = segment.cumulativeLengthAtEnd - segment.length;
      const t = (targetLength - segmentStartLength) / segment.length;
      points.push({
        x: segment.start.x + (segment.end.x - segment.start.x) * t,
        y: segment.start.y + (segment.end.y - segment.start.y) * t,
      });
    }
    pathsById.set(segment.pathIndex, points);
  }

  return Array.from(pathsById.values());
}
