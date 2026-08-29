/**
 * @file        renderSpeedMemory.ts
 * @description ⭐ 2026-08-29: זוכר כמה מהר *המכשיר הזה* מרנדר אודיו, כדי שנוכל להראות
 *              התקדמות אמיתית (אחוזים) בזמן ההמתנה לרינדור-מראש, ולא רק שנייה עולה.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה זה נחוץ: הרינדור-מראש (packages/audio/src/render/offlineRenderer.ts) הוא פעולה אטומה —
 * OfflineAudioContext לא מדווח התקדמות בכלל, ואי אפשר לדעת "כמה נשאר" מתוכו. אבל **כן** אפשר
 * להעריך: המהירות תלויה במכשיר והיא יציבה למדי בין רינדור לרינדור, אז מודדים אותה פעם אחת
 * ומשתמשים בה בפעם הבאה. נמדד בנייד אמיתי: 39.8 שניות אודיו רונדרו ב-88 שניות (0.45x).
 *
 * ⚠️ ההערכה היא *הערכה* — הרינדור הראשון אי-פעם במכשיר לא יציג אחוזים בכלל (אין עדיין מדידה),
 * וזה בסדר: עדיף בלי אחוז מאשר אחוז שקרי. הקורא (useAudioEngine.ts) מטפל ב-null.
 */

const STORAGE_KEY = 'soundiform.renderSecondsPerAudioSecond';
/** גבולות שפיות — ערך מחוץ לטווח הזה הוא כנראה מדידה מזוהמת (טאב ברקע, מכשיר שנחנק). */
const MIN_PLAUSIBLE_RATIO = 0.02;
const MAX_PLAUSIBLE_RATIO = 20;

/** בזיכרון, כדי לא לגעת ב-localStorage בכל פריים; localStorage רק משמר בין טעינות. */
let cachedRatio: number | null = null;

/**
 * כמה שניות-שעון נדרשות לכל שנייה של אודיו במכשיר הזה. null = עוד לא נמדד אף פעם.
 */
export function getRenderSecondsPerAudioSecond(): number | null {
  if (cachedRatio !== null) {
    return cachedRatio;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return null;
    }
    const parsed = Number(stored);
    if (!Number.isFinite(parsed) || parsed < MIN_PLAUSIBLE_RATIO || parsed > MAX_PLAUSIBLE_RATIO) {
      return null;
    }
    cachedRatio = parsed;
    return parsed;
  } catch {
    // localStorage יכול לזרוק (מצב פרטי, חסימת אחסון) — היעדר הערכה הוא לא שגיאה.
    return null;
  }
}

/** רושם מדידה חדשה אחרי רינדור שהסתיים. */
export function recordRenderSpeed(renderMilliseconds: number, audioSeconds: number): void {
  if (renderMilliseconds <= 0 || audioSeconds <= 0) {
    return;
  }
  const ratio = renderMilliseconds / 1000 / audioSeconds;
  if (ratio < MIN_PLAUSIBLE_RATIO || ratio > MAX_PLAUSIBLE_RATIO) {
    return;
  }
  cachedRatio = ratio;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(ratio));
  } catch {
    // אין אחסון — נשארים עם הערך בזיכרון בלבד לסשן הזה.
  }
}
