/**
 * @file        progression.ts
 * @description ⭐ 2026-08-31 (סבב ב'): נותן להרמוניה **כיוון** — קדנצה בסוף כל סקשן.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה זה נולד.** הדרגות ההרמוניות נגזרות מהציור לכל בר, וזה נותן גיוון — אבל **לא
 * נותן כיוון**. נמדד בסינמטי: הפאד התחלף בין שני צבירים לנצח, בלי שום תחושת התקדמות או
 * סגירה. רוב הרגש במוזיקה מערבית מגיע ממתח שנבנה ונפתר, והמימוש המינימלי שלו הוא קדנצה:
 * דומיננטה (V) שנפתרת לטוניקה (I).
 *
 * ⚠️ **המחיר, במפורש**: שני ברים בכל סקשן מפסיקים להיות נגזרים מהציור. זו חריגה מכוונת
 * מ"הציור קובע הכל", באותה משפחה של הדגשות-הפעימה והקוונטיזציה — הציור קובע *מה*, התיאוריה
 * דואגת שהמשפט **ייסגר**. סקשן קצר מדי (בר אחד) לא נוגעים בו בכלל: אין בו מקום למתח ופתרון,
 * וכפיית טוניקה שם רק הייתה מוחקת את הציור בלי לתת שום תמורה.
 */

import type { Section } from '../score/MusicalScore';
import { at } from '../internal/arrayUtils';

/** דרגת הטוניקה (I) — מרכז הכובד שאליו הכל נפתר. */
export const TONIC_DEGREE = 0;
/** דרגת הדומיננטה (V) — הצליל שיוצר את הציפייה לטוניקה. */
export const DOMINANT_DEGREE = 4;

/** מתחת לזה אין מקום אפילו לסגירה, ולכן לא נוגעים בסקשן בכלל. */
const MIN_BARS_FOR_CADENCE = 2;

/**
 * ⚠️ **הדומיננטה נוספת רק לסקשן ארוך מספיק.** נתפס בבדיקה: בסקשן של 2 ברים, V→I תופס
 * **100%** מהסקשן — כלומר הציור נמחק לגמרי ושני ציורים שונים הפיקו בדיוק אותה פרוגרסיה.
 * הקדנצה אמורה לתת כיוון למשפט, לא להחליף אותו. מ-4 ברים ומעלה היא לכל היותר חצי, ולכן
 * שם מותר גם להכין את הפתרון; בסקשן קצר מסתפקים בסגירה על הטוניקה בלבד.
 */
const MIN_BARS_FOR_DOMINANT = 4;

/**
 * מחזיר עותק של הדרגות שבו כל סקשן נסגר ב-V→I.
 *
 * @param degrees  דרגה לכל בר ביצירה, נגזרת מהציור.
 * @param sections חלוקת היצירה לסקשנים (intro/loop/build/outro).
 */
export function applyCadences(degrees: readonly number[], sections: readonly Section[]): number[] {
  const result = [...degrees];

  for (const section of sections) {
    if (section.lengthBars < MIN_BARS_FOR_CADENCE) {
      continue;
    }
    const lastBar = section.startBar + section.lengthBars - 1;
    if (lastBar < result.length) {
      result[lastBar] = TONIC_DEGREE;
    }
    const dominantBar = lastBar - 1;
    if (
      section.lengthBars >= MIN_BARS_FOR_DOMINANT &&
      dominantBar >= section.startBar &&
      dominantBar < result.length
    ) {
      result[dominantBar] = DOMINANT_DEGREE;
    }
  }

  return result;
}

/**
 * ⚠️ הדרגה שהציור נתן היא נקודת-מוצא, לא ערך סופי: `% 7` כבר קיפל אותה לאוקטבה אחת
 * (ראה buildAbsoluteBoardProgressionDegrees), וכאן רק מוודאים שהיא חוקית גם אחרי הקדנצה.
 */
export function normalizeDegree(degree: number): number {
  return ((degree % 7) + 7) % 7;
}

/** הדרגה של בר נתון, עם נפילה בטוחה לטוניקה כשהמערך קצר מהצפוי. */
export function degreeAtBar(degrees: readonly number[], barIndex: number): number {
  if (degrees.length === 0) {
    return TONIC_DEGREE;
  }
  return normalizeDegree(at(degrees, Math.min(barIndex, degrees.length - 1)));
}

/**
 * דרגה הרמונית לכל בר, נגזרת מ**הרסטר** — כלומר ממה שהציור באמת מכסה.
 *
 * ⚠️ **תיקון 2026-08-31 (סבב ב').** קודם הדרגות נגזרו מ-`intent.pitchContour`, וזה **אותו
 * מתאר ממוצע שקורס לקו ישר בכל צורה סגורה** — הבאג שתוקן למנגינה (ראה boardRaster.ts) נשאר
 * חי בהרמוניה. התוצאה: לעיגול הייתה דרגה קבועה, כלומר **אקורד אחד לכל אורך היצירה**, וזה
 * צף רק עכשיו כשהפאד והבס נשענים על הדרגה במלואם.
 *
 * ⚠️ **השורה הנמוכה** של הבר היא הדרגה, ולא הממוצע: כך הרמוניה מוגדרת גם במוזיקה אמיתית —
 * הצליל הנמוך ביותר קובע מה האקורד. ממוצע היה מחזיר בדיוק את קריסת-המתאר בדלת האחורית.
 */
export function progressionDegreesFromRaster(
  raster: readonly (readonly number[])[],
  columnsPerBar: number,
  barCount: number,
): number[] {
  const degrees: number[] = [];
  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    let lowestRow: number | null = null;
    for (let offset = 0; offset < columnsPerBar; offset += 1) {
      const rows = raster[barIndex * columnsPerBar + offset] ?? [];
      const first = rows[0];
      if (first !== undefined && (lowestRow === null || first < lowestRow)) {
        lowestRow = first;
      }
    }
    // בר שהציור לא נגע בו יורש את הדרגה הקודמת — קפיצה לטוניקה שם הייתה נשמעת כשינוי
    // הרמוני שהמשתמש לא צייר, דווקא במקום שבו הוא לא צייר כלום.
    degrees.push(lowestRow === null ? (degrees[barIndex - 1] ?? TONIC_DEGREE) : lowestRow % 7);
  }
  return degrees;
}
