/**
 * @file        rules.test.ts
 * @description בדיקות יחידה לוולידטור החוקה המוזיקלית (§4.3).
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { MusicalScore, Note, Track } from '../score/MusicalScore';
import { isConstitutionCompliant, validateConstitution } from './rules';

const BASE_NOTE: Note = {
  startTick: 0,
  durationTicks: 480,
  pitch: 64,
  velocity: 0.7,
  articulation: 'legato',
};

function makeScoreWithNote(role: Track['role'], note: Note): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'test-seed',
    tempo: 120,
    timeSignature: [4, 4],
    key: { root: 60, mode: 'ionian' },
    genreId: 'default',
    durationBars: 1,
    tracks: [
      {
        role,
        instrumentId: 'test',
        notes: [note],
        mixSettings: { volume: 0.8, pan: 0, reverbSend: 0, delaySend: 0 },
      },
    ],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 1 }],
    metadata: { avgNoteDensity: 1, dominantMode: 'ionian', rootFrequencyHz: 261.63 },
  };
}

describe('validateConstitution', () => {
  it('score תקין (בסולם, מקוונטז, טווח ריאלי) לא מייצר הפרות', () => {
    const score = makeScoreWithNote('lead', BASE_NOTE);
    expect(validateConstitution(score)).toHaveLength(0);
    expect(isConstitutionCompliant(score)).toBe(true);
  });

  it('תו מחוץ לסולם מזוהה כהפרה', () => {
    const score = makeScoreWithNote('lead', { ...BASE_NOTE, pitch: 61 }); // C# — לא בסולם C ionian
    const violations = validateConstitution(score);
    expect(violations.some((violation) => violation.rule === 'note-in-scale')).toBe(true);
  });

  it('תזמון לא-מקוונטז מזוהה כהפרה', () => {
    const score = makeScoreWithNote('lead', { ...BASE_NOTE, startTick: 37 }); // לא מיושר לגריד 16
    const violations = validateConstitution(score);
    expect(violations.some((violation) => violation.rule === 'quantized-to-grid')).toBe(true);
  });

  it('פיץ מחוץ לטווח ריאליסטי של התפקיד מזוהה כהפרה', () => {
    const score = makeScoreWithNote('bass', { ...BASE_NOTE, pitch: 110 }); // הרבה מעל טווח בס סביר
    const violations = validateConstitution(score);
    expect(violations.some((violation) => violation.rule === 'realistic-range')).toBe(true);
  });
});
