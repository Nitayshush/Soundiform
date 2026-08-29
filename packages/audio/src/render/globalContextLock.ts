/**
 * @file        globalContextLock.ts
 * @description ⭐ 2026-08-28 (הסבב המבני לסאונד בנייד): תור-סריאליזציה לפעולות שלא יכולות
 *              לרוץ בו-זמנית מול ה-Tone.js context הגלובלי.
 * @author      Soundiform
 * @created     2026-08-28
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה זה קיים: `Tone.Offline` (ראה offlineRenderer.ts) **מחליף את ה-context הגלובלי** לזמן
 * הרינדור ומשחזר אותו אחרי — זה המימוש של Tone עצמו, לא בחירה שלנו. כל קוד אחר שיוצר
 * צמתי-Tone *באותו רגע* (בפועל: usePreviewSound.ts, שמנגן דגימת-צליל בלחיצה על בורר-הצלילים)
 * ייתפס ל-context האופליין במקום לחי — ואז פשוט לא יישמע כלום, בלי שגיאה גלויה.
 *
 * הפתרון המינימלי: תור. כל פעולה רגישה-ל-context עוברת דרך withGlobalContextLock, וכך שתי
 * פעולות כאלה לעולם לא חופפות. לא mutex "אמיתי" עם timeout/reentrancy — התור מספיק כאן, כי
 * שתי הפעולות היחידות שמשתתפות בו הן קצרות-חיים ותמיד מסתיימות.
 */

/** הזנב הנוכחי של התור — כל פעולה חדשה משתרשרת אחרי הקודמת. */
let queueTail: Promise<unknown> = Promise.resolve();

/**
 * מריץ את `task` רק אחרי שכל פעולה קודמת שננעלה כאן הסתיימה (בהצלחה או בכישלון).
 * @returns מה ש-task החזיר — שגיאות מ-task מועברות לקורא כרגיל.
 */
export function withGlobalContextLock<T>(task: () => Promise<T>): Promise<T> {
  // ⚠️ מטפל גם ב-fulfilled וגם ב-rejected של הפעולה הקודמת (אותו task בשני הענפים) — אחרת
  // פעולה אחת שנכשלה הייתה "מרעילה" את התור וכל הפעולות הבאות היו נדחות לנצח.
  const result = queueTail.then(task, task);
  queueTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
