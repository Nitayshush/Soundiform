/**
 * @file        humanize.test.ts
 * @description בדיקות יחידה להומניזציה — קריטי שתישאר דטרמיניסטית (§1).
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../internal/seededRandom';
import { humanizeTiming, humanizeVelocity } from './humanize';

describe('humanizeTiming', () => {
  it('דטרמיניסטית: אותו seed מייצר תמיד את אותה סטייה', () => {
    const resultA = humanizeTiming(480, 120, createSeededRandom('shape-abc'));
    const resultB = humanizeTiming(480, 120, createSeededRandom('shape-abc'));
    expect(resultA).toBe(resultB);
  });

  it('seed שונה מייצר (בדרך כלל) סטייה שונה', () => {
    const resultA = humanizeTiming(480, 120, createSeededRandom('shape-abc'));
    const resultB = humanizeTiming(480, 120, createSeededRandom('shape-xyz'));
    expect(resultA).not.toBe(resultB);
  });

  it('הסטייה נשארת קטנה ולא הופכת ל-tick שלילי', () => {
    const random = createSeededRandom('shape-negative-guard');
    const result = humanizeTiming(0, 120, random);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('humanizeVelocity', () => {
  it('דטרמיניסטית: אותו seed מייצר תמיד את אותה סטייה', () => {
    const resultA = humanizeVelocity(0.5, createSeededRandom('shape-vel'));
    const resultB = humanizeVelocity(0.5, createSeededRandom('shape-vel'));
    expect(resultA).toBe(resultB);
  });

  it('לעולם לא חוצה את גבולות [0,1]', () => {
    const random = createSeededRandom('shape-bounds');
    for (let i = 0; i < 50; i += 1) {
      const value = humanizeVelocity(i % 2 === 0 ? 0 : 1, random, 0.5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
