/**
 * @file        seededRandom.ts
 * @description מחולל מספרים פסאודו-אקראיים דטרמיניסטי — עותק מקומי של @shape-sound/core's
 *              internal/seededRandom.ts (שם לא מיוצא מה-index הציבורי, ולכן audio לא יכול
 *              לייבא אותו ישירות). לא מיוצא מ-index.ts — פנימי בלבד.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי: אסור להשתמש ב-Math.random() בשום מקום ברינדור/מיקס — זה שובר את עקרון
 * הדטרמיניזם (§1: "אותה צורה = בדיוק אותו סאונד, תמיד"). ראה deterministicReverb.ts.
 */

/** hash מחרוזת ל-32-bit integer (djb2-variant) — לא קריפטוגרפי, רק לזריעת ה-PRNG. */
function seedFromString(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

/** mulberry32 — PRNG דטרמיניסטי קל וידוע, איכות מספקת לשימוש לא-קריפטוגרפי. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * יוצר מחולל מספרים ב-[0,1) שתמיד מייצר את **אותה** סדרה עבור אותו seed.
 */
export function createSeededRandom(seed: string): () => number {
  return mulberry32(seedFromString(seed));
}
