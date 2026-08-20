/**
 * @file        useShapeCapture.ts
 * @description Hook ללכידת הצורה מה-DrawingCanvas כווקטור + חישוב shapeHash.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * זרימת הנתונים: עכבר/מגע → נקודות גולמיות מנורמלות (0–1) → paper.js Path.simplify()
 * (מפחית רעש/צפיפות דגימה, ⭐ "ייצוא הצורה כווקטור" ב-§11 Sprint 1) → shapeStore (נשמר).
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type PaperScopeType from 'paper';
import type { ShapePath, ShapePoint } from '@soundiform/shared';
import { useShapeStore } from '@/stores/shapeStore';

/**
 * טולרנס בטווח הנורמלי (0–1). ⚠️ 0.003 המקורי היה גבוה מדי בפועל: paper.js Path.simplify()
 * הוא curve-fit של Schneider (least-squares Bézier), לא סינון-רעש — בטולרנס הזה הוא היה
 * מיישר פינות אמיתיות שהמשתמש צייר, לא רק מנקה רעש דגימה מהעכבר/מגע. הורד ל-0.0007 כך
 * שרק רעש תת-פיקסלי בין דגימות עוקבות נמחק, לא תכונות מכוונות של הצורה.
 */
const SIMPLIFY_TOLERANCE = 0.0007;

let paperScopePromise: Promise<typeof PaperScopeType> | null = null;
let isPaperInitialized = false;

/**
 * טוען את paper.js דינמית, רק בדפדפן, רק כשבאמת מסיימים מסלול.
 * למה לא ייבוא סטטי בראש הקובץ: paper.js מזהה סביבת Node (SSR של Next.js) ומנסה לטעון
 * שכבת חיקוי מבוססת jsdom — שלא מותקנת אצלנו בכוונה (לא צריך רינדור אמיתי, רק מתמטיקה וקטורית).
 * ייבוא דינמי, שמופעל רק מתוך מאזין אירוע בדפדפן, לעולם לא רץ בזמן SSR.
 */
function loadPaper(): Promise<typeof PaperScopeType> {
  paperScopePromise ??= import('paper').then((paperModule) => paperModule.default);
  return paperScopePromise;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

async function simplifyStroke(points: ShapePoint[], tolerance: number): Promise<ShapePoint[]> {
  const paper = await loadPaper();
  if (!isPaperInitialized) {
    paper.setup([1, 1]);
    isPaperInitialized = true;
  }
  const path = new paper.Path();
  for (const point of points) {
    path.add(point);
  }
  path.simplify(tolerance);
  const simplifiedPoints = path.segments.map((segment) => ({
    x: clampUnit(segment.point.x),
    y: clampUnit(segment.point.y),
  }));
  path.remove();
  return simplifiedPoints;
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
    simplifyStroke(strokePoints, SIMPLIFY_TOLERANCE)
      .then((simplifiedPoints) => {
        addPath({ points: simplifiedPoints, closed: false });
      })
      .catch((error: unknown) => {
        // אין UI לשגיאות עדיין — לפחות לא נבלע בשקט (§0.3/§0.4).
        console.error('useShapeCapture: simplifyStroke נכשל', error);
      });
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
