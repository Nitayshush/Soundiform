/**
 * @file        chords.test.ts
 * @description בדיקות יחידה לבניית טריאדות ואיכות אקורד דיאטונית.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { ALL_MODES, isInScale } from './scales';
import { buildTriad, getChordQuality } from './chords';

describe('buildTriad', () => {
  it('בונה טריאדה בת 3 תווים', () => {
    expect(buildTriad(60, 'ionian', 0)).toHaveLength(3);
  });

  it('כל תווי הטריאדה תמיד בסולם, בכל מוד ובכל דרגה', () => {
    for (const mode of ALL_MODES) {
      for (let degree = 0; degree < 7; degree += 1) {
        const triad = buildTriad(60, mode, degree);
        for (const pitch of triad) {
          expect(isInScale(pitch, 60, mode)).toBe(true);
        }
      }
    }
  });

  it('טריאדת דרגה I ב-ionian היא C-E-G (מזור)', () => {
    expect(buildTriad(60, 'ionian', 0)).toEqual([60, 64, 67]);
  });
});

describe('getChordQuality', () => {
  it('דרגה I ב-ionian היא מזור', () => {
    expect(getChordQuality('ionian', 0)).toBe('major');
  });

  it('דרגה I ב-aeolian היא מינור', () => {
    expect(getChordQuality('aeolian', 0)).toBe('minor');
  });

  it('דרגה vii ב-ionian היא דימיניש (הדרגה היחידה עם חמישית מוקטנת בסולם מזורי)', () => {
    expect(getChordQuality('ionian', 6)).toBe('diminished');
  });

  it('מחזירה איכות חוקית לכל דרגה בכל מוד (לא נופלת/זורקת)', () => {
    const validQualities = new Set(['major', 'minor', 'diminished', 'augmented']);
    for (const mode of ALL_MODES) {
      for (let degree = 0; degree < 7; degree += 1) {
        expect(validQualities.has(getChordQuality(mode, degree))).toBe(true);
      }
    }
  });
});
