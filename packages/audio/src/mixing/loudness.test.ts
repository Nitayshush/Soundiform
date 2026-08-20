/**
 * @file        loudness.test.ts
 * @description בדיקות יחידה לקירוב ה-LUFS ולחישוב הנרמול (§4.3).
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { computeNormalizationGainDb, estimateLoudnessLufs, TARGET_LUFS } from './loudness';

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
