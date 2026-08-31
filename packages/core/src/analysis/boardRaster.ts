/**
 * @file        boardRaster.ts
 * @description ⭐ 2026-08-31 (הסורק מנגן את מה שהציור עובר עליו): צורב את הציור על רשת
 *              הלוח — לכל עמודת-זמן, **אילו שורות-תווים הקו באמת חוצה**. זה מחליף את
 *              "ערך-Y יחיד לעמודה" (xAxisResample.ts) בתור המקור למנגינה.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה זה נולד.** resampleByX מחזיר Y **אחד** לעמודה, ולכן הוא חייב למצע כשהצורה חוצה
 * את אותו X כמה פעמים. לצורה סגורה יש תמיד שני חיתוכים (קצה עליון ותחתון), והממוצע שלהם
 * הוא קו-האמצע — שלצורה סימטריה אנכית הוא **ישר לגמרי**. נמדד: עיגול, ריבוע ואליפסה
 * מייצרים span=0.000, כלומר תו בודד שחוזר על עצמו לאורך כל היצירה. גם שתי משיכות-עט
 * נפרדות (גבוהה ונמוכה) התבטלו זו את זו לתו האמצעי שהמשתמש כלל לא צייר.
 * כאן אין ערך יחיד ולכן אין מה למצע — הסיבה לבאג מתבטלת, לא מתוקנת בטלאי.
 *
 * ⚠️ **הליכה על מקטעים, לא דגימת נקודות.** דגימת X-ים קבועים (כמו resampleByX) מפספסת קו
 * כמעט-אנכי שנופל *בין* שתי דגימות. כאן עוברים על כל מקטע-קו בצעדים קטנים מספיק כדי שלא
 * לדלג על אף עמודה ואף שורה — ולכן כל תא שהקו חוצה בפועל מסומן, וזו בדיוק ההבטחה למשתמש.
 */

import type { ShapePoint } from '@soundiform/shared';
import { quantizeYToRowIndex } from '../theory/noteBoard';
import { at } from '../internal/arrayUtils';

/** מתחת לזה הצורה נחשבת חסרת-רוחב — ראה rasterizeShapeToBoard. */
const MIN_X_RANGE = 1e-6;

export interface RasterPath {
  points: readonly ShapePoint[];
  closed: boolean;
}

/** לכל עמודת-זמן, אינדקסי-השורות שנחצו — ממוינים מהנמוך לגבוה, בלי כפילויות. */
export type BoardRaster = readonly (readonly number[])[];

export interface BoardRasterOptions {
  rowCount: number;
  columnCount: number;
  /** תקרת תווים בו-זמנית בעמודה אחת — ראה limitVoices. */
  maxVoicesPerColumn: number;
}

function toColumn(x: number, minX: number, xRange: number, columnCount: number): number {
  const normalized = (x - minX) / xRange;
  const column = Math.round(normalized * (columnCount - 1));
  return Math.min(columnCount - 1, Math.max(0, column));
}

/**
 * מדללת עמודה שחורגת מהתקרה. ⚠️ שומרת תמיד את **הקצה העליון והתחתון** ורק מדללת את
 * האמצע: הקצוות הם מה שנושא את צורת הציור (הם הגבול העליון והתחתון של מה שצויר), ודילול
 * אחיד היה יכול להשמיט דווקא אותם ולשטח את הצורה בחזרה — בדיוק הכשל שהקובץ הזה נועד למנוע.
 * קו אנכי, שחוצה את כל השורות, הופך כך לאקורד פרוס ולא למקשה של 15 תווים.
 */
function limitVoices(rows: readonly number[], maxVoices: number): number[] {
  if (rows.length <= maxVoices) {
    return [...rows];
  }
  if (maxVoices <= 1) {
    return [at(rows, 0)];
  }
  if (maxVoices === 2) {
    return [at(rows, 0), at(rows, rows.length - 1)];
  }
  const kept = new Set<number>([at(rows, 0), at(rows, rows.length - 1)]);
  const interiorSlots = maxVoices - 2;
  for (let slot = 1; slot <= interiorSlots; slot += 1) {
    const position = Math.round((slot * (rows.length - 1)) / (interiorSlots + 1));
    kept.add(at(rows, position));
  }
  return [...kept].sort((a, b) => a - b);
}

/**
 * צורבת את כל ה-paths על רשת הלוח.
 *
 * @returns מערך באורך columnCount; עמודה שהציור לא עובר עליה כלל מקבלת מערך ריק (שקט
 *          אמיתי — לא "התו הקודם נמשך", וזו החלטה: מרווח בציור הוא מרווח במוזיקה).
 */
export function rasterizeShapeToBoard(
  paths: readonly RasterPath[],
  options: BoardRasterOptions,
): BoardRaster {
  const { rowCount, columnCount, maxVoicesPerColumn } = options;
  const columns: Set<number>[] = Array.from({ length: columnCount }, () => new Set<number>());

  const allPoints = paths.flatMap((path) => [...path.points]);
  if (allPoints.length === 0) {
    return columns.map(() => []);
  }

  const xs = allPoints.map((point) => point.x);
  const minX = Math.min(...xs);
  const xRange = Math.max(...xs) - minX;

  // ⚠️ ציור חסר-רוחב (קו אנכי מושלם) — אין ציר-זמן לפרוס עליו. כל השורות שנחצו מושמעות
  // בכל עמודה, כלומר אקורד מוחזק. זו הפרשנות היחידה שלא ממציאה תנועה שלא צוירה.
  if (xRange < MIN_X_RANGE) {
    const rows = [
      ...new Set(allPoints.map((point) => quantizeYToRowIndex(point.y, rowCount))),
    ].sort((a, b) => a - b);
    const limited = limitVoices(rows, maxVoicesPerColumn);
    return columns.map(() => [...limited]);
  }

  for (const path of paths) {
    // path סגור נסגר כאן במפורש (הנקודה הראשונה נוספת בסוף) — אחרת המקטע האחרון, שהוא
    // בדיוק החצי התחתון של עיגול, לא היה נצרב בכלל.
    const walkPoints =
      path.closed && path.points[0] ? [...path.points, path.points[0]] : path.points;
    for (let index = 1; index < walkPoints.length; index += 1) {
      const from = at(walkPoints, index - 1);
      const to = at(walkPoints, index);
      const fromColumn = toColumn(from.x, minX, xRange, columnCount);
      const toColumnIndex = toColumn(to.x, minX, xRange, columnCount);
      const fromRow = quantizeYToRowIndex(from.y, rowCount);
      const toRow = quantizeYToRowIndex(to.y, rowCount);
      // מספיק צעדים כדי לא לדלג על אף תא — הצעד הגדול מבין השניים קובע.
      const steps = Math.max(Math.abs(toColumnIndex - fromColumn), Math.abs(toRow - fromRow), 1);
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const column = toColumn(from.x + (to.x - from.x) * t, minX, xRange, columnCount);
        const row = quantizeYToRowIndex(from.y + (to.y - from.y) * t, rowCount);
        columns[column]?.add(row);
      }
    }
  }

  return columns.map((rows) =>
    limitVoices(
      [...rows].sort((a, b) => a - b),
      maxVoicesPerColumn,
    ),
  );
}
