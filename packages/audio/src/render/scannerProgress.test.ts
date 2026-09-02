/**
 * @file        scannerProgress.test.ts
 * @description ⭐ 2026-09-01: רגרסיה — **קו-הסריקה נמדד מול האורך המוזיקלי, לא מול אורך
 *              האודיו.**
 * @author      Soundiform
 * @created     2026-09-01
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ הבאג שנתפס בבדיקה חיה: "המוזיקה מושתקת לפני שהסורק מגיע לסוף הלוח". אורך האודיו הוא
 * `durationBars + זנב-ריוורב`, וכל התווים חיים בחלק הראשון בלבד — כך שסורק שמופה לאורך
 * האודיו המשיך לנוע על פני שקט. בסינמטי (זנב 5 שניות שהוקטן ל-3) זה היה עד 27% מהמסע.
 *
 * ⚠️ הבדיקה מכסה גם את הזנב עצמו: הוא **חייב** להישאר חלק מאורך האודיו (בלעדיו הדעיכה
 * נחתכת באמצע — הבאג ההפוך, שתוקן ב-22.8), רק לא חלק ממסע הסורק.
 */

import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@soundiform/core';
import { DEFAULT_MIX_CHARACTER } from '../mixing/mixChain';
import {
  computeDurationSeconds,
  computeMusicalDurationSeconds,
  scannerProgress,
  type GenreAudioConfig,
} from './sharedScheduling';

/** 4 ברים ב-120bpm = 8 שניות בדיוק. */
function makeScore(): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'test',
    tempo: 120,
    timeSignature: [4, 4],
    key: { root: 0, mode: 'aeolian' },
    genreId: 'test',
    durationBars: 4,
    tracks: [],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 4 }],
    metadata: { avgNoteDensity: 0, dominantMode: 'aeolian', rootFrequencyHz: 440 },
  };
}

function configWithTail(reverbDecaySeconds: number): GenreAudioConfig {
  return {
    synthPresets: {},
    mixCharacter: { ...DEFAULT_MIX_CHARACTER, reverbDecaySeconds },
  };
}

describe('אורך מוזיקלי מול אורך אודיו', () => {
  it('האורך המוזיקלי הוא הברים בלבד, בלי זנב', () => {
    expect(computeMusicalDurationSeconds(makeScore())).toBeCloseTo(8);
  });

  it('אורך האודיו כולל את הזנב — הדעיכה חייבת מקום להישמע', () => {
    expect(computeDurationSeconds(makeScore(), configWithTail(2.5))).toBeCloseTo(10.5);
  });

  it('הזנב חסום ב-3 שניות — סינמטי מגדיר 5', () => {
    expect(computeDurationSeconds(makeScore(), configWithTail(5))).toBeCloseTo(11);
  });

  it('הסורק מגיע לקצה הלוח בדיוק עם התו האחרון, לא אחריו', () => {
    const score = makeScore();
    expect(scannerProgress(0, score)).toBe(0);
    expect(scannerProgress(4, score)).toBeCloseTo(0.5);
    expect(scannerProgress(8, score)).toBe(1);
  });

  it('הסורק נשאר על הקצה בזמן הזנב ולא חורג ממנו', () => {
    const score = makeScore();
    // 10.5 שניות של אודיו, אבל הלוח נגמר ב-8.
    expect(scannerProgress(9.5, score)).toBe(1);
    expect(scannerProgress(10.5, score)).toBe(1);
  });

  it('לא מחזיר NaN על ציון באורך אפס', () => {
    const empty = { ...makeScore(), durationBars: 0 };
    expect(scannerProgress(3, empty)).toBe(0);
  });
});
