/**
 * @file        beatPattern.test.ts
 * @description ⭐ 2026-08-31 (סבב א'): בדיקות למקצב הידני. שתי ההבטחות שנבדקות כאן הן מה
 *              שהמשתמש ביקש: (א) המקצב **קבוע** בין ציורים — זה מה שמחזיר לסגנון את זהותו;
 *              (ב) הציור עדיין קובע את כל השאר, ולכן שתי יצירות עם אותו מקצב עדיין שונות.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { ShapeData } from '@soundiform/shared';
import { geometryToMusic } from '../mapping/geometryToMusic';
import { composeMusicalScore, type CompositionConfig } from './harmonyEngine';
import { validateConstitution } from './rules';
import { beatHitsForBar, piecesOwnedByPattern, type BeatPattern } from './beatPattern';

const FOUR_ON_FLOOR: BeatPattern = {
  id: 'four-on-floor',
  stepsPerBar: 16,
  pieces: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    'hihat-closed': [0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0],
  },
};

const BASE_CONFIG: CompositionConfig = {
  genreId: 'beat-test',
  tempoBpm: 124,
  mode: 'aeolian',
  gridSubdivision: 16,
  swingAmount: 0,
  chordProgression: [0, 5, 3, 4],
  extendedChords: false,
  absoluteNoteBoard: true,
};

function wavy(cycles: number, seed: number): ShapeData {
  const pointCount = 48;
  return {
    version: '1.0.0',
    paths: [
      {
        points: Array.from({ length: pointCount }, (_, index) => {
          const t = index / (pointCount - 1);
          return { x: t, y: 0.5 + 0.42 * Math.sin(2 * Math.PI * cycles * t + seed) };
        }),
        closed: false,
      },
    ],
  };
}

function drumsOf(shape: ShapeData, seed: string, config: CompositionConfig) {
  const score = composeMusicalScore(geometryToMusic(shape, seed), config);
  return score.tracks.find((track) => track.role === 'drums')?.notes ?? [];
}

describe('piecesOwnedByPattern', () => {
  it('מחזיר רק חלקים עם פגיעות בפועל', () => {
    const owned = piecesOwnedByPattern(FOUR_ON_FLOOR);
    expect([...owned].sort()).toEqual(['hihat-closed', 'kick']);
  });

  it('חלק שכל הצעדים שלו אפס אינו נחשב מוחזק — הציור ימשיך לספק אותו', () => {
    const owned = piecesOwnedByPattern({
      ...FOUR_ON_FLOOR,
      pieces: { ...FOUR_ON_FLOOR.pieces, snare: [0, 0, 0, 0] },
    });
    expect(owned.has('snare')).toBe(false);
  });
});

describe('beatHitsForBar', () => {
  it('כל הפגיעות, ממוינות לפי זמן', () => {
    const hits = beatHitsForBar(FOUR_ON_FLOOR);
    expect(hits.length).toBe(8);
    for (let index = 1; index < hits.length; index += 1) {
      expect(hits[index]?.step).toBeGreaterThanOrEqual(hits[index - 1]?.step ?? 0);
    }
  });
});

describe('מקצב ידני בתוך היצירה', () => {
  const withBeat: CompositionConfig = { ...BASE_CONFIG, beatPattern: FOUR_ON_FLOOR };

  it('הקיק זהה בין שני ציורים שונים לגמרי — זו כל מטרת המקצב הידני', () => {
    const kicksOf = (shape: ShapeData, seed: string) =>
      drumsOf(shape, seed, withBeat)
        .filter((note) => note.drumPiece === 'kick')
        .map((note) => note.startTick);
    // ⚠️ משווים רק את הבר הראשון: אורך היצירה נגזר מהצורה, ולכן מספר הברים שונה.
    const firstBar = (ticks: number[]) => ticks.filter((tick) => tick < 1920).length;
    expect(firstBar(kicksOf(wavy(2, 0), 'beat-a'))).toBe(firstBar(kicksOf(wavy(9, 1), 'beat-b')));
    expect(firstBar(kicksOf(wavy(2, 0), 'beat-a'))).toBe(4);
  });

  it('הליד עדיין שונה בין הציורים — המקצב לא השתלט על היצירה', () => {
    const leadOf = (shape: ShapeData, seed: string) =>
      (
        composeMusicalScore(geometryToMusic(shape, seed), withBeat).tracks.find(
          (track) => track.role === 'lead',
        )?.notes ?? []
      ).map((note) => note.pitch);
    expect(leadOf(wavy(2, 0), 'beat-a')).not.toEqual(leadOf(wavy(9, 1), 'beat-b'));
  });

  it('היברידי: חלקים שהמקצב לא מחזיק עדיין מגיעים מהציור', () => {
    const notes = drumsOf(wavy(6, 0), 'beat-hybrid', withBeat);
    const pieces = new Set(notes.map((note) => note.drumPiece));
    expect(pieces.has('kick')).toBe(true);
    // קראש/סנר/טום אינם בתבנית — אם אף אחד מהם לא הופיע, ההיברידיות לא עובדת.
    const fromDrawing = [...pieces].filter((piece) => piece !== 'kick' && piece !== 'hihat-closed');
    expect(fromDrawing.length).toBeGreaterThan(0);
  });

  it('בלי מקצב — התופים נגזרים מהציור בלבד, בדיוק כמו קודם', () => {
    const withoutBeat = drumsOf(wavy(6, 0), 'beat-none', BASE_CONFIG);
    const withBeatNotes = drumsOf(wavy(6, 0), 'beat-none', withBeat);
    expect(withoutBeat.length).not.toBe(withBeatNotes.length);
    expect(withoutBeat.length).toBeGreaterThan(0);
  });

  it('אין שתי מכות של אותו חלק באותו רגע (ההנחה של DrumKitProvider)', () => {
    for (const cycles of [1, 4, 9]) {
      const notes = drumsOf(wavy(cycles, 0), `beat-collide-${String(cycles)}`, withBeat);
      const seen = new Map<string, number>();
      for (const note of [...notes].sort((a, b) => a.startTick - b.startTick)) {
        const piece = note.drumPiece ?? '?';
        expect(seen.get(piece) === note.startTick, `${piece} @ ${String(cycles)}`).toBe(false);
        seen.set(piece, note.startTick);
      }
    }
  });

  it('המקצב לא מפר את החוקה (§4.3)', () => {
    const score = composeMusicalScore(geometryToMusic(wavy(5, 0), 'beat-rules'), withBeat);
    expect(validateConstitution(score)).toHaveLength(0);
  });

  // ⭐ 2026-08-31 — נתפס בבדיקה חיה, פעם שלישית מאותה משפחה. מקצב בשש-עשרות בסגנון שמרשה
  // קוונטיזציה לשמיניות מקפל שתי פגיעות סמוכות לאותו טיק; בלי מטמון-תזמון כל אחת קיבלה
  // ריצוד משלה ונחתה מילישניות מהשנייה — מרחק שעובר את הגנת-הדילוג אבל נצמד לאותו
  // בלוק-עיבוד, ואז Tone.Source.start זורק ומפיל את **כל** הרינדור.
  it('אין שתי מכות של אותו חלק במרווח שקטן מסף-ההגנה, גם בגריד גס מהמקצב', () => {
    const MONO_GUARD_SECONDS = 0.012;
    const sixteenthHats: BeatPattern = {
      id: 'dense-hats',
      stepsPerBar: 16,
      pieces: {
        'hihat-closed': Array.from({ length: 16 }, () => 0.4),
        kick: FOUR_ON_FLOOR.pieces.kick ?? [],
      },
    };
    // ⚠️ gridSubdivision: 8 הוא בדיוק המקרה — שתי שש-עשרות נופלות על אותה שמינית.
    const coarseGrid: CompositionConfig = {
      ...BASE_CONFIG,
      gridSubdivision: 8,
      beatPattern: sixteenthHats,
    };
    for (const cycles of [1, 4, 9]) {
      const score = composeMusicalScore(
        geometryToMusic(wavy(cycles, 0), `coarse-${String(cycles)}`),
        coarseGrid,
      );
      const secondsPerTick = 60 / score.tempo / 480;
      const drums = score.tracks.find((track) => track.role === 'drums')?.notes ?? [];
      const lastByPiece = new Map<string, number>();
      for (const note of [...drums].sort((a, b) => a.startTick - b.startTick)) {
        const piece = note.drumPiece ?? '?';
        const previous = lastByPiece.get(piece);
        if (previous !== undefined) {
          const gapSeconds = (note.startTick - previous) * secondsPerTick;
          expect(
            gapSeconds === 0 || gapSeconds >= MONO_GUARD_SECONDS,
            `${piece} @ ${String(cycles)}`,
          ).toBe(true);
        }
        lastByPiece.set(piece, note.startTick);
      }
    }
  });
});

describe('בחירת סולם', () => {
  it('שורש אחר מייצר גבהים אחרים לגמרי — הפלטה כבר לא זהה', () => {
    const pitchesFor = (rootPitchClass: number) =>
      new Set(
        (
          composeMusicalScore(geometryToMusic(wavy(4, 0), 'key-test'), {
            ...BASE_CONFIG,
            noteBoardRootPitchClass: rootPitchClass,
          }).tracks.find((track) => track.role === 'lead')?.notes ?? []
        ).map((note) => note.pitch),
      );
    const inC = pitchesFor(0);
    const inFSharp = pitchesFor(6);
    expect(inC.size).toBeGreaterThan(0);
    // חפיפה מלאה הייתה אומרת שהשורש לא באמת השפיע.
    const overlap = [...inC].filter((pitch) => inFSharp.has(pitch)).length;
    expect(overlap).toBeLessThan(inC.size);
  });

  it('מוד אחר משנה את הסולם', () => {
    const notesFor = (mode: CompositionConfig['mode']) =>
      (
        composeMusicalScore(geometryToMusic(wavy(4, 0), 'mode-test'), {
          ...BASE_CONFIG,
          mode,
        }).tracks.find((track) => track.role === 'lead')?.notes ?? []
      ).map((note) => note.pitch);
    expect(notesFor('aeolian')).not.toEqual(notesFor('lydian'));
  });
});
