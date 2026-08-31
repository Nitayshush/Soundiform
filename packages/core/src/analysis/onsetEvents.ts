/**
 * @file        onsetEvents.ts
 * @description ⭐ 2026-08-31 (מנגנון קצב): קובע **מתי** נפתחת מכה, במקום "בכל עמודה שהציור
 *              חוצה". זו השכבה שהופכת את הציור מזרם-צפיפות לקצב בעל אוצר-מילים.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה זה נולד.** הרסטר (boardRaster.ts) פותר *אילו תווים* זמינים בכל רגע, אבל המנגינה
 * נבנתה ממנו ע"י "תו חדש בכל פעם שהשורה משתנה". קו אלכסוני משנה שורה כמעט בכל עמודה, ולכן
 * כל ציור שנמתח על כל רוחב הלוח הפיק **16 מכות בכל בר, תמיד**. נמדד על 120 ציורים:
 * 100% מעמדות-הגריד מופעלות, בממוצע 16.3 תווים לבר. זה לא קצב — זה זרם רציף, ולכן שני
 * ציורים שונים נשמעו אותו דבר גם כשהגבהים היו שונים לגמרי.
 *
 * ⚠️ **הרעיון**: הגובה "מוחזק" לאורך זמן ומתעדכן רק כשקורה משהו — פינה, שיא/שפל, תחילת
 * משיכה, או נדידה של יותר מ-`driftRows` שורות. בין אלה התו מתמשך. קשת חלקה → מעט תווים
 * ארוכים. קו משונן → הרבה תווים קצרים. אותו ציור, קצב שנגזר ממנו באמת.
 *
 * ⚠️ סף-הנדידה הכרחי ולא "עוד פרמטר": בלעדיו קשת הייתה מחזיקה תו יחיד לאורך שינוי-גובה
 * גדול, כלומר תו **שגוי**. הוא מה שמאזן בין "לא להחליף תו בכל עמודה" ל"לא לשקר לגבי הגובה".
 */

import type { BoardRaster } from './boardRaster';

/**
 * שלושה "נתיבי-קול" בכל עמודה: התחתון, העליון, והאמצעי. ⚠️ לא אינדקס-מערך גולמי — מספר
 * השורות בעמודה משתנה (בעיגול: שתיים באמצע, אחת בקצוות), ואינדקס גולמי היה קופץ בין
 * קולות ומייצר מכות מזויפות. "התחתון" ו"העליון" יציבים תמיד.
 */
export const LANES = ['low', 'mid', 'high'] as const;
export type Lane = (typeof LANES)[number];

export interface OnsetEventOptions {
  /** נדידת-גובה (בשורות) שמעליה חייבים לפתוח תו חדש. */
  driftRows: number;
}

export interface EventRasterResult {
  /** רסטר "מדורג": הגובה מוחזק בין אירועים — מוזן לאותו extractRasterRuns כמו קודם. */
  raster: BoardRaster;
  /** עוצמת-האירוע בכל עמודה (0 = אין אירוע). משמש את מדיניות-התפקידים לבחור את החזקים. */
  strengthByColumn: number[];
  /** כמה אירועים היו בסך הכל — האות שממנו נגזרים הטמפו והחלוקה. */
  eventCount: number;
}

function laneRowAt(rows: readonly number[], lane: Lane): number | null {
  if (rows.length === 0) {
    return null;
  }
  if (lane === 'low') {
    return rows[0] ?? null;
  }
  if (lane === 'high') {
    return rows[rows.length - 1] ?? null;
  }
  return rows.length >= 3 ? (rows[Math.floor(rows.length / 2)] ?? null) : null;
}

/**
 * מדרגת נתיב יחיד: מחזירה את הגובה **המוחזק** בכל עמודה, ואת עוצמת האירוע בעמודות שבהן
 * הוא התחלף.
 */
function stepLane(
  laneRows: readonly (number | null)[],
  driftRows: number,
): { stepped: (number | null)[]; strength: number[] } {
  const stepped: (number | null)[] = new Array<number | null>(laneRows.length).fill(null);
  const strength = new Array<number>(laneRows.length).fill(0);

  let heldRow: number | null = null;
  let direction = 0;

  for (let column = 0; column < laneRows.length; column += 1) {
    const row = laneRows[column] ?? null;
    if (row === null) {
      // מרווח בציור — מרווח במוזיקה. התו הבא ייחשב תחילת-משיכה.
      heldRow = null;
      direction = 0;
      continue;
    }

    if (heldRow === null) {
      heldRow = row;
      strength[column] = 1; // תחילת משיכה — האירוע החזק ביותר.
      stepped[column] = heldRow;
      continue;
    }

    const delta = row - heldRow;
    const previous = laneRows[column - 1] ?? null;
    const localDirection = previous === null ? direction : Math.sign(row - previous);
    // שיא או שפל: הקו שינה כיוון. זו נקודת-מבטא טבעית בציור, ולכן גם במוזיקה.
    const isTurningPoint = localDirection !== 0 && direction !== 0 && localDirection !== direction;
    const hasDrifted = Math.abs(delta) >= driftRows;

    if (hasDrifted || isTurningPoint) {
      heldRow = row;
      // נדידה גדולה = מבטא חזק; נקודת-מפנה מקבלת רצפה משלה גם כשהיא קטנה.
      strength[column] = Math.min(
        1,
        Math.max(isTurningPoint ? 0.6 : 0, Math.abs(delta) / Math.max(1, driftRows * 2)),
      );
    }
    if (localDirection !== 0) {
      direction = localDirection;
    }
    stepped[column] = heldRow;
  }

  return { stepped, strength };
}

/**
 * בונה את רסטר-האירועים מהרסטר הגולמי.
 *
 * ⚠️ הפלט הוא **אותו טיפוס** BoardRaster, ולכן כל צרכני-הרסטר הקיימים (extractRasterRuns
 * וכל בוני-הטראקים) עובדים עליו בלי שינוי. השכבה הזו מוסיפה זמן, לא מושג חדש.
 */
export function buildEventRaster(
  raster: BoardRaster,
  options: OnsetEventOptions,
): EventRasterResult {
  const columnCount = raster.length;
  const strengthByColumn = new Array<number>(columnCount).fill(0);
  const steppedLanes: (number | null)[][] = [];

  for (const lane of LANES) {
    const laneRows = raster.map((rows) => laneRowAt(rows, lane));
    if (laneRows.every((row) => row === null)) {
      continue;
    }
    const { stepped, strength } = stepLane(laneRows, options.driftRows);
    steppedLanes.push(stepped);
    for (let column = 0; column < columnCount; column += 1) {
      strengthByColumn[column] = Math.max(strengthByColumn[column] ?? 0, strength[column] ?? 0);
    }
  }

  const result: number[][] = Array.from({ length: columnCount }, () => []);
  for (let column = 0; column < columnCount; column += 1) {
    const rows = new Set<number>();
    for (const lane of steppedLanes) {
      const row = lane[column];
      if (row !== null && row !== undefined) {
        rows.add(row);
      }
    }
    result[column] = [...rows].sort((a, b) => a - b);
  }

  return {
    raster: result,
    strengthByColumn,
    eventCount: strengthByColumn.filter((value) => value > 0).length,
  };
}
