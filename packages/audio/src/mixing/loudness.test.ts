/**
 * @file        loudness.test.ts
 * @description בדיקות יחידה לקירוב ה-LUFS ולחישוב הנרמול (§4.3).
 *
 * ⭐ 2026-08-22 — נוסף describe('normalizeToTargetLufs') כבדיקת רגרסיה לבאג אמיתי:
 * הפונקציה יכלה לדחוף פיקים מעל 1.0 (קליפינג) על אודיו עם crest factor גבוה (RMS שקט,
 * transient חד) — בדיוק מה ש-Item 5's פילטרים רזוננטיים/unison רחב מייצרים. נתפס ע"י
 * בדיקה חיה אמיתית (רינדור+ניתוח waveform), לא ע"י הבדיקות שהיו קיימות כאן קודם.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import {
  computeNormalizationGainDb,
  estimateLoudnessLufs,
  normalizeToTargetLufs,
  TARGET_LUFS,
} from './loudness';

function makeSineSamples(amplitude: number, length = 4800): Float32Array {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * index) / 48);
  }
  return samples;
}

describe('estimateLoudnessLufs', () => {
  it('מחזיר -Infinity לבאפר ריק', () => {
    expect(estimateLoudnessLufs(new Float32Array(0))).toBe(-Infinity);
  });

  it('מחזיר -Infinity לשקט מוחלט', () => {
    expect(estimateLoudnessLufs(new Float32Array(1000))).toBe(-Infinity);
  });

  it('אות בעל אמפליטודה גדולה יותר מקבל ערך LUFS גבוה יותר (פחות שלילי)', () => {
    const quiet = estimateLoudnessLufs(makeSineSamples(0.1));
    const loud = estimateLoudnessLufs(makeSineSamples(0.8));
    expect(loud).toBeGreaterThan(quiet);
  });

  it('אות מלא-סקאלה (אמפליטודה 1) לא חוצה 0 LUFS', () => {
    expect(estimateLoudnessLufs(makeSineSamples(1))).toBeLessThanOrEqual(0);
  });
});

describe('computeNormalizationGainDb', () => {
  it('מחזיר 0 עבור אות שכבר בדיוק ביעד', () => {
    expect(computeNormalizationGainDb(TARGET_LUFS)).toBeCloseTo(0);
  });

  it('מחזיר ערך חיובי (הגברה) לאות שקט מהיעד', () => {
    expect(computeNormalizationGainDb(-20)).toBeGreaterThan(0);
  });

  it('מחזיר ערך שלילי (הנחתה) לאות חזק מהיעד', () => {
    expect(computeNormalizationGainDb(-6)).toBeLessThan(0);
  });

  it('מחזיר 0 לקלט לא-סופי (למשל שקט מוחלט, -Infinity) במקום לזרוק/להחזיר NaN', () => {
    expect(computeNormalizationGainDb(-Infinity)).toBe(0);
  });
});

/** אות עם crest factor גבוה: כמעט שקט לגמרי, עם transient חד אחד — RMS נמוך, פיק גבוה. */
function makeHighCrestFactorSignal(length: number): Float32Array {
  const signal = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    signal[index] = 0.02 * Math.sin(index * 0.1);
  }
  const transientStart = Math.floor(length / 2);
  for (let index = transientStart; index < transientStart + 50 && index < length; index += 1) {
    signal[index] = 0.9;
  }
  return signal;
}

describe('normalizeToTargetLufs', () => {
  it('לעולם לא יוצר פיק מעל 1.0 (קליפינג) גם על אות עם crest factor גבוה', () => {
    const signal = makeHighCrestFactorSignal(44100);
    const [normalized] = normalizeToTargetLufs([signal], TARGET_LUFS);

    let peak = 0;
    for (const sample of normalized ?? []) {
      peak = Math.max(peak, Math.abs(sample));
    }
    expect(peak).toBeLessThanOrEqual(1);
  });

  it('על אות רגיל (crest factor נמוך) עדיין מגיע קרוב ל-target LUFS', () => {
    const length = 44100;
    const signal = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
      signal[index] = 0.1 * Math.sin(index * 0.1);
    }
    const [normalized] = normalizeToTargetLufs([signal], TARGET_LUFS);

    let peak = 0;
    for (const sample of normalized ?? []) {
      peak = Math.max(peak, Math.abs(sample));
    }
    // אות רגיל לא אמור לגעת בתקרת ה-peak-limiting בכלל — ה-gain הנדרש ל-LUFS לא מסוכן.
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThan(1);
  });
});
