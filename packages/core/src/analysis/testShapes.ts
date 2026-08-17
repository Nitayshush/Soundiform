/**
 * @file        testShapes.ts
 * @description צורות ידועות (עיגול, משולש, ריבוע) לבדיקות יחידה — §11 Sprint 2. פנימי, לא מיוצא מ-index.ts.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { ShapeData, ShapePoint } from '@shape-sound/shared';

function makeClosedShape(points: ShapePoint[]): ShapeData {
  return { version: '1.0.0', paths: [{ points, closed: true }] };
}

export function makeSquareShapeData(
  center: ShapePoint = { x: 0.5, y: 0.5 },
  halfSize = 0.3,
): ShapeData {
  const { x: cx, y: cy } = center;
  return makeClosedShape([
    { x: cx - halfSize, y: cy - halfSize },
    { x: cx + halfSize, y: cy - halfSize },
    { x: cx + halfSize, y: cy + halfSize },
    { x: cx - halfSize, y: cy + halfSize },
  ]);
}

/**
 * משולש שווה-צלעות, קודקוד עליון (apex up) — סימטרי שמאל-ימין (horizontalMirror) אך לא
 * למעלה-למטה, סימטריה סיבובית מסדר 3. זווית θ נמדדת בכיוון השעון מ"מעלה" (y גדל כלפי מטה).
 */
export function makeTriangleShapeData(
  center: ShapePoint = { x: 0.5, y: 0.5 },
  radius = 0.3,
): ShapeData {
  const { x: cx, y: cy } = center;
  const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  const points = angles.map((theta) => ({
    x: cx + radius * Math.sin(theta),
    y: cy - radius * Math.cos(theta),
  }));
  return makeClosedShape(points);
}

export function makeCircleShapeData(
  center: ShapePoint = { x: 0.5, y: 0.5 },
  radius = 0.3,
  pointCount = 96,
): ShapeData {
  const points = Array.from({ length: pointCount }, (_, index) => {
    const theta = (index / pointCount) * 2 * Math.PI;
    return { x: center.x + radius * Math.cos(theta), y: center.y + radius * Math.sin(theta) };
  });
  return makeClosedShape(points);
}

/** צורה אסימטרית לחלוטין — משמשת לוודא שהמנוע לא "מוצא" סימטריה שלא קיימת. */
export function makeAsymmetricShapeData(): ShapeData {
  return makeClosedShape([
    { x: 0.2, y: 0.3 },
    { x: 0.8, y: 0.25 },
    { x: 0.65, y: 0.7 },
    { x: 0.5, y: 0.55 },
    { x: 0.3, y: 0.85 },
  ]);
}

/**
 * "רעש יד" דטרמיניסטי (לא Math.random — כדי שבדיקות יחזרו על עצמן זהות) המדמה רעד/אי-דיוק
 * של ציור חופשי אמיתי. משתמש בטריק pseudo-noise נפוץ (sin של מקדם גדול) ולא ב-RNG אמיתי.
 */
function addHandDrawnJitter(points: ShapePoint[], amplitude: number): ShapePoint[] {
  return points.map((point, index) => ({
    x: point.x + amplitude * Math.sin(index * 12.9898),
    y: point.y + amplitude * Math.cos(index * 78.233),
  }));
}

/** עיגול עם רעש-יד קל — מוודא שזיהוי הסימטריה סובלני לציור אמיתי, לא רק לגאומטריה מושלמת. */
export function makeHandDrawnCircleShapeData(
  center: ShapePoint = { x: 0.5, y: 0.5 },
  radius = 0.3,
  pointCount = 96,
  jitterAmplitude = 0.01,
): ShapeData {
  const [primaryPath] = makeCircleShapeData(center, radius, pointCount).paths;
  if (!primaryPath) {
    throw new Error('unreachable: makeCircleShapeData() always has one path');
  }
  return makeClosedShape(addHandDrawnJitter(primaryPath.points, jitterAmplitude));
}
