/**
 * @file        noteBoard.ts
 * @description ⭐ 2026-08-27 (לוח-תווים אבסולוטי): מקור-האמת היחיד לגיאומטריית "הלוח" —
 *              כמה עמודות-זמן בבר, השורש הקבוע, וכיצד ממירים דרגת-Y לתו קבוע. נצרך גם ע"י
 *              harmonyEngine.ts (יצירת המנגינה בפועל) וגם ע"י apps/web (MusicalGrid.tsx,
 *              הצגת הלוח החזותי) — כדי ששני הצדדים תמיד יסכימו על אותם תווים בדיוק.
 * @author      Soundiform
 * @created     2026-08-27
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { Mode } from '../score/MusicalScore';
import { scaleDegreeToMidiPitch } from './scales';

/** כמה עמודות-זמן בבר אחד — תואם stepsPerBar הקיים בפועל בכל תבניות-הקצב (16). */
export const COLUMNS_PER_BAR = 16;

/**
 * שורש-הלוח **כברירת מחדל** (pitch class, 0=C). תואם את הדוגמאות שכבר הוצגו ואושרו
 * (טראנס/האוס, שורש C).
 *
 * ⭐ 2026-08-30: מאז הרחבת הלוח לשאר הסגנונות, סגנון יכול לקבוע שורש משלו דרך
 * `CompositionConfig.noteBoardRootPitchClass` (ומשם `GenrePack`). הקבוע נשאר כברירת-המחדל
 * כדי שטראנס/האוס לא ישתנו כלל — בדיוק כפי שההערה הקודמת כאן צפתה.
 */
export const ABSOLUTE_BOARD_ROOT_PITCH_CLASS = 0;

/** טווח דרגות-סולם למלודיה (הנתיב הישן, yToMelodyDegree) — Y=0 (למעלה) → הדרגה הגבוהה. ~2 אוקטבות. */
export const MELODY_DEGREE_RANGE = 15;
/** המלודיה (הנתיב הישן) יושבת אוקטבה מעל השורש (רגיסטר lead טיפוסי). */
export const MELODY_DEGREE_OFFSET = 7;

/**
 * ⚠️ הלוח האבסולוטי מתחיל *מהשורש עצמו* (דרגה 0, לא MELODY_DEGREE_OFFSET) ומשתרע
 * ABSOLUTE_BOARD_ROW_COUNT דרגות מעליו — בדיוק כמו שהוצג ואושר בדיאגרמה (טראנס: שורה
 * תחתונה C3=48, שורה עליונה C5=72; MELODY_DEGREE_OFFSET=7 היה מזיז את זה אוקטבה שלמה
 * למעלה, C4–C6, בסתירה למה שכבר אושר). מספר-השורות זהה במקרה ל-MELODY_DEGREE_RANGE (15) —
 * קבוע נפרד בכוונה, כדי לא ליצור תלות מקרית בין שני מושגים שונים.
 */
export const ABSOLUTE_BOARD_ROW_COUNT = 15;

/**
 * ⚠️ 2026-08-30: גבולות שפיות למספר-שורות שמגיע מקונפיג-סגנון. מתחת ל-8 הלוח צר מדי מכדי
 * לבטא צורה, ומעל 24 כל שורה נעשית דקה מכדי לפגוע בה באצבע בנייד. הסכימה (GenrePack)
 * אוכפת את אותם גבולות — כאן זו הגנה שנייה, כי הקונפיג מגיע מה-DB ולא רק מהקבצים.
 */
export const MIN_BOARD_ROW_COUNT = 8;
export const MAX_BOARD_ROW_COUNT = 24;

/** מהדק מספר-שורות שהגיע מקונפיג לטווח שפוי, ונופל לברירת-המחדל כשלא סופק. */
export function resolveBoardRowCount(rowCount?: number): number {
  if (rowCount === undefined) {
    return ABSOLUTE_BOARD_ROW_COUNT;
  }
  return Math.min(MAX_BOARD_ROW_COUNT, Math.max(MIN_BOARD_ROW_COUNT, Math.round(rowCount)));
}

/**
 * בונה את רשימת-התווים הקבועה של הלוח (MIDI, מהנמוך לגבוה) — השורש עצמו הוא השורה
 * התחתונה — לפי שורש+מוד נתונים.
 * @param rowCount ברירת מחדל ABSOLUTE_BOARD_ROW_COUNT; סגנון יכול לקבוע אחרת (ראה
 *                 CompositionConfig.noteBoardRowCount).
 */
export function buildNoteBoardRows(root: number, mode: Mode, rowCount?: number): number[] {
  const resolvedRowCount = resolveBoardRowCount(rowCount);
  const rows: number[] = [];
  for (let degree = 0; degree < resolvedRowCount; degree += 1) {
    rows.push(scaleDegreeToMidiPitch(root, mode, degree));
  }
  return rows;
}

/**
 * ממירה ערך-Y מנורמל (0–1) לאינדקס-שורה בלוח (0..rowCount-1) — אותה נוסחה בדיוק כמו
 * yToMelodyDegree ב-harmonyEngine.ts, אך גנרית לכל rowCount (לא קשורה ל-MELODY_DEGREE_OFFSET).
 */
export function quantizeYToRowIndex(y: number, rowCount: number): number {
  const clampedY = Math.min(1, Math.max(0, y));
  return Math.round((1 - clampedY) * (rowCount - 1));
}
