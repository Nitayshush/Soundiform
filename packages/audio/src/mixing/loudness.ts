/**
 * @file        loudness.ts
 * @description ⭐ נרמול לספי -14 LUFS — כלל קשיח בחוקה המוזיקלית. ראה PROJECT.md §4.3.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מגבלת V1 חשובה:
 * `estimateLoudnessLufs` הוא **קירוב** מבוסס RMS, לא מדידת LUFS מלאה לפי תקן ITU-R BS.1770
 * (חסר K-weighting filter וחסימת שקט/gating). מדידה תקנית מלאה שייכת לרנדור קובץ סופי
 * (Sprint 6), על באפר שלם — לא לפריוויו חי. מה שכן פעיל בפריוויו החי: `createMasterBus`,
 * Limiter שמונע קליפינג בפועל (§4.3 "ללא קליפינג" — התוצאה המעשית שממש חשובה עכשיו).
 *
 * ⭐ 2026-08-22 — באג אמיתי שנתפס ע"י בדיקה חיה: normalizeToTargetLufs חישב gain שמכוון
 * את ה-RMS הכולל ל-TARGET_LUFS, בלי לבדוק מה זה עושה ל-*פיקים* — עם קרסט-פקטור גבוה
 * (מוזיקה עם transients חדים, בדיוק מה ש-Item 5's פילטרים רזוננטיים ו-unison רחב מייצרים)
 * ה-gain הזה יכול לדחוף פיקים מעל 1.0, ו-encoders/wav.ts רק clamp-ה אותם ל-[-1,1] —
 * clamp זה *בעצמו* קליפינג דיגיטלי (עיוות אודיבילי), לא הגנה מפניו כמו שההערה הישנה הניחה.
 * התיקון: אחרי חישוב ה-gain ל-LUFS, בודקים את הפיק הצפוי; אם הוא יחרוג מ-PEAK_CEILING,
 * מקטינים את ה-gain כדי שהפיק בדיוק ייגע בתקרה — "ללא קליפינג" (§4.3, כלל קשיח) גובר על
 * דיוק-LUFS מוחלט, בדיוק כמו שלימיטר אמיתי בהפקה מקצועית עושה.
 */

import { Limiter } from 'tone';

/** יעד ברירת המחדל של §4.3. */
export const TARGET_LUFS = -14;
/** תקרת בטיחות ל-Limiter של הפריוויו החי — dB מתחת ל-0 (קליפינג דיגיטלי). */
const DEFAULT_LIMITER_CEILING_DB = -1;
/** תקרת פיק בטוחה לרינדור קובץ סופי (0.98 ≈ -0.18dBFS) — ראה הערת התיקון למעלה. */
const PEAK_CEILING = 0.98;

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

/**
 * מפעיל gain (dB) על כל הערוצים — צעד הנרמול בפועל לפני קידוד קובץ סופי (Sprint 6).
 * לא עושה clipping-protection בעצמו: הבטחת "ללא קליפינג" (§4.3) ממומשת ב-encoders/wav.ts
 * (clamp ל-[-1,1] בהמרה ל-PCM 16-bit).
 */
export function applyGainDb(channels: readonly Float32Array[], gainDb: number): Float32Array[] {
  const gainFactor = Math.pow(10, gainDb / 20);
  return channels.map((channel) => {
    const output = new Float32Array(channel.length);
    for (let index = 0; index < channel.length; index += 1) {
      output[index] = (channel[index] ?? 0) * gainFactor;
    }
    return output;
  });
}

function findPeakAmplitude(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) {
    const absValue = Math.abs(sample);
    if (absValue > peak) {
      peak = absValue;
    }
  }
  return peak;
}

/**
 * מודד LUFS על ה-buffer השלם (כל הערוצים ביחד) ומחזיר את הערוצים אחרי נרמול ל-targetLufs —
 * אבל לעולם לא במחיר קליפינג: אם ה-gain הדרוש ל-LUFS היה דוחף פיקים מעל PEAK_CEILING,
 * ה-gain מוקטן כדי שהפיק בדיוק ייגע בתקרה (ראה הערת התיקון ב-2026-08-22 למעלה בקובץ).
 */
export function normalizeToTargetLufs(
  channels: readonly Float32Array[],
  targetLufs: number = TARGET_LUFS,
): Float32Array[] {
  const combined = new Float32Array(channels.reduce((sum, channel) => sum + channel.length, 0));
  let offset = 0;
  for (const channel of channels) {
    combined.set(channel, offset);
    offset += channel.length;
  }
  const measuredLufs = estimateLoudnessLufs(combined);
  let gainDb = computeNormalizationGainDb(measuredLufs, targetLufs);

  const peakAmplitude = findPeakAmplitude(combined);
  const projectedPeak = peakAmplitude * Math.pow(10, gainDb / 20);
  if (projectedPeak > PEAK_CEILING) {
    const peakLimitFactor = PEAK_CEILING / projectedPeak;
    gainDb += 20 * Math.log10(peakLimitFactor);
  }

  return applyGainDb(channels, gainDb);
}
