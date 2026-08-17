/**
 * @file        shapeAnalyzer.ts
 * @description מחלץ מאפיינים גאומטריים מקונטור: מרכז מסה, bounding box, שטח, היקף, קודקודים.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה זיהוי פינות מבוסס זווית-סיבוב (turning angle) ולא Douglas-Peucker:
 * אנחנו כבר מדגמים מחדש למרווח קשת אחיד ב-contourExtractor — על קלט אחיד, זווית הפניה בין
 * וקטור נכנס ליוצא בכל נקודה היא מדד ישיר וזול ל"חדות" (§4.2: זווית חדה = אטאק/סטקטו).
 */

import type { ShapePoint } from '@shape-sound/shared';
import type { Contour } from './contourExtractor';
import { at, averagePoint } from './geometryUtils';

/** מעל הסף הזה (רדיאנים) נקודה נחשבת מועמדת-פינה. ~25° — סינון רעש דגימה בלי לפספס זוויות אמיתיות. */
const CORNER_ANGLE_THRESHOLD_RAD = (25 * Math.PI) / 180;
/** מרווח (במדדי נקודות) לחישוב וקטור הכיוון — קטן מדי רועש, גדול מדי מטשטש פינות סמוכות. */
const DIRECTION_WINDOW = 2;
/** מרחק (במדדי נקודות) לדיכוי מקסימום-מקומי — ממזג מועמדי-פינה סמוכים לפינה אחת. */
const NON_MAX_SUPPRESSION_WINDOW = 3;

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ShapeFeatures {
  centerOfMass: ShapePoint;
  boundingBox: BoundingBox;
  /** שטח לפי נוסחת Shoelace. 0 עבור קונטור פתוח (לא מוגדר גאומטרית). */
  area: number;
  perimeter: number;
  /** מספר פינות שזוהו — למשולש ≈3, לריבוע ≈4, לעיגול ≈0 (§4.2). */
  vertexCount: number;
  closed: boolean;
}

function computeBoundingBox(points: ShapePoint[]): BoundingBox {
  return points.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      minY: Math.min(box.minY, point.y),
      maxX: Math.max(box.maxX, point.x),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

/** שטח לפי Shoelace formula — נכון רק עבור פוליגון סגור. */
function computeSignedArea(points: ShapePoint[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = at(points, index);
    const next = at(points, (index + 1) % points.length);
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

/** מרכז מסה של פוליגון סגור (משוקלל-שטח) — מדויק יותר מממוצע נקודות פשוט. */
function computePolygonCentroid(points: ShapePoint[], signedArea: number): ShapePoint {
  if (Math.abs(signedArea) < 1e-9) {
    return averagePoint(points);
  }
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = at(points, index);
    const next = at(points, (index + 1) % points.length);
    const cross = current.x * next.y - next.x * current.y;
    cx += (current.x + next.x) * cross;
    cy += (current.y + next.y) * cross;
  }
  const factor = 1 / (6 * signedArea);
  return { x: cx * factor, y: cy * factor };
}

function computePerimeter(points: ShapePoint[], closed: boolean): number {
  let total = 0;
  const limit = closed ? points.length : points.length - 1;
  for (let index = 0; index < limit; index += 1) {
    const current = at(points, index);
    const next = at(points, (index + 1) % points.length);
    total += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return total;
}

function turningAngle(previous: ShapePoint, current: ShapePoint, next: ShapePoint): number {
  const incoming = Math.atan2(current.y - previous.y, current.x - previous.x);
  const outgoing = Math.atan2(next.y - current.y, next.x - current.x);
  let diff = outgoing - incoming;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff);
}

function countVertices(points: ShapePoint[], closed: boolean): number {
  const count = points.length;
  if (count < 2 * DIRECTION_WINDOW + 1) {
    return 0;
  }

  const angles = points.map((_, index) => {
    const isEdgePoint = !closed && (index < DIRECTION_WINDOW || index >= count - DIRECTION_WINDOW);
    if (isEdgePoint) {
      return 0;
    }
    const previousIndex = (index - DIRECTION_WINDOW + count) % count;
    const nextIndex = (index + DIRECTION_WINDOW) % count;
    return turningAngle(at(points, previousIndex), at(points, index), at(points, nextIndex));
  });

  let vertexCount = 0;
  for (let index = 0; index < count; index += 1) {
    const angle = at(angles, index);
    if (angle < CORNER_ANGLE_THRESHOLD_RAD) {
      continue;
    }
    const isLocalMaximum = isLocalMaximumAngle(angles, index, closed);
    if (isLocalMaximum) {
      vertexCount += 1;
    }
  }
  return vertexCount;
}

function isLocalMaximumAngle(angles: number[], index: number, closed: boolean): boolean {
  const count = angles.length;
  const currentAngle = at(angles, index);
  for (
    let offset = -NON_MAX_SUPPRESSION_WINDOW;
    offset <= NON_MAX_SUPPRESSION_WINDOW;
    offset += 1
  ) {
    if (offset === 0) {
      continue;
    }
    const neighborIndex = closed ? (index + offset + count) % count : index + offset;
    if (neighborIndex < 0 || neighborIndex >= count) {
      continue;
    }
    if (at(angles, neighborIndex) > currentAngle) {
      return false;
    }
  }
  return true;
}

export function analyzeShape(contour: Contour): ShapeFeatures {
  const { points, closed } = contour;
  const signedArea = closed ? computeSignedArea(points) : 0;
  const centerOfMass = closed ? computePolygonCentroid(points, signedArea) : averagePoint(points);

  return {
    centerOfMass,
    boundingBox: computeBoundingBox(points),
    area: Math.abs(signedArea),
    perimeter: computePerimeter(points, closed),
    vertexCount: countVertices(points, closed),
    closed,
  };
}
