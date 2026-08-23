/**
 * @file        shapeReveal.ts
 * @description ⭐ 2026-08-23 (§4.2 תיקון, החליף את גרסת 2026-08-22 לגמרי): מקרין את הצורה
 *              המקורית **לתוך אותה מערכת-צירים של סרגל התווים עצמו** (X=זמן, Y=פובך) — לא
 *              לריבוע ממורכז עצמאי כמו הגרסה הקודמת. כל ציר מנורמל *בנפרד* לפי תיבת-התיחום
 *              (bounding box) של הצורה עצמה, בדיוק כמו ש-computeLayout/computeScoreLayout
 *              (ScoreStaff.tsx/frameRenderer.ts) כבר עושים לתווים עצמם (מתאימים את טווח-Y
 *              המוצג לטווח הפובך שבאמת נוצר) — כך שהצורה “נופלת” באותו מקום בערך שבו התווים
 *              שהיא ייצרה מוצגים, בלי לשמר יחס-רוחב/גובה (X באמת מייצג זמן על פני כל הקטע).
 *
 *              revealedSegments חושף לפי מיקום-X מול הסורק ("הסורק עובר") — לא לפי סדר-ציור
 *              (arc-length, כמו הגרסה הקודמת): לכל path, כל קטע שחוצה את סף ה-X מתחתך בדיוק
 *              בסף, וקטע יכול להישאר "חבוי" גם אם צויר מוקדם, אם ה-X שלו גדול מהסורק. צורה
 *              שחוצה את הסורק כמה פעמים (זיגזג/לולאה) יכולה לחשוף כמה תת-פוליליינים נפרדים
 *              בבת אחת — זה בכוונה.
 * @author      Soundiform
 * @created     2026-08-23
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { ShapeData, ShapePoint } from './ShapeData';

export interface FrameDimensions {
  width: number;
  height: number;
}

interface ProjectedPath {
  points: ShapePoint[];
  closed: boolean;
}

export interface ShapeLayout {
  paths: ProjectedPath[];
  width: number;
}

const MIN_SEGMENT_WIDTH = 1e-9;

/**
 * מקרין את כל נקודות הצורה למערכת-הצירים של הפריים: X ו-Y כל אחד מנורמל *בנפרד* לפי תיבת-
 * התיחום של הצורה (לא לפי 0..1 הגלובלי של קנבס הציור) — אותה פילוסופיית "התאמה לתוכן בפועל"
 * ש-computeLayout/computeScoreLayout כבר מיישמים על התווים עצמם.
 */
export function projectShapeToStaff(shape: ShapeData, dimensions: FrameDimensions): ShapeLayout {
  const allPoints = shape.paths.flatMap((path) => path.points);
  if (allPoints.length === 0) {
    return { paths: [], width: dimensions.width };
  }

  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  const projectPoint = (point: ShapePoint): ShapePoint => ({
    x: ((point.x - minX) / xRange) * dimensions.width,
    y: ((point.y - minY) / yRange) * dimensions.height,
  });

  return {
    paths: shape.paths.map((path) => ({
      points: path.points.map(projectPoint),
      closed: path.closed,
    })),
    width: dimensions.width,
  };
}

function interpolateAtX(a: ShapePoint, b: ShapePoint, targetX: number): ShapePoint {
  if (Math.abs(b.x - a.x) < MIN_SEGMENT_WIDTH) {
    return { x: targetX, y: a.y };
  }
  const t = (targetX - a.x) / (b.x - a.x);
  return { x: targetX, y: a.y + (b.y - a.y) * t };
}

function appendIfDistinct(polyline: ShapePoint[], point: ShapePoint): void {
  const last = polyline.at(-1);
  if (!last) {
    polyline.push(point);
    return;
  }
  if (last.x !== point.x || last.y !== point.y) {
    polyline.push(point);
  }
}

/** תת-הפוליליינים החשופים (X ≤ scanX) של path בודד — יכולים להיות כמה, לא רק אחד. */
function revealedSubPolylines(
  points: ShapePoint[],
  closed: boolean,
  scanX: number,
): ShapePoint[][] {
  const firstPoint = points[0];
  if (!firstPoint) {
    return [];
  }
  const workingPoints = closed ? [...points, firstPoint] : points;
  const result: ShapePoint[][] = [];
  let current: ShapePoint[] = [];

  const flush = (): void => {
    if (current.length >= 2) {
      result.push(current);
    }
    current = [];
  };

  for (let index = 0; index < workingPoints.length - 1; index += 1) {
    const a = workingPoints[index];
    const b = workingPoints[index + 1];
    if (!a || !b) {
      continue;
    }
    const aRevealed = a.x <= scanX;
    const bRevealed = b.x <= scanX;

    if (aRevealed && bRevealed) {
      appendIfDistinct(current, a);
      appendIfDistinct(current, b);
    } else if (aRevealed && !bRevealed) {
      appendIfDistinct(current, a);
      appendIfDistinct(current, interpolateAtX(a, b, scanX));
      flush();
    } else if (!aRevealed && bRevealed) {
      flush();
      appendIfDistinct(current, interpolateAtX(a, b, scanX));
      appendIfDistinct(current, b);
    }
  }
  flush();
  return result;
}

/**
 * מחזיר, עבור progress נתון (0–1), את כל תת-הפוליליינים שנמצאים משמאל לקו הסורק
 * (scanX = progress * layout.width) — בלי קשר לסדר שבו הצורה צוירה.
 */
export function revealedSegments(layout: ShapeLayout, progress: number): ShapePoint[][] {
  const scanX = Math.max(0, Math.min(1, progress)) * layout.width;
  return layout.paths.flatMap((path) => revealedSubPolylines(path.points, path.closed, scanX));
}
