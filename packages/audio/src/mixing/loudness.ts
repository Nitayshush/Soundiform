/**
 * @file        loudness.ts
 * @description ⭐ נרמול לספי -14 LUFS — כלל קשיח בחוקה המוזיקלית. ראה PROJECT.md §4.3.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מגבלת V1 חשובה:
 * `estimateLoudnessLufs` הוא **קירוב** מבוסס RMS, לא מדידת LUFS מלאה לפי תקן ITU-R BS.1770
 * (חסר K-weighting filter וחסימת שקט/gating). מדידה תקנית מלאה שייכת לרנדור קובץ סופי
 * (Sprint 6), על באפר שלם — לא לפריוויו חי. מה שכן פעיל בפריוויו החי: `createMasterBus`,
 * Limiter שמונע קליפינג בפועל (§4.3 "ללא קליפינג" — התוצאה המעשית שממש חשובה עכשיו).
 */

import { Limiter } from 'tone';

/** יעד ברירת המחדל של §4.3. */
export const TARGET_LUFS = -14;
/** תקרת בטיחות ל-Limiter של הפריוויו החי — dB מתחת ל-0 (קליפינג דיגיטלי). */
const DEFAULT_LIMITER_CEILING_DB = -1;

/** Limiter על אפיק המאסטר — ההגנה המעשית מפני קליפינג בזמן ניגון חי. */
export function createMasterBus(ceilingDb: number = DEFAULT_LIMITER_CEILING_DB): Limiter {
  return new Limiter(ceilingDb);
}

/**
 * קירוב RMS ל-LUFS (ראה מגבלת V1 למעלה). מחזיר -Infinity לבאפר ריק/שקט מוחלט.
 */
export function estimateLoudnessLufs(samples: Float32Array): number {
  let sumSquares = 0;
  let count = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
    count += 1;
  }
  if (count === 0) {
    return -Infinity;
  }
  const meanSquare = sumSquares / count;
  if (meanSquare <= 0) {
    return -Infinity;
  }
  return -0.691 + 10 * Math.log10(meanSquare);
}

/** תוספת/הפחתת dB הדרושה כדי להגיע מ-measuredLufs ל-targetLufs. */
export function computeNormalizationGainDb(
  measuredLufs: number,
  targetLufs: number = TARGET_LUFS,
): number {
  if (!Number.isFinite(measuredLufs)) {
    return 0;
  }
  return targetLufs - measuredLufs;
}
