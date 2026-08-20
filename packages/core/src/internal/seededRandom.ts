/**
 * @file        seededRandom.ts
 * @description ⭐ מחולל מספרים פסאודו-אקראיים דטרמיניסטי, מבוסס seed מחרוזת (shapeHash).
 *              לא מיוצא מ-index.ts — פנימי בלבד.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי: אסור להשתמש ב-Math.random() בשום מקום בתיאוריה/גרוב — זה שובר את עקרון
 * הדטרמיניזם (§1: "אותה צורה = בדיוק אותו סאונד, תמיד"). humanize.ts, ובחירת key/mode
 * ברירת-מחדל ב-harmonyEngine.ts, חייבים להשתמש ב-createSeededRandom(shapeHash) בלבד.
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
 * @param seed  מחרוזת שרירותית — בפרויקט הזה תמיד shapeHash.
 */
export function createSeededRandom(seed: string): () => number {
  return mulberry32(seedFromString(seed));
}
