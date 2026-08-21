/**
 * @file        useShapeCapture.ts
 * @description Hook ללכידת הצורה מה-DrawingCanvas כווקטור + חישוב shapeHash.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * זרימת הנתונים: עכבר/מגע → נקודות גולמיות מנורמלות (0–1) → Ramer–Douglas–Peucker
 * (מפחית רעש/צפיפות דגימה) → shapeStore (נשמר).
 *
 * ⭐ עדכון 2026-08-21: הוחלף paper.js Path.simplify() ב-RDP. הבעיה המקורית לא הייתה רק
 * "טולרנס גבוה מדי" (כפי שתוקן בסבב הקודם) — paper.js's simplify() הוא least-squares
 * Bézier curve-fit: הוא בונה מחדש את המסלול כעקומה חלקה עם *מעט* נקודות-עוגן+ידיות, לא
 * רק מסנן רעש. הקוד כאן שמר רק את `segment.point` (בלי הידיות), ו-DrawingCanvas.tsx מצייר
 * קווים ישרים בין הנקודות השרידות — כך שגם fit "נכון" נראה "מיושר" ברגע שמצטיירים קווים
 * ישרים בין נקודות-עוגן דלילות. RDP שונה מהותית: כל נקודה ששורדת יושבת (בטווח tolerance)
 * *על* המסלול המקורי במרחק ניצב מהקטע הנוכחי — לא בנייה-מחדש כעקומה — כך שציור-קווים-ישרים
 * בין הנקודות השרידות נשאר נאמן לצורה שצוירה בפועל, לא רק לצורות פוליגונליות עם פינות חדות.
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type { ShapePath, ShapePoint } from '@soundiform/shared';
import { useShapeStore } from '@/stores/shapeStore';

/**
 * טולרנס במרחק ניצב, בטווח הנורמלי (0–1) — כ-2px על קנבס ברוחב ~800px. RDP מבטיח שכל
 * נקודה שנמחקת הייתה בתוך המרחק הזה מהקו בין שכנותיה השרידות, אז זו סטייה בלתי-מורגשת,
 * לא "יישור" של תכונה אמיתית של הצורה.
 */
const SIMPLIFY_TOLERANCE = 0.0025;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function perpendicularDistance(
  point: ShapePoint,
  lineStart: ShapePoint,
  lineEnd: ShapePoint,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
  const projectedX = lineStart.x + t * dx;
  const projectedY = lineStart.y + t * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

/**
 * Ramer–Douglas–Peucker: מפשט פוליליין תוך שמירה על כל נקודה ששורדת *על* המסלול המקורי
 * (בטווח tolerance) — בניגוד לcurve-fit, אין כאן בנייה-מחדש של הצורה כעקומה חלקה.
 */
function simplifyRDP(points: readonly ShapePoint[], tolerance: number): ShapePoint[] {
  if (points.length < 3) {
    return [...points];
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return [...points];
  }

  let maxDistance = 0;
  let maxIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    if (!current) {
      continue;
    }
    const distance = perpendicularDistance(current, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyRDP(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyRDP(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function simplifyStroke(points: ShapePoint[], tolerance: number): ShapePoint[] {
  return simplifyRDP(points, tolerance).map((point) => ({
    x: clampUnit(point.x),
    y: clampUnit(point.y),
  }));
}

export interface UseShapeCaptureResult {
  /** מסלולים שהושלמו (מנורמלים, אחרי simplify) — נטענים/נשמרים דרך shapeStore. */
  paths: ShapePath[];
  /** נקודות המסלול הנוכחי בזמן ציור (לפני simplify — לפידבק חי, לא נשמר). */
  activeStrokePoints: ShapePoint[];
  isDrawing: boolean;
  /** hash דטרמיניסטי של הצורה הנוכחית, מתעדכן אחרי כל מסלול. null אם עדיין אין צורה. */
  shapeHash: string | null;
  beginStroke: (point: ShapePoint) => void;
  extendStroke: (point: ShapePoint) => void;
  endStroke: () => void;
  clear: () => void;
}

export function useShapeCapture(): UseShapeCaptureResult {
  const paths = useShapeStore((state) => state.paths);
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const addPath = useShapeStore((state) => state.addPath);
  const clearStore = useShapeStore((state) => state.clear);

  const [activeStrokePoints, setActiveStrokePoints] = useState<ShapePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const activeStrokeRef = useRef<ShapePoint[]>([]);

  const beginStroke = useCallback((point: ShapePoint) => {
    activeStrokeRef.current = [point];
    setIsDrawing(true);
    setActiveStrokePoints([point]);
  }, []);

  const extendStroke = useCallback((point: ShapePoint) => {
    activeStrokeRef.current = [...activeStrokeRef.current, point];
    setActiveStrokePoints(activeStrokeRef.current);
  }, []);

  const endStroke = useCallback(() => {
    const strokePoints = activeStrokeRef.current;
    activeStrokeRef.current = [];
    setIsDrawing(false);
    setActiveStrokePoints([]);

    if (strokePoints.length < 2) {
      return;
    }
    const simplifiedPoints = simplifyStroke(strokePoints, SIMPLIFY_TOLERANCE);
    addPath({ points: simplifiedPoints, closed: false });
  }, [addPath]);

  const clear = useCallback(() => {
    activeStrokeRef.current = [];
    setActiveStrokePoints([]);
    setIsDrawing(false);
    clearStore();
  }, [clearStore]);

  return {
    paths,
    activeStrokePoints,
    isDrawing,
    shapeHash,
    beginStroke,
    extendStroke,
    endStroke,
    clear,
  };
}
