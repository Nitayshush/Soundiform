/**
 * @file        progression.test.ts
 * @description ⭐ 2026-08-31 (סבב ב'): בדיקות לקדנצה ולגזירת הדרגות מהרסטר.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { Section } from '../score/MusicalScore';
import {
  applyCadences,
  degreeAtBar,
  DOMINANT_DEGREE,
  normalizeDegree,
  progressionDegreesFromRaster,
  TONIC_DEGREE,
} from './progression';

/** ⚠️ סקשנים בני 4 ברים ומעלה — רק שם הדומיננטה נוספת (ראה MIN_BARS_FOR_DOMINANT). */
const SECTIONS: Section[] = [
  { name: 'intro', startBar: 0, lengthBars: 4 },
  { name: 'loop', startBar: 4, lengthBars: 4 },
  { name: 'outro', startBar: 8, lengthBars: 4 },
];

describe('applyCadences', () => {
  it('כל סקשן נסגר ב-V→I', () => {
    const degrees = Array.from({ length: 12 }, () => 3);
    const result = applyCadences(degrees, SECTIONS);
    for (const section of SECTIONS) {
      const last = section.startBar + section.lengthBars - 1;
      expect(result[last], `סוף ${section.name}`).toBe(TONIC_DEGREE);
      expect(result[last - 1], `לפני סוף ${section.name}`).toBe(DOMINANT_DEGREE);
    }
  });

  it('ברים שאינם בקדנצה נשארים כפי שהציור נתן', () => {
    const degrees = Array.from({ length: 12 }, () => 5);
    const result = applyCadences(degrees, SECTIONS);
    // ברים 4-5 הם תחילת ה-loop; הקדנצה שלו היא ברים 6-7 בלבד.
    expect(result[4]).toBe(5);
    expect(result[5]).toBe(5);
  });

  it('סקשן קצר מקבל סגירה בלבד, בלי דומיננטה — אחרת הקדנצה בולעת את כל הציור', () => {
    const short: Section[] = [{ name: 'loop', startBar: 0, lengthBars: 2 }];
    const result = applyCadences([5, 5], short);
    expect(result[0]).toBe(5); // הציור נשמר
    expect(result[1]).toBe(TONIC_DEGREE);
  });

  it('סקשן של בר אחד לא נוגעים בו — אין מקום למתח ופתרון', () => {
    const single: Section[] = [{ name: 'loop', startBar: 0, lengthBars: 1 }];
    expect(applyCadences([6], single)).toEqual([6]);
  });

  it('לא משנה את מערך הקלט', () => {
    const degrees = [3, 3, 3, 3];
    applyCadences(degrees, [{ name: 'loop', startBar: 0, lengthBars: 4 }]);
    expect(degrees).toEqual([3, 3, 3, 3]);
  });

  it('סקשן שחורג מאורך המערך לא זורק', () => {
    expect(() =>
      applyCadences([1, 2], [{ name: 'loop', startBar: 0, lengthBars: 8 }]),
    ).not.toThrow();
  });
});

describe('progressionDegreesFromRaster', () => {
  /** רסטר: לכל עמודה, השורות שנחצו. 16 עמודות בבר. */
  function raster(barRows: readonly (readonly number[])[]): number[][] {
    return barRows.flatMap((rows) => Array.from({ length: 16 }, () => [...rows]));
  }

  it('הדרגה נגזרת מהשורה **הנמוכה** של הבר', () => {
    const result = progressionDegreesFromRaster(
      raster([
        [3, 9],
        [5, 6],
      ]),
      16,
      2,
    );
    expect(result).toEqual([3, 5]);
  });

  it('שורות מעל 7 מקופלות לאוקטבה אחת', () => {
    expect(progressionDegreesFromRaster(raster([[9, 12]]), 16, 1)).toEqual([2]);
  });

  it('צורה סגורה נותנת דרגות שונות — זו הרגרסיה של קריסת המתאר בהרמוניה', () => {
    // ⚠️ המתאר הממוצע (pitchContour) היה מחזיר ערך זהה לכל הברים כאן. הרסטר לא.
    const result = progressionDegreesFromRaster(
      raster([
        [2, 8],
        [0, 10],
        [4, 6],
      ]),
      16,
      3,
    );
    expect(new Set(result).size).toBeGreaterThan(1);
  });

  it('בר ריק יורש את הדרגה הקודמת ולא קופץ לטוניקה', () => {
    const result = progressionDegreesFromRaster(raster([[5], [], [6]]), 16, 3);
    expect(result[1]).toBe(5);
  });

  it('בר ריק ראשון נופל לטוניקה', () => {
    expect(progressionDegreesFromRaster(raster([[], [4]]), 16, 2)[0]).toBe(TONIC_DEGREE);
  });

  it('רסטר ריק לגמרי לא זורק', () => {
    expect(progressionDegreesFromRaster([], 16, 3)).toEqual([0, 0, 0]);
  });
});

describe('normalizeDegree / degreeAtBar', () => {
  it('מקפל לטווח 0–6, כולל שליליים', () => {
    expect(normalizeDegree(9)).toBe(2);
    expect(normalizeDegree(-1)).toBe(6);
  });

  it('בר מעבר לסוף המערך מקבל את הדרגה האחרונה', () => {
    expect(degreeAtBar([1, 2, 3], 99)).toBe(3);
  });

  it('מערך ריק נופל לטוניקה', () => {
    expect(degreeAtBar([], 0)).toBe(TONIC_DEGREE);
  });
});
