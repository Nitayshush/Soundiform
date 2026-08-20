/**
 * @file        scales.test.ts
 * @description בדיקות יחידה לשכבת הסולמות — הבסיס לכלל §4.3 "כל תו בסולם הפעיל".
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { ALL_MODES, isInScale, scaleDegreeToMidiPitch, snapToScale } from './scales';

describe('scaleDegreeToMidiPitch', () => {
  it('דרגה 0 מחזירה את השורש עצמו', () => {
    expect(scaleDegreeToMidiPitch(60, 'ionian', 0)).toBe(60);
  });

  it('דרגה 7 (אוקטבה מלאה) מחזירה שורש+12', () => {
    expect(scaleDegreeToMidiPitch(60, 'ionian', 7)).toBe(72);
  });

  it('דרגה שלילית יורדת אוקטבה כראוי', () => {
    expect(scaleDegreeToMidiPitch(60, 'ionian', -7)).toBe(48);
  });

  it('כל דרגה בכל מוד מייצרת תו שתמיד בסולם', () => {
    for (const mode of ALL_MODES) {
      for (let degree = -14; degree <= 14; degree += 1) {
        const pitch = scaleDegreeToMidiPitch(60, mode, degree);
        expect(isInScale(pitch, 60, mode)).toBe(true);
      }
    }
  });
});

describe('snapToScale', () => {
  it('תו שכבר בסולם נשאר ללא שינוי', () => {
    expect(snapToScale(64, 60, 'ionian')).toBe(64); // 64 = שלישית מז'ורית, בסולם C ionian
  });

  it('תו כרומטי מחוץ לסולם מוצמד לתו הקרוב ביותר', () => {
    // 61 (C#) לא בסולם C ionian — הקרובים ביותר הם 60 (C) או 62 (D), שניהם במרחק 1
    const snapped = snapToScale(61, 60, 'ionian');
    expect(isInScale(snapped, 60, 'ionian')).toBe(true);
    expect(Math.abs(snapped - 61)).toBeLessThanOrEqual(1);
  });

  it('כל תו כרומטי בטווח MIDI מלא, בכל מוד, מוצמד לתו שבסולם', () => {
    for (const mode of ALL_MODES) {
      for (let pitch = 0; pitch <= 127; pitch += 1) {
        expect(isInScale(snapToScale(pitch, 60, mode), 60, mode)).toBe(true);
      }
    }
  });
});
