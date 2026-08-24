/**
 * @file        voiceLeading.test.ts
 * @description בדיקות יחידה ל-voice leading — קריטי לאיכות (§11 Sprint 3).
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { at } from '../internal/arrayUtils';
import { buildTriad } from './chords';
import {
  chooseSmoothVoicing,
  hasParallelMotion,
  pickClosestOctave,
  smoothMelodicLine,
} from './voiceLeading';

function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

function totalMovement(pitches: readonly number[]): number {
  let sum = 0;
  for (let index = 1; index < pitches.length; index += 1) {
    sum += Math.abs(at(pitches, index) - at(pitches, index - 1));
  }
  return sum;
}

function totalMovementBetween(chordA: readonly number[], chordB: readonly number[]): number {
  let sum = 0;
  for (let index = 0; index < chordA.length; index += 1) {
    sum += Math.abs(at(chordB, index) - at(chordA, index));
  }
  return sum;
}

describe('pickClosestOctave', () => {
  it('בלי תו קודם מחזיר את הפיץ המקורי', () => {
    expect(pickClosestOctave(65, null)).toBe(65);
  });

  it('בוחר את האוקטבה הקרובה ביותר לתו הקודם', () => {
    // pitchClass 0 (C), תו קודם 71 (B, אוקטבה 5) — האוקטבה הקרובה של C היא 72, לא 60 או 0
    expect(pickClosestOctave(0, 71)).toBe(72);
  });
});

describe('smoothMelodicLine', () => {
  it('שומר את pitch class המקורי של כל תו', () => {
    const original = [0, 24, 48, 12];
    const smoothed = smoothMelodicLine(original);
    smoothed.forEach((pitch, index) => {
      expect(mod12(pitch)).toBe(mod12(at(original, index)));
    });
  });

  it('מקטין משמעותית את סך התנועה לעומת קו לא-מוחלק (קפיצות אוקטבה)', () => {
    const jumpy = [0, 24, 1, 25, 2]; // אותו pitch class בערך, אבל קופץ אוקטבות
    const smoothed = smoothMelodicLine(jumpy);
    expect(totalMovement(smoothed)).toBeLessThan(totalMovement(jumpy));
  });

  it('§11 2026-08-23 — קריסת פרודקשן אמיתית: לא סוחף מחוץ לטווח MIDI על פני הרבה חזרות', () => {
    // pitch classes במרחק טריטון (6 חצי-טונים) זה מזה — מייצר "תיקו" בכל מעבר (שני מועמדים
    // שווי-מרחק), ולפני התיקון זה גרם לסחיפה עקבית לאותו כיוון בכל מחזור. עם progression
    // חוזר על עצמו הרבה בארים (ציור עם הרבה משיכות → motifSize/loopBars גדולים, §11
    // 2026-08-23), הסחיפה המצטברת חצתה את גבול ה-MIDI התקף וקרסה על ולידציית ה-schema.
    const tritoneAlternating = Array.from({ length: 40 }, (_, index) => (index % 2 === 0 ? 0 : 6));
    const smoothed = smoothMelodicLine(tritoneAlternating);
    expect(smoothed.every((pitch) => pitch >= 0 && pitch <= 127)).toBe(true);
    expect(
      smoothed.every((pitch, index) => mod12(pitch) === mod12(at(tritoneAlternating, index))),
    ).toBe(true);
  });
});

describe('chooseSmoothVoicing', () => {
  it('בלי אקורד קודם מחזיר את הטריאדה כפי שהיא', () => {
    const triad = buildTriad(60, 'ionian', 0);
    expect(chooseSmoothVoicing(null, triad)).toEqual(triad);
  });

  it('נמנע מקווינטות/אוקטבות מקבילות גם כשלמעבר הישיר (root position) יש כאלה', () => {
    const chordA = buildTriad(60, 'ionian', 0); // C-E-G
    const chordB = buildTriad(60, 'ionian', 3); // F-A-C (דרגה IV)

    // מוודאים שהתרחיש בכלל רלוונטי: root position בין I ל-IV באמת מכיל מקבילות
    // (שורש וחמישית זזים יחד באותו כיוון) — זו הסיבה שהיפוך נדרש כאן.
    expect(hasParallelMotion(chordA, chordB)).toBe(true);

    const voiced = chooseSmoothVoicing(chordA, chordB);
    expect(hasParallelMotion(chordA, voiced)).toBe(false);
  });

  it('בין היפוכים חוקיים (בלי מקבילות), בוחר את זה שממזער תנועה כוללת', () => {
    const chordA = buildTriad(60, 'ionian', 0); // C-E-G
    const chordB = buildTriad(60, 'ionian', 1); // D-F-A (דרגה ii)

    const voiced = chooseSmoothVoicing(chordA, chordB);
    const voicedMovement = totalMovementBetween(chordA, voiced);

    // כל היפוך אחר של chordB (סיבוב סדר התווים + הזזת אוקטבה) שאינו יוצר מקבילות
    // לא אמור להיות טוב יותר (root position כלול — גם הוא נבדק ונפסל אם יש מקבילות).
    for (let rotation = 0; rotation < chordB.length; rotation += 1) {
      const rotatedCandidate = [
        ...chordB.slice(rotation),
        ...chordB.slice(0, rotation).map((pitch) => pitch + 12),
      ];
      if (hasParallelMotion(chordA, rotatedCandidate)) {
        continue; // לא באמת מועמד חוקי — לא רלוונטי להשוואה
      }
      expect(voicedMovement).toBeLessThanOrEqual(totalMovementBetween(chordA, rotatedCandidate));
    }
  });
});
