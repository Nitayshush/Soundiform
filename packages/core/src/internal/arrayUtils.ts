/**
 * @file        arrayUtils.ts
 * @description פרימיטיבים גנריים משותפים לכל packages/core (analysis + theory + groove).
 *              לא מיוצא מ-index.ts — פנימי בלבד.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

/**
 * גישה בטוחה למערך עם שגיאה מפורשת אם האינדקס מחוץ לתחום —
 * מונע `!` (non-null assertion אסור, §0.3) גם כשהאינדקס תמיד תקף לוגית מתוך הלולאה הקוראת.
 */
export function at<T>(array: readonly T[], index: number): T {
  const value = array[index];
  if (value === undefined) {
    throw new Error(`at: אינדקס ${String(index)} מחוץ לתחום המערך (אורך ${String(array.length)})`);
  }
  return value;
}
