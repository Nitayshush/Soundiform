/**
 * @file        svgPathFlatten.ts
 * @description ⭐ מתמטיקה טהורה: פירסור path-data של SVG לרשימת נקודות (פוליליין), בלי DOM.
 *              משמש את svgToShapeData.ts. ראה PROJECT.md §11 (הערה ליד Sprint 2 — "מסלול raster
 *              עשוי לדרוש אלגוריתם וקטוריזציה נפרד מ-SVG שרק דורש פירסור path-data").
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ שרשור aToC()+qtToC()+normalizeST() הופך כל עקומה (קשת/quadratic/smooth) ל-cubic bezier
 * מפורש — כך שצריך לדעת לשטח (flatten) רק סוג עקומה אחד (C), לא חמישה. ראה svg-pathdata docs.
 *
 * ⚠️ מגבלות הגנתיות (קלט לא-סמוך — קובץ שהועלה ע"י משתמש, §8): מספר הנקודות/תת-מסלולים
 * מוגבל, כדי ש-SVG עוין (למשל d="..." ענק במיוחד) לא יגרום ל-DoS זיכרון/CPU בעיבוד.
 */

import { SVGPathData } from 'svg-pathdata';
import type { SVGCommand } from 'svg-pathdata';

export interface FlatPoint {
  x: number;
  y: number;
}

export interface FlatSubpath {
  points: FlatPoint[];
  closed: boolean;
}

/** נקודות לכל עקומת cubic bezier — מספיק לדגימה חלקה; extractContour ממילא מדגם מחדש ל-64 נק'. */
const BEZIER_SEGMENTS = 16;
export const MAX_POINTS_PER_SUBPATH = 5000;
export const MAX_SUBPATHS = 300;

function cubicPointAt(
  p0: FlatPoint,
  p1: FlatPoint,
  p2: FlatPoint,
  p3: FlatPoint,
  t: number,
): FlatPoint {
  const oneMinusT = 1 - t;
  const a = oneMinusT * oneMinusT * oneMinusT;
  const b = 3 * oneMinusT * oneMinusT * t;
  const c = 3 * oneMinusT * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function flattenCubic(p0: FlatPoint, p1: FlatPoint, p2: FlatPoint, p3: FlatPoint): FlatPoint[] {
  const points: FlatPoint[] = [];
  for (let step = 1; step <= BEZIER_SEGMENTS; step += 1) {
    points.push(cubicPointAt(p0, p1, p2, p3, step / BEZIER_SEGMENTS));
  }
  return points;
}

/**
 * מפרסר path-data (מאפיין d של <path>) לרשימת תת-מסלולים (M...Z מפריד ביניהם), עם כל עקומה
 * משוטחת לפוליליין. זורק אם הקלט חורג מהמגבלות ההגנתיות (§8 — קלט לא-סמוך).
 */
export function flattenPathData(d: string): FlatSubpath[] {
  const parsed = new SVGPathData(d).toAbs().normalizeST().qtToC().aToC();
  const commands = parsed.commands;

  const subpaths: FlatSubpath[] = [];
  let current: FlatPoint[] = [];
  let closed = false;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const pushCurrentSubpath = (): void => {
    if (current.length >= 2) {
      subpaths.push({ points: current, closed });
    }
  };

  /**
   * ⚠️ 2026-09-02: **חוצה-התקרה כבר לא זורק.** קודם קו בודד עם יותר מ-MAX_POINTS_PER_SUBPATH
   * נקודות הפיל את **כל ההעלאה** עם "File processing failed" — הודעה שהמשתמש לא יכול להבין,
   * ושהופיעה על כל צילום מפורט או סרוק (נמדד: תמונה רועשת ייצרה 14,667 פקודות בקו אחד).
   *
   * עכשיו הנקודות העודפות פשוט **לא נאספות**: הקו נשמר עד התקרה וההעלאה מצליחה. ⚠️ ההגנה
   * של §8 נשמרת במלואה — התקרה עדיין חוסמת את הזיכרון בדיוק כמו קודם, ההבדל היחיד הוא
   * שהיא מפסיקה לאסוף במקום להפיל. קו באורך כזה הוא ממילא רעש, לא צורה שהמשתמש התכוון אליה.
   */
  const appendPoint = (point: FlatPoint): void => {
    if (current.length >= MAX_POINTS_PER_SUBPATH) {
      return;
    }
    current.push(point);
  };

  for (const command of commands) {
    switch (command.type) {
      case SVGPathData.MOVE_TO: {
        pushCurrentSubpath();
        // ⚠️ 2026-09-02: מפסיק לאסוף במקום לזרוק — מאותה סיבה בדיוק כמו תקרת-הנקודות
        // למעלה. תמונה עשירה בפרטים מייצרת מאות קווים, ולזרוק את כל ההעלאה בגללם פירושו
        // שהמשתמש מקבל "File processing failed" על צילום תקין לחלוטין. ההגנה נשמרת: מספר
        // הקווים עדיין חסום, פשוט לא במחיר קריסה.
        if (subpaths.length >= MAX_SUBPATHS) {
          break;
        }
        cx = command.x;
        cy = command.y;
        sx = cx;
        sy = cy;
        current = [{ x: cx, y: cy }];
        closed = false;
        break;
      }
      case SVGPathData.LINE_TO: {
        cx = command.x;
        cy = command.y;
        appendPoint({ x: cx, y: cy });
        break;
      }
      case SVGPathData.HORIZ_LINE_TO: {
        cx = command.x;
        appendPoint({ x: cx, y: cy });
        break;
      }
      case SVGPathData.VERT_LINE_TO: {
        cy = command.y;
        appendPoint({ x: cx, y: cy });
        break;
      }
      case SVGPathData.CURVE_TO: {
        const flattened = flattenCubic(
          { x: cx, y: cy },
          { x: command.x1, y: command.y1 },
          { x: command.x2, y: command.y2 },
          { x: command.x, y: command.y },
        );
        for (const point of flattened) {
          appendPoint(point);
        }
        cx = command.x;
        cy = command.y;
        break;
      }
      case SVGPathData.CLOSE_PATH: {
        closed = true;
        cx = sx;
        cy = sy;
        break;
      }
      default: {
        // QUAD_TO/SMOOTH_*/ARC כבר הומרו ל-CURVE_TO ע"י aToC()/qtToC()/normalizeST() למעלה.
        assertUnreachableCommand(command);
      }
    }
  }
  pushCurrentSubpath();

  return subpaths;
}

function assertUnreachableCommand(command: SVGCommand): never {
  throw new Error(
    `svgPathFlatten: unexpected SVG command after normalization: ${JSON.stringify(command)}`,
  );
}
