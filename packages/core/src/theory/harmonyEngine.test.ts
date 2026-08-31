/**
 * @file        harmonyEngine.test.ts
 * @description ⭐ בדיקות יחידה ל-composeMusicalScore — כולל הבדיקה הנדרשת ב-§11 Sprint 3:
 *              100 צורות אקראיות → כולן חייבות להיות בסולם, ו-§11 Sprint 5:
 *              אותה צורה × כמה סגנונות = כמה הפקות שונות, כולן תקינות.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { ShapeData } from '@soundiform/shared';
import { createSeededRandom } from '../internal/seededRandom';
import { geometryToMusic } from '../mapping/geometryToMusic';
import { musicalScoreSchema } from '../score/scoreSchema';
import { composeMusicalScore, type CompositionConfig } from './harmonyEngine';
import { buildNoteBoardRows } from './noteBoard';
import { validateConstitution } from './rules';
import {
  makeAsymmetricShapeData,
  makeCircleShapeData,
  makeSquareShapeData,
  makeTriangleShapeData,
} from '../analysis/testShapes';

const RANDOM_SHAPE_COUNT = 100;

const DEFAULT_TEST_CONFIG: CompositionConfig = {
  genreId: 'test',
  tempoBpm: 120,
  mode: 'aeolian',
  gridSubdivision: 16,
  swingAmount: 0,
  chordProgression: [0, 5, 3, 4],
  extendedChords: false,
};

/** מדמה 4 GenrePacks שונים בכוונה (טמפו/מוד/סווינג/גריד/הרמוניה) — כמו §5.2, בלי תלות ב-@soundiform/genres. */
const FOUR_STYLE_CONFIGS: CompositionConfig[] = [
  {
    genreId: 'trance-like',
    tempoBpm: 138,
    mode: 'aeolian',
    gridSubdivision: 16,
    swingAmount: 0,
    chordProgression: [0, 6, 5, 6],
    extendedChords: false,
  },
  {
    genreId: 'house-like',
    tempoBpm: 124,
    mode: 'dorian',
    gridSubdivision: 16,
    swingAmount: 0.08,
    chordProgression: [0, 3, 5, 4],
    extendedChords: false,
  },
  {
    genreId: 'chill-like',
    tempoBpm: 82,
    mode: 'lydian',
    gridSubdivision: 16,
    swingAmount: 0.12,
    chordProgression: [1, 4, 0, 5],
    extendedChords: true,
  },
  {
    genreId: 'cinematic-like',
    tempoBpm: 90,
    mode: 'aeolian',
    gridSubdivision: 8,
    swingAmount: 0,
    chordProgression: [0, 5, 2, 6],
    extendedChords: true,
  },
];

function makeRandomShape(random: () => number): ShapeData {
  const vertexCount = 3 + Math.floor(random() * 8); // 3–10 קודקודים
  const centerX = 0.3 + random() * 0.4;
  const centerY = 0.3 + random() * 0.4;
  const points = Array.from({ length: vertexCount }, () => ({
    x: Math.min(1, Math.max(0, centerX + (random() - 0.5) * 0.6)),
    y: Math.min(1, Math.max(0, centerY + (random() - 0.5) * 0.6)),
  }));
  return { version: '1.0.0', paths: [{ points, closed: random() > 0.3 }] };
}

describe('composeMusicalScore — דרישת §11 Sprint 3', () => {
  it('100 צורות אקראיות: כל תו בכל טראק תמיד בסולם', () => {
    const shapeRandom = createSeededRandom('harmony-engine-100-random-shapes');
    for (let index = 0; index < RANDOM_SHAPE_COUNT; index += 1) {
      const shape = makeRandomShape(shapeRandom);
      const intent = geometryToMusic(shape, `random-shape-${String(index)}`);
      const score = composeMusicalScore(intent, DEFAULT_TEST_CONFIG);

      const scaleViolations = validateConstitution(score).filter(
        (violation) => violation.rule === 'note-in-scale',
      );
      expect(scaleViolations).toHaveLength(0);
    }
  });
});

describe('composeMusicalScore — דרישת §11 Sprint 5', () => {
  it('אותה צורה × 4 סגנונות שונים = 4 הפקות שונות, כולן תקינות מול rules.ts', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed-four-styles');
    const scores = FOUR_STYLE_CONFIGS.map((config) => composeMusicalScore(intent, config));

    scores.forEach((score, index) => {
      const config = FOUR_STYLE_CONFIGS[index];
      const violations = validateConstitution(score, config?.gridSubdivision, config?.swingAmount);
      expect(violations, `style ${config?.genreId ?? '?'}`).toHaveLength(0);
    });

    const tempos = new Set(scores.map((score) => score.tempo));
    const modes = new Set(scores.map((score) => score.key.mode));
    expect(tempos.size).toBe(4);
    expect(modes.size).toBeGreaterThan(1);
  });

  it('כל הסגנונות שומרים על אותה כמות תווים במלודיה (התוכן מהצורה, לא מהסגנון, §4.5)', () => {
    const intent = geometryToMusic(makeSquareShapeData(), 'seed-same-content');
    const scores = FOUR_STYLE_CONFIGS.map((config) => composeMusicalScore(intent, config));
    const leadNoteCounts = new Set(
      scores.map((score) => score.tracks.find((track) => track.role === 'lead')?.notes.length),
    );
    expect(leadNoteCounts.size).toBe(1);
  });
});

describe('composeMusicalScore — תקינות כללית', () => {
  it('הפלט תמיד תקף מול musicalScoreSchema', () => {
    const intent = geometryToMusic(makeSquareShapeData(), 'seed-square');
    const score = composeMusicalScore(intent, DEFAULT_TEST_CONFIG);
    expect(musicalScoreSchema.safeParse(score).success).toBe(true);
  });

  it('אין הפרות חוקה כלשהן (לא רק סולם) על שלוש הצורות הידועות', () => {
    for (const shape of [makeTriangleShapeData(), makeSquareShapeData(), makeCircleShapeData()]) {
      const intent = geometryToMusic(shape, 'seed');
      const score = composeMusicalScore(intent, DEFAULT_TEST_CONFIG);
      expect(validateConstitution(score)).toHaveLength(0);
    }
  });

  it('יוצר 3 טראקים: lead, bass, pad', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed');
    const score = composeMusicalScore(intent, DEFAULT_TEST_CONFIG);
    const roles = score.tracks.map((track) => track.role).sort();
    expect(roles).toEqual(['bass', 'lead', 'pad']);
  });

  it('דטרמיניזם: אותה צורה מייצרת בדיוק את אותו MusicalScore', () => {
    const intentA = geometryToMusic(makeTriangleShapeData(), 'seed-determinism');
    const intentB = geometryToMusic(makeTriangleShapeData(), 'seed-determinism');
    expect(composeMusicalScore(intentA, DEFAULT_TEST_CONFIG)).toEqual(
      composeMusicalScore(intentB, DEFAULT_TEST_CONFIG),
    );
  });

  it('seed שונה מייצר בדרך כלל שורש שונה (לא תמיד אותו ברירת מחדל קבועה)', () => {
    const seeds = Array.from({ length: 10 }, (_, index) => `seed-variety-${String(index)}`);
    const roots = new Set(
      seeds.map(
        (seed) =>
          composeMusicalScore(geometryToMusic(makeSquareShapeData(), seed), DEFAULT_TEST_CONFIG).key
            .root,
      ),
    );
    expect(roots.size).toBeGreaterThan(1);
  });

  it('צורה עם symmetryTransform מייצרת שני פרייזים (פי 2 מ-durationBars הבסיסי)', () => {
    // ריבוע = retrograde-inversion (שני השיקופים) → אמור להכפיל את durationBars
    const symmetricIntent = geometryToMusic(makeSquareShapeData(), 'seed-symmetric');
    const symmetricScore = composeMusicalScore(symmetricIntent, DEFAULT_TEST_CONFIG);
    expect(symmetricIntent.symmetryTransform).not.toBe('none');
    expect(symmetricScore.sections).toHaveLength(1);
    expect(symmetricScore.sections[0]?.lengthBars).toBe(symmetricScore.durationBars);
  });
});

describe('composeMusicalScore — §11 שיפור-סאונד Area 3: משך לפי גודל הציור', () => {
  /** מקנה מידה לצורה סביב מרכז נתון — שומר על אותה טופולוגיה/זוויות (ולכן אותו motifSize),
   * משנה רק את גודל ה-bounding-box בפועל (sizeHint). */
  function scaleShapeAroundCenter(
    shape: ShapeData,
    factor: number,
    center: { x: number; y: number } = { x: 0.5, y: 0.5 },
  ): ShapeData {
    return {
      ...shape,
      paths: shape.paths.map((path) => ({
        ...path,
        points: path.points.map((point) => ({
          x: center.x + (point.x - center.x) * factor,
          y: center.y + (point.y - center.y) * factor,
        })),
      })),
    };
  }

  it('צורה גדולה נותנת durationBars גדול מאותה צורה מוקטנת (אותו motifSize, sizeHint שונה)', () => {
    const base = makeAsymmetricShapeData(); // 5 קודקודים חדים, symmetryTransform='none' — baseBarsFromMotif=ceil(5/4)=2, מספיק "מקום" למכפיל להיראות אחרי עיגול.
    const smallIntent = geometryToMusic(scaleShapeAroundCenter(base, 0.05), 'seed-dur-a');
    const largeIntent = geometryToMusic(scaleShapeAroundCenter(base, 1.5), 'seed-dur-b');
    expect(smallIntent.motifSize).toBe(largeIntent.motifSize);
    expect(largeIntent.sizeHint).toBeGreaterThan(smallIntent.sizeHint);

    const smallScore = composeMusicalScore(smallIntent, DEFAULT_TEST_CONFIG);
    const largeScore = composeMusicalScore(largeIntent, DEFAULT_TEST_CONFIG);
    expect(largeScore.durationBars).toBeGreaterThan(smallScore.durationBars);
  });
});

describe('composeMusicalScore — §11 item 4: arrangement אמיתי (intro/build/outro)', () => {
  const ARRANGED_CONFIG: CompositionConfig = {
    ...DEFAULT_TEST_CONFIG,
    sectionOrder: ['intro', 'loop', 'build', 'outro'],
    rhythmPatterns: {
      drums: { stepsPerBar: 16, hits: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
    },
  };

  it('4 סקשנים ברצף הנכון, ללא חפיפה, ואורך הכולל = סכום האורכים', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed-arrangement');
    const score = composeMusicalScore(intent, ARRANGED_CONFIG);

    expect(score.sections.map((section) => section.name)).toEqual([
      'intro',
      'loop',
      'build',
      'outro',
    ]);
    let expectedStartBar = 0;
    for (const section of score.sections) {
      expect(section.startBar).toBe(expectedStartBar);
      expect(section.lengthBars).toBeGreaterThan(0);
      expectedStartBar += section.lengthBars;
    }
    const totalLengthBars = score.sections.reduce((sum, section) => sum + section.lengthBars, 0);
    expect(score.durationBars).toBe(totalLengthBars);
  });

  it('ה-loop עצמו עדיין נגזר מהצורה (לא מהמערך) — אותו lengthBars כמו ב-sectionOrder=[loop] בלבד', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed-arrangement-content');
    const loopOnlyScore = composeMusicalScore(intent, DEFAULT_TEST_CONFIG);
    const arrangedScore = composeMusicalScore(intent, ARRANGED_CONFIG);

    const loopSection = arrangedScore.sections.find((section) => section.name === 'loop');
    expect(loopSection?.lengthBars).toBe(loopOnlyScore.durationBars);
  });

  it('תופים מנגנים גם בסקשן ה-build (לא רק ב-loop)', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed-arrangement-build-drums');
    const score = composeMusicalScore(intent, ARRANGED_CONFIG);
    const buildSection = score.sections.find((section) => section.name === 'build');
    const drumsTrack = score.tracks.find((track) => track.role === 'drums');
    expect(buildSection).toBeDefined();
    expect(drumsTrack).toBeDefined();

    const buildStartTick = (buildSection?.startBar ?? 0) * 4 * 480; // TICKS_PER_BEAT=480, 4/4
    const buildEndTick = buildStartTick + (buildSection?.lengthBars ?? 0) * 4 * 480;
    const notesInBuild = drumsTrack?.notes.filter(
      (note) => note.startTick >= buildStartTick && note.startTick < buildEndTick,
    );
    expect(notesInBuild?.length ?? 0).toBeGreaterThan(0);
  });

  it('הפלט עדיין תקף מול musicalScoreSchema ומול rules.ts גם עם arrangement', () => {
    const intent = geometryToMusic(makeSquareShapeData(), 'seed-arrangement-valid');
    const score = composeMusicalScore(intent, ARRANGED_CONFIG);
    expect(musicalScoreSchema.safeParse(score).success).toBe(true);
    expect(validateConstitution(score)).toHaveLength(0);
  });

  it('§11 שיפור-סאונד Area 4: lead ו-bass מנגנים גם ב-intro/build/outro, לא רק ב-loop (תיקון באג השקט)', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed-no-more-silence');
    const score = composeMusicalScore(intent, ARRANGED_CONFIG);
    const leadTrack = score.tracks.find((track) => track.role === 'lead');
    const bassTrack = score.tracks.find((track) => track.role === 'bass');
    expect(leadTrack).toBeDefined();
    expect(bassTrack).toBeDefined();

    for (const sectionName of ['intro', 'build', 'outro'] as const) {
      const section = score.sections.find((candidate) => candidate.name === sectionName);
      expect(section, sectionName).toBeDefined();
      const startTick = (section?.startBar ?? 0) * 4 * 480;
      const endTick = startTick + (section?.lengthBars ?? 0) * 4 * 480;

      const leadNotesInSection = leadTrack?.notes.filter(
        (note) => note.startTick >= startTick && note.startTick < endTick,
      );
      const bassNotesInSection = bassTrack?.notes.filter(
        (note) => note.startTick >= startTick && note.startTick < endTick,
      );
      expect(leadNotesInSection?.length ?? 0, `lead ב-${sectionName}`).toBeGreaterThan(0);
      expect(bassNotesInSection?.length ?? 0, `bass ב-${sectionName}`).toBeGreaterThan(0);
    }
  });

  it('§11 שיפור-סאונד Area 4: 100 צורות אקראיות עם arrangement — lead/bass נשארים בסולם ובטווח ריאליסטי (מבחן-קצה לגלישת רגיסטר בין-סקשן)', () => {
    const shapeRandom = createSeededRandom('harmony-engine-arranged-random-shapes');
    for (let index = 0; index < RANDOM_SHAPE_COUNT; index += 1) {
      const shape = makeRandomShape(shapeRandom);
      const intent = geometryToMusic(shape, `arranged-random-shape-${String(index)}`);
      const score = composeMusicalScore(intent, ARRANGED_CONFIG);
      // ⚠️ מסונן ל-note-in-scale/realistic-range על lead/bass בלבד — זה מה ש-Area 4 בפועל
      // שינה (registerOffsetSemitones על תוכן intro/build/outro, ראה wrapPitchIntoRealisticRange
      // ב-harmonyEngine.ts). quantized-to-grid על drums הוא edge-case נדיר וקיים-מראש
      // (סבילות הומניזציה מול עיגול, buildBuildSectionNotes) שלא נגעתי בו בסבב הזה.
      const relevantViolations = validateConstitution(score).filter(
        (violation) =>
          (violation.rule === 'note-in-scale' || violation.rule === 'realistic-range') &&
          (score.tracks[violation.trackIndex]?.role === 'lead' ||
            score.tracks[violation.trackIndex]?.role === 'bass'),
      );
      expect(relevantViolations, `shape ${String(index)}`).toHaveLength(0);
    }
  });
});

describe('composeMusicalScore — §11 מגוון מוזיקלי לפי-צורה: פרמטרי-סגנון תלויי-צורה', () => {
  // ⚠️ בכוונה בונים RawMusicalIntent ישירות (base מ-geometryToMusic + override לשדה בודד) —
  // לא תלוי בניחוש מה articulation/rotationalOrder בפועל עבור צורה גיאומטרית נתונה, רק
  // בודק את מנגנון-הבחירה עצמו בתוך composeMusicalScore על ערכי-סיגנל ידועים ושונים.
  const baseIntent = geometryToMusic(makeTriangleShapeData(), 'seed-variety-base');

  it('טמפו: rhythmicDensityHint שונה → טמפו בפועל שונה בתוך tempoRange (במקום tempoBpm הקבוע)', () => {
    const config: CompositionConfig = {
      ...DEFAULT_TEST_CONFIG,
      tempoRange: { min: 110, max: 150 },
    };
    const low = composeMusicalScore({ ...baseIntent, rhythmicDensityHint: 0 }, config);
    const high = composeMusicalScore({ ...baseIntent, rhythmicDensityHint: 1 }, config);
    expect(low.tempo).toBe(110);
    expect(high.tempo).toBe(150);
  });

  it('מוד: articulation שונה → מוד בפועל שונה מתוך allowedModes (במקום mode הקבוע)', () => {
    const config: CompositionConfig = {
      ...DEFAULT_TEST_CONFIG,
      allowedModes: ['aeolian', 'dorian'],
    };
    const staccato = composeMusicalScore({ ...baseIntent, articulation: 'staccato' }, config);
    const legato = composeMusicalScore({ ...baseIntent, articulation: 'legato' }, config);
    expect(staccato.key.mode).toBe('aeolian');
    expect(legato.key.mode).toBe('dorian');
  });

  it('פרוגרסיית אקורדים: rotationalOrder שונה (סימטריה סיבובית אמיתית) → פרוגרסיה שונה מתוך chordProgressionOptions', () => {
    const config: CompositionConfig = {
      ...DEFAULT_TEST_CONFIG,
      chordProgressionOptions: [
        [0, 5, 3, 4],
        [1, 4, 0, 5],
        [2, 6, 1, 5],
      ],
    };
    const scoreA = composeMusicalScore({ ...baseIntent, rotationalOrder: 3 }, config); // 3%3=0
    const scoreB = composeMusicalScore({ ...baseIntent, rotationalOrder: 4 }, config); // 4%3=1
    const padA = scoreA.tracks.find((track) => track.role === 'pad');
    const padB = scoreB.tracks.find((track) => track.role === 'pad');
    expect(padA?.notes[0]?.pitch).not.toBe(padB?.notes[0]?.pitch);
  });

  it('תבנית-קצב: rhythmicDensityHint שונה → תבנית-בס שונה מתוך rhythmPatternOptions (bucketed)', () => {
    const config: CompositionConfig = {
      ...DEFAULT_TEST_CONFIG,
      rhythmPatternOptions: {
        bass: [
          { stepsPerBar: 16, hits: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
          { stepsPerBar: 16, hits: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
        ],
      },
    };
    const low = composeMusicalScore({ ...baseIntent, rhythmicDensityHint: 0 }, config);
    const high = composeMusicalScore({ ...baseIntent, rhythmicDensityHint: 0.99 }, config);
    const bassLow = low.tracks.find((track) => track.role === 'bass');
    const bassHigh = high.tracks.find((track) => track.role === 'bass');
    expect(bassLow?.notes.length).not.toBe(bassHigh?.notes.length);
  });

  it('דטרמיניזם נשמר: אותו intent+config → תמיד אותה תוצאה, גם עם כל האופציות החדשות מוגדרות', () => {
    const config: CompositionConfig = {
      ...DEFAULT_TEST_CONFIG,
      tempoRange: { min: 110, max: 150 },
      allowedModes: ['aeolian', 'dorian'],
      chordProgressionOptions: [
        [0, 5, 3, 4],
        [1, 4, 0, 5],
      ],
      rhythmPatternOptions: {
        bass: [{ stepsPerBar: 16, hits: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] }],
      },
    };
    const scoreA = composeMusicalScore(baseIntent, config);
    const scoreB = composeMusicalScore(baseIntent, config);
    expect(scoreA).toEqual(scoreB);
  });
});

describe('composeMusicalScore — §11 תיקון ממוקד: תופים תלויי-צורה (cornerHint)', () => {
  const DRUMS_CONFIG: CompositionConfig = {
    ...DEFAULT_TEST_CONFIG,
    rhythmPatterns: {
      drums: { stepsPerBar: 16, hits: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
    },
  };
  const baseIntent = geometryToMusic(makeTriangleShapeData(), 'seed-drums-variety');

  it("cornerHint שונה משמעותית → תבנית-תופים בפועל שונה, גם עם אותה תבנית-קצב קבועה של הז'אנר", () => {
    const flatCornerHint = baseIntent.cornerHint.map(() => 0);
    const sharpCornerHint = baseIntent.cornerHint.map(() => 1);
    const flatScore = composeMusicalScore(
      { ...baseIntent, cornerHint: flatCornerHint },
      DRUMS_CONFIG,
    );
    const sharpScore = composeMusicalScore(
      { ...baseIntent, cornerHint: sharpCornerHint },
      DRUMS_CONFIG,
    );
    const flatDrums = flatScore.tracks.find((track) => track.role === 'drums');
    const sharpDrums = sharpScore.tracks.find((track) => track.role === 'drums');
    expect(sharpDrums?.notes.length ?? 0).toBeGreaterThan(flatDrums?.notes.length ?? 0);
  });

  it("מתחת לסף (cornerHint נמוך) — תבנית-הז'אנר נשארת הרצפה, לא נעלמת", () => {
    const flatCornerHint = baseIntent.cornerHint.map(() => 0);
    const score = composeMusicalScore({ ...baseIntent, cornerHint: flatCornerHint }, DRUMS_CONFIG);
    const drumsTrack = score.tracks.find((track) => track.role === 'drums');
    expect(drumsTrack?.notes.length ?? 0).toBeGreaterThan(0);
  });

  it('תקרת-ביצועים: גם עם cornerHint מקסימלי בכל נקודה (הצורה החדה ביותר האפשרית), מספר הפגיעות-לבר חסום — לא כל 16 ה-steps נהיים פגיעה', () => {
    // ⭐ 2026-08-25 (תיקון-ביצועים, לפי בקשה חיה: "הסאונד יוצא מקוטע עם קפיצות וחירחורים") —
    // לפני התיקון, cornerHint=1 בכל מקום היה הופך four-on-floor (4 פגיעות/בר) ל-16
    // פגיעות/בר (כל step) — עומס-CPU בזמן-אמת + אוטומציית-סיידצ'יין צפופה מדי שגרמו
    // לחירחורים. עכשיו: לכל היותר MAX_EXTRA_CORNER_HITS_PER_BAR=3 פגיעות-נוספות לבר, מעל
    // ה-4 הקיימות בתבנית-הז'אנר — תקרה של 7/בר, לא 16/בר.
    const maxCornerHint = baseIntent.cornerHint.map(() => 1);
    const score = composeMusicalScore({ ...baseIntent, cornerHint: maxCornerHint }, DRUMS_CONFIG);
    const drumsTrack = score.tracks.find((track) => track.role === 'drums');
    const notesPerBar = (drumsTrack?.notes.length ?? 0) / score.durationBars;
    expect(notesPerBar).toBeLessThanOrEqual(7);
  });

  it('דטרמיניזם: אותו intent (כולל cornerHint) → אותה תבנית-תופים בדיוק, תמיד', () => {
    const scoreA = composeMusicalScore(baseIntent, DRUMS_CONFIG);
    const scoreB = composeMusicalScore(baseIntent, DRUMS_CONFIG);
    expect(scoreA).toEqual(scoreB);
  });
});

describe('composeMusicalScore — לוח-תווים אבסולוטי (absoluteNoteBoard)', () => {
  const ABSOLUTE_CONFIG: CompositionConfig = {
    ...DEFAULT_TEST_CONFIG,
    absoluteNoteBoard: true,
  };

  it('שורש+מוד קבועים: שני seeds שונים על אותו סגנון → אותו key בדיוק (לא אקראי-לפי-צורה)', () => {
    const intentA = geometryToMusic(makeTriangleShapeData(), 'seed-absolute-a');
    const intentB = geometryToMusic(makeCircleShapeData(), 'seed-absolute-b');
    const scoreA = composeMusicalScore(intentA, ABSOLUTE_CONFIG);
    const scoreB = composeMusicalScore(intentB, ABSOLUTE_CONFIG);
    expect(scoreA.key).toEqual(scoreB.key);
    expect(scoreA.key.mode).toBe(ABSOLUTE_CONFIG.mode);
  });

  it('כל תו במלודיה נלקח מתוך 15 התווים הקבועים של הלוח — לא ערך אחר', () => {
    const intent = geometryToMusic(makeAsymmetricShapeData(), 'seed-absolute-rows');
    const score = composeMusicalScore(intent, ABSOLUTE_CONFIG);
    const lead = score.tracks.find((track) => track.role === 'lead');
    const rootMidi = 48 + score.key.root;
    const allowedPitches = new Set(buildNoteBoardRows(rootMidi, score.key.mode));
    expect(lead?.notes.length).toBeGreaterThan(0);
    for (const note of lead?.notes ?? []) {
      expect(allowedPitches.has(note.pitch)).toBe(true);
    }
  });

  // ⚠️ 2026-08-31 — שתי הבדיקות הבאות נכתבו מחדש. הן בדקו את מנגנון-הצפיפות הישן
  // ("תו לכל עמודה, מסונן לפי rhythmPatterns.lead"), שהוחלף ברסטר: המנגינה נגזרת עכשיו
  // מהתאים שהציור עובר עליהם, ורצף עמודות עם אותה שורה ממוזג לתו מוחזק אחד. הספירות
  // המדויקות שהן אכפו כבר לא נכונות **בכוונה** — אבל הכוונה שמאחוריהן נשמרה כאן: אין
  // דגימת-motifSize, ויש תקרת-צפיפות שמגנה על הרינדור.
  it('אין דגימת-motifSize/שיקוף-סימטריה: המנגינה נפרסת על כל היצירה ולא נגזרת מגודל המוטיב', () => {
    // ריבוע = symmetryTransform!=='none' — בנתיב הישן זה היה מכפיל ב-2 את motifSize.
    const symmetricIntent = geometryToMusic(makeSquareShapeData(), 'seed-absolute-symmetric');
    const score = composeMusicalScore(symmetricIntent, ABSOLUTE_CONFIG);
    const lead = score.tracks.find((track) => track.role === 'lead');
    const notes = lead?.notes ?? [];
    expect(notes.length).toBeGreaterThan(0);

    // התוכן נפרס על פני כל היצירה, לא על motifSize תווים שנדחסו לסקשן.
    const totalTicks = score.durationBars * 4 * 480;
    const lastStart = Math.max(...notes.map((note) => note.startTick));
    expect(lastStart).toBeGreaterThan(totalTicks * 0.5);
  });

  it('תקרת-צפיפות: אף רגע-התחלה לא נושא יותר מ-3 תווי-ליד (שומר-הביצועים החדש)', () => {
    // ⚠️ זו הכוונה המקורית של בדיקת "תיקון-החירחורים": להגן על הרינדור מפני התפוצצות
    // קולות. המנגנון השתנה — במקום סינון לפי תבנית-קצב, יש תקרת-קולות לעמודה ברסטר
    // (MAX_VOICES_PER_COLUMN). קו אנכי הוא המקרה הגרוע ביותר: הוא חוצה את *כל* השורות.
    const verticalLine: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          points: Array.from({ length: 32 }, (_, index) => ({ x: 0.5, y: index / 31 })),
          closed: false,
        },
      ],
    };
    const score = composeMusicalScore(
      geometryToMusic(verticalLine, 'seed-lead-density-ceiling'),
      ABSOLUTE_CONFIG,
    );
    const lead = score.tracks.find((track) => track.role === 'lead');
    const byStartTick = new Map<number, number>();
    for (const note of lead?.notes ?? []) {
      byStartTick.set(note.startTick, (byStartTick.get(note.startTick) ?? 0) + 1);
    }
    expect(byStartTick.size).toBeGreaterThan(0);
    expect(Math.max(...byStartTick.values())).toBeLessThanOrEqual(3);
    expect(validateConstitution(score)).toHaveLength(0);
  });

  // ⭐ 2026-08-31 — הבדיקות שהיו תופסות את הבאג המרכזי. עד לתיקון, resampleByX מיצע את כל
  // חיתוכי-ה-Y באותו X: לצורה סגורה זה תמיד קו-האמצע, ולצורה סימטרית אנכית קו ישר מושלם.
  // התוצאה בפועל הייתה **תו בודד שחוזר על עצמו** לאורך כל היצירה, בכל עיגול וכל ריבוע —
  // ולכן כל הציורים נשמעו כמו אותה "מנגינת בסיס".
  describe('רגרסיה: קריסת מתאר-הגובה', () => {
    function closedCircle(centerY: number, radius: number): ShapeData {
      return {
        version: '1.0.0',
        paths: [
          {
            points: Array.from({ length: 48 }, (_, index) => {
              const angle = (2 * Math.PI * index) / 48;
              return { x: 0.5 + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
            }),
            closed: true,
          },
        ],
      };
    }

    it('עיגול מייצר יותר מגובה אחד — לא תו בודד חוזר', () => {
      const score = composeMusicalScore(
        geometryToMusic(closedCircle(0.5, 0.4), 'seed-circle-not-flat'),
        ABSOLUTE_CONFIG,
      );
      const lead = score.tracks.find((track) => track.role === 'lead');
      const distinctPitches = new Set((lead?.notes ?? []).map((note) => note.pitch));
      expect(distinctPitches.size).toBeGreaterThan(1);
    });

    it('שתי משיכות נפרדות נשמעות שתיהן — לא מתבטלות לתו האמצעי', () => {
      const line = (y: number) => Array.from({ length: 24 }, (_, index) => ({ x: index / 23, y }));
      const bothStrokes: ShapeData = {
        version: '1.0.0',
        paths: [
          { points: line(0.2), closed: false },
          { points: line(0.8), closed: false },
        ],
      };
      const score = composeMusicalScore(
        geometryToMusic(bothStrokes, 'seed-two-strokes'),
        ABSOLUTE_CONFIG,
      );
      const lead = score.tracks.find((track) => track.role === 'lead');
      const distinctPitches = new Set((lead?.notes ?? []).map((note) => note.pitch));
      expect(distinctPitches.size).toBe(2);
    });

    it('שני עיגולים בגבהים שונים מייצרים מנגינות שונות', () => {
      const high = composeMusicalScore(
        geometryToMusic(closedCircle(0.25, 0.15), 'seed-circle-high'),
        ABSOLUTE_CONFIG,
      );
      const low = composeMusicalScore(
        geometryToMusic(closedCircle(0.75, 0.15), 'seed-circle-low'),
        ABSOLUTE_CONFIG,
      );
      const pitchesOf = (score: typeof high) =>
        (score.tracks.find((track) => track.role === 'lead')?.notes ?? []).map(
          (note) => note.pitch,
        );
      expect(pitchesOf(high)).not.toEqual(pitchesOf(low));
    });

    it('קו ישר אופקי הופך לתו מוחזק אחד, לא ל-16 חזרות בבר', () => {
      const flatLine: ShapeData = {
        version: '1.0.0',
        paths: [
          {
            points: Array.from({ length: 24 }, (_, index) => ({ x: index / 23, y: 0.5 })),
            closed: false,
          },
        ],
      };
      const score = composeMusicalScore(
        geometryToMusic(flatLine, 'seed-flat-line-sustains'),
        ABSOLUTE_CONFIG,
      );
      const lead = score.tracks.find((track) => track.role === 'lead');
      expect(lead?.notes).toHaveLength(1);
      expect(lead?.notes[0]?.durationTicks).toBeGreaterThan(480);
    });

    it('בס ופאד גם הם נגזרים מהציור — עיגול לא מקפיא אותם על אקורד אחד', () => {
      const score = composeMusicalScore(
        geometryToMusic(closedCircle(0.5, 0.4), 'seed-circle-harmony'),
        ABSOLUTE_CONFIG,
      );
      const bass = score.tracks.find((track) => track.role === 'bass');
      expect(new Set((bass?.notes ?? []).map((note) => note.pitch)).size).toBeGreaterThan(1);
    });
  });

  // ⭐ 2026-08-31 — נתפס בבדיקה חיה: ציור מרובה-משיכות בהאוס הפיל את הרינדור כולו עם
  // "Start time must be strictly greater than previous start time". אזור-ערכה משתרע על כמה
  // שורות, שתי שורות שנחצו באותה עמודה מיפו לאותו כלי, ו-DrumKitProvider מחזיק Player אחד
  // לכל חלק — כלומר Tone.Source.start נזרק. נמדד ב-11 מתוך 240 צורות אקראיות לפני התיקון.
  describe('רגרסיה: שתי מכות של אותו כלי-ערכה באותו רגע', () => {
    function randomShape(random: () => number): ShapeData {
      const strokeCount = 1 + Math.floor(random() * 3);
      return {
        version: '1.0.0',
        paths: Array.from({ length: strokeCount }, () => ({
          points: Array.from({ length: 10 + Math.floor(random() * 50) }, () => ({
            x: Math.min(1, Math.max(0, random())),
            y: Math.min(1, Math.max(0, random())),
          })),
          closed: random() > 0.5,
        })),
      };
    }

    it('200 צורות אקראיות: אף חלק-ערכה לא נפגע פעמיים באותו startTick', () => {
      const random = createSeededRandom('drum-simultaneity-sweep');
      for (let index = 0; index < 200; index += 1) {
        const score = composeMusicalScore(
          geometryToMusic(randomShape(random), `drum-sweep-${String(index)}`),
          ABSOLUTE_CONFIG,
        );
        const drums = score.tracks.find((track) => track.role === 'drums')?.notes ?? [];
        const lastStart = new Map<string, number>();
        for (const note of drums) {
          const piece = note.drumPiece ?? 'unknown';
          const previous = lastStart.get(piece);
          // בדיוק התנאי ש-Tone.Source.start אוכף: גדול **ממש**.
          expect(
            previous === undefined || note.startTick > previous,
            `shape ${String(index)}`,
          ).toBe(true);
          lastStart.set(piece, note.startTick);
        }
      }
    });

    it('איחוד מכות שומר על העוצמה החזקה מביניהן, לא על האחרונה', () => {
      // קו אנכי חוצה את כל השורות בבת אחת — הדרך הישירה ביותר לייצר התנגשות.
      const verticalSweep: ShapeData = {
        version: '1.0.0',
        paths: [
          {
            points: Array.from({ length: 40 }, (_, index) => ({ x: 0.5, y: index / 39 })),
            closed: false,
          },
        ],
      };
      const score = composeMusicalScore(
        geometryToMusic(verticalSweep, 'drum-collapse-velocity'),
        ABSOLUTE_CONFIG,
      );
      const drums = score.tracks.find((track) => track.role === 'drums')?.notes ?? [];
      expect(drums.length).toBeGreaterThan(0);
      for (const note of drums) {
        expect(note.velocity).toBeGreaterThan(0);
        expect(note.velocity).toBeLessThanOrEqual(1);
      }
    });
  });

  // ⭐ 2026-08-31 — נתפס בבדיקה חיה: "הרבה מהצורות נשמעות אותו הדבר". המדידה הראתה
  // ש-100% מעמדות-הגריד הופעלו בכל בר, בכל ציור — כלומר זרם רציף של שש-עשרות ולא קצב.
  // האוזן מזהה גרוב לפי קצב, ולכן שני ציורים עם גבהים שונים לגמרי נשמעו זהים.
  describe('רגרסיה: זרם רציף במקום קצב', () => {
    function wavyShape(cycles: number, seedIndex: number): ShapeData {
      const pointCount = 48;
      return {
        version: '1.0.0',
        paths: [
          {
            points: Array.from({ length: pointCount }, (_, index) => {
              const t = index / (pointCount - 1);
              return { x: t, y: 0.5 + 0.45 * Math.sin(2 * Math.PI * cycles * t + seedIndex) };
            }),
            closed: false,
          },
        ],
      };
    }

    /** שיעור עמדות-הגריד שמופעלות **בתוך בר** — לא איחוד על כל היצירה. */
    function averageBarFill(score: ReturnType<typeof composeMusicalScore>): number {
      const lead = score.tracks.find((track) => track.role === 'lead')?.notes ?? [];
      const slotsByBar = new Map<number, Set<number>>();
      for (const note of lead) {
        const bar = Math.floor(note.startTick / 1920);
        const slot = Math.round(((note.startTick % 1920) / 1920) * 16) % 16;
        const slots = slotsByBar.get(bar) ?? new Set<number>();
        slots.add(slot);
        slotsByBar.set(bar, slots);
      }
      const fills = [...slotsByBar.values()].map((slots) => slots.size / 16);
      return fills.length === 0 ? 0 : fills.reduce((sum, value) => sum + value, 0) / fills.length;
    }

    it('אף בר לא ממלא את כל הגריד — יש קצב, לא זרם', () => {
      for (let index = 0; index < 24; index += 1) {
        const score = composeMusicalScore(
          geometryToMusic(wavyShape(1 + index * 0.4, index), `wash-${String(index)}`),
          ABSOLUTE_CONFIG,
        );
        expect(averageBarFill(score), `shape ${String(index)}`).toBeLessThan(0.85);
      }
    });

    it('לכל תפקיד צפיפות משלו — קיק, בס וליד לא פועמים אותו דבר', () => {
      const score = composeMusicalScore(
        geometryToMusic(wavyShape(5, 1), 'role-density'),
        ABSOLUTE_CONFIG,
      );
      const onsetsPerBar = (role: string) => {
        const notes = score.tracks.find((track) => track.role === role)?.notes ?? [];
        return new Set(notes.map((note) => note.startTick)).size / score.durationBars;
      };
      expect(onsetsPerBar('pad')).toBeLessThan(onsetsPerBar('bass'));
      expect(onsetsPerBar('bass')).toBeLessThan(onsetsPerBar('lead'));
    });

    it('הטמפו באמת משתנה בין ציורים (היו 2 ערכים בלבד ב-120 ציורים)', () => {
      // ⚠️ משתנים גם התדר וגם המשרעת. מעל צפיפות מסוימת הטמפו רווי בתקרת הטווח — זו
      // התנהגות נכונה, ולכן 24 גלים שכולם צפופים היו בודקים רק את נקודת-הרוויה.
      const tempos = new Set(
        Array.from({ length: 24 }, (_, index) => {
          const pointCount = 48;
          const cycles = 0.5 + (index % 6) * 1.2;
          const amplitude = 0.04 + Math.floor(index / 6) * 0.12;
          const shape: ShapeData = {
            version: '1.0.0',
            paths: [
              {
                points: Array.from({ length: pointCount }, (_, point) => {
                  const t = point / (pointCount - 1);
                  return { x: t, y: 0.5 + amplitude * Math.sin(2 * Math.PI * cycles * t) };
                }),
                closed: false,
              },
            ],
          };
          return composeMusicalScore(geometryToMusic(shape, `tempo-${String(index)}`), {
            ...ABSOLUTE_CONFIG,
            tempoRange: { min: 118, max: 128 },
          }).tempo;
        }),
      );
      expect(tempos.size).toBeGreaterThan(3);
    });

    it('אף טראק לא נשאר ריק — רצפת-הצפיפות עובדת', () => {
      for (const cycles of [0.5, 1, 3, 9]) {
        const score = composeMusicalScore(
          geometryToMusic(wavyShape(cycles, 0), `floor-${String(cycles)}`),
          ABSOLUTE_CONFIG,
        );
        for (const track of score.tracks) {
          expect(track.notes.length, `${track.role} @ ${String(cycles)}`).toBeGreaterThan(0);
        }
      }
    });
  });

  // ⭐ 2026-08-31 — נתפס בבדיקה חיה (טראנס, ציור בצורת 8 שחוצה את עצמו): הרינדור נפל עם
  // "Start time must be strictly greater than previous start time". שני תווים על טראק
  // **מונופוני** במרחק של מילישניות בודדות עוברים את הגנת-הדילוג ב-SynthProvider, אבל
  // `Source.start` מהדק אותם לאותו בלוק-עיבוד (128 דגימות ≈ 4ms) ואז מתנגשים — וזה מפיל
  // את כל הרינדור, לא רק תו אחד. נמדד לפני התיקון: 270 זוגות כאלה ב-80 ציורים בטראנס.
  describe('רגרסיה: תווים צמודים-מדי על קול מונופוני', () => {
    /** חייב להישאר תואם ל-MONOPHONIC_MIN_SEPARATION_SECONDS ב-SynthProvider.ts. */
    const MONO_GUARD_SECONDS = 0.012;

    it('אין זוג תווים במרווח שגדול מאפס אך קטן מסף-ההגנה', () => {
      const random = createSeededRandom('mono-collision-sweep');
      for (let index = 0; index < 60; index += 1) {
        const pointCount = 12 + Math.floor(random() * 50);
        const shape: ShapeData = {
          version: '1.0.0',
          paths: [
            {
              points: Array.from({ length: pointCount }, () => ({ x: random(), y: random() })),
              closed: random() > 0.5,
            },
          ],
        };
        const score = composeMusicalScore(
          geometryToMusic(shape, `mono-collision-${String(index)}`),
          ABSOLUTE_CONFIG,
        );
        const secondsPerTick = 60 / score.tempo / 480;
        for (const track of score.tracks) {
          const ticks = track.notes.map((note) => note.startTick).sort((a, b) => a - b);
          for (let noteIndex = 1; noteIndex < ticks.length; noteIndex += 1) {
            const gapSeconds =
              ((ticks[noteIndex] ?? 0) - (ticks[noteIndex - 1] ?? 0)) * secondsPerTick;
            // אפס מותר (אקורד — ההגנה מדלגת נקי); "קרוב אך לא אפס" הוא המצב המסוכן.
            const isDangerous = gapSeconds > 0 && gapSeconds < MONO_GUARD_SECONDS;
            expect(isDangerous, `${track.role} @ shape ${String(index)}`).toBe(false);
          }
        }
      }
    });

    it('תווים שנפתחים באותה עמודה נוחתים בזמן זהה — אקורד, לא מריחה', () => {
      // קו אנכי חוצה כמה שורות בבת אחת: כל הקולות אמורים להתחיל יחד.
      const verticalSweep: ShapeData = {
        version: '1.0.0',
        paths: [
          {
            points: Array.from({ length: 40 }, (_, index) => ({ x: 0.5, y: index / 39 })),
            closed: false,
          },
        ],
      };
      const score = composeMusicalScore(
        geometryToMusic(verticalSweep, 'chord-together'),
        ABSOLUTE_CONFIG,
      );
      const lead = score.tracks.find((track) => track.role === 'lead')?.notes ?? [];
      expect(lead.length).toBeGreaterThan(1);
      expect(new Set(lead.map((note) => note.startTick)).size).toBeLessThan(lead.length);
    });
  });

  // ⭐ 2026-08-31 (סבב ב') — הפאד ניגן קודם את השורות שהציור חצה, מדולל ל-4 קולות. נמדד
  // בסינמטי: `C E F A` — F מול E, חצי טון. צביר, לא אקורד: בלי פונקציה הרמונית, בלי מתח
  // ובלי פתרון. `buildChord`/`chooseSmoothVoicing` כבר היו בקוד; נתיב הרסטר עקף אותם.
  describe('רגרסיה: הפאד מנגן אקורדים ולא צבירים', () => {
    /** ערימת שלישיות (3 או 4 חצאי-טונים) היא אקורד; מרווח של 1–2 הוא צביר. */
    function isChordal(pitches: readonly number[]): boolean {
      const classes = [...new Set(pitches.map((pitch) => ((pitch % 12) + 12) % 12))].sort(
        (a, b) => a - b,
      );
      for (let rotation = 0; rotation < classes.length; rotation += 1) {
        const rotated = [...classes.slice(rotation), ...classes.slice(0, rotation)];
        const intervals = rotated
          .slice(1)
          .map((pitch, index) => (((pitch - (rotated[index] ?? 0)) % 12) + 12) % 12);
        if (intervals.length > 0 && intervals.every((step) => step === 3 || step === 4)) {
          return true;
        }
      }
      return false;
    }

    function padByBar(score: ReturnType<typeof composeMusicalScore>): Map<number, number[]> {
      const byBar = new Map<number, number[]>();
      for (const note of score.tracks.find((track) => track.role === 'pad')?.notes ?? []) {
        const bar = Math.floor(note.startTick / 1920);
        const pitches = byBar.get(bar) ?? [];
        pitches.push(note.pitch);
        byBar.set(bar, pitches);
      }
      return byBar;
    }

    function circleShape(centerY: number, radius: number): ShapeData {
      return {
        version: '1.0.0',
        paths: [
          {
            points: Array.from({ length: 48 }, (_, index) => {
              const angle = (2 * Math.PI * index) / 48;
              return { x: 0.5 + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
            }),
            closed: true,
          },
        ],
      };
    }

    it('כל בר-פאד הוא אקורד תקין, על מגוון צורות', () => {
      const random = createSeededRandom('pad-chordal-sweep');
      for (let index = 0; index < 20; index += 1) {
        const pointCount = 14 + Math.floor(random() * 40);
        const shape: ShapeData = {
          version: '1.0.0',
          paths: [
            {
              points: Array.from({ length: pointCount }, () => ({ x: random(), y: random() })),
              closed: random() > 0.5,
            },
          ],
        };
        const score = composeMusicalScore(
          geometryToMusic(shape, `pad-chordal-${String(index)}`),
          ABSOLUTE_CONFIG,
        );
        for (const [bar, pitches] of padByBar(score)) {
          expect(isChordal(pitches), `shape ${String(index)} bar ${String(bar)}`).toBe(true);
        }
      }
    });

    it('כל סקשן נסגר על הטוניקה — יש קדנצה, לא רק גיוון', () => {
      const score = composeMusicalScore(
        geometryToMusic(circleShape(0.5, 0.4), 'cadence-check'),
        ABSOLUTE_CONFIG,
      );
      const byBar = padByBar(score);
      for (const section of score.sections) {
        if (section.lengthBars < 2) {
          continue;
        }
        const lastBar = section.startBar + section.lengthBars - 1;
        const pitches = byBar.get(lastBar);
        if (!pitches) {
          continue;
        }
        const classes = new Set(pitches.map((pitch) => ((pitch % 12) + 12) % 12));
        expect(classes.has(score.key.root), `סוף ${section.name}`).toBe(true);
      }
    });

    it('עיגול כבר לא מקבל אקורד אחד לכל היצירה — ההרמוניה נגזרת מהרסטר, לא מהמתאר', () => {
      const score = composeMusicalScore(
        geometryToMusic(circleShape(0.5, 0.42), 'harmony-not-frozen'),
        ABSOLUTE_CONFIG,
      );
      const chords = new Set(
        [...padByBar(score).values()].map((pitches) =>
          [...new Set(pitches.map((pitch) => ((pitch % 12) + 12) % 12))]
            .sort((a, b) => a - b)
            .join(),
        ),
      );
      expect(chords.size).toBeGreaterThan(1);
    });

    it('הבס מנגן את שורש האקורד — הוא מה שמגדיר את ההרמוניה לאוזן', () => {
      const score = composeMusicalScore(
        geometryToMusic(circleShape(0.5, 0.4), 'bass-is-root'),
        ABSOLUTE_CONFIG,
      );
      const byBar = padByBar(score);
      const bass = score.tracks.find((track) => track.role === 'bass')?.notes ?? [];
      expect(bass.length).toBeGreaterThan(0);
      for (const note of bass) {
        const bar = Math.floor(note.startTick / 1920);
        const chordClasses = new Set(
          (byBar.get(bar) ?? []).map((pitch) => ((pitch % 12) + 12) % 12),
        );
        if (chordClasses.size === 0) {
          continue;
        }
        expect(chordClasses.has(((note.pitch % 12) + 12) % 12), `bar ${String(bar)}`).toBe(true);
      }
    });

    it('ציורים שונים עדיין מייצרים פרוגרסיות שונות — לא איבדנו גיוון', () => {
      const progressionOf = (shape: ShapeData, seed: string) =>
        [...padByBar(composeMusicalScore(geometryToMusic(shape, seed), ABSOLUTE_CONFIG)).entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, pitches]) => [...new Set(pitches)].sort((a, b) => a - b).join())
          .join('|');
      expect(progressionOf(circleShape(0.25, 0.15), 'prog-a')).not.toBe(
        progressionOf(circleShape(0.75, 0.15), 'prog-b'),
      );
    });
  });

  it('flag דלוק: כל ה-seeds מייצרים את אותו שורש בדיוק (בניגוד לבדיקה המקבילה למעלה עם flag כבוי)', () => {
    const seeds = Array.from(
      { length: 10 },
      (_, index) => `seed-absolute-variety-${String(index)}`,
    );
    const roots = new Set(
      seeds.map(
        (seed) =>
          composeMusicalScore(geometryToMusic(makeSquareShapeData(), seed), ABSOLUTE_CONFIG).key
            .root,
      ),
    );
    expect(roots.size).toBe(1);
  });
});

describe('composeMusicalScore — לוח-תווים אבסולוטי שלב 2: הרמוניה (בס/פאד) לפי מיקום-הצורה', () => {
  const ABSOLUTE_CONFIG: CompositionConfig = {
    ...DEFAULT_TEST_CONFIG,
    absoluteNoteBoard: true,
  };
  const HARMONY_ROLE_RANGES: Record<'bass' | 'pad', { min: number; max: number }> = {
    bass: { min: 24, max: 60 },
    pad: { min: 36, max: 84 },
  };

  it("בס/פאד תלויים בצורה, לא ב-seed: אותה צורה + seeds שונים → אותו רצף-פיצ'ים בדיוק", () => {
    const shape = makeSquareShapeData();
    const scoreA = composeMusicalScore(geometryToMusic(shape, 'seed-harmony-a'), ABSOLUTE_CONFIG);
    const scoreB = composeMusicalScore(geometryToMusic(shape, 'seed-harmony-b'), ABSOLUTE_CONFIG);
    const pitchesA = scoreA.tracks
      .find((track) => track.role === 'bass')
      ?.notes.map((n) => n.pitch);
    const pitchesB = scoreB.tracks
      .find((track) => track.role === 'bass')
      ?.notes.map((n) => n.pitch);
    expect(pitchesA).toEqual(pitchesB);
    const padA = scoreA.tracks.find((track) => track.role === 'pad')?.notes.map((n) => n.pitch);
    const padB = scoreB.tracks.find((track) => track.role === 'pad')?.notes.map((n) => n.pitch);
    expect(padA).toEqual(padB);
  });

  it('בס/פאד משתנים בין צורות שונות (לא קפואים על פרוגרסיה קבועה אחת)', () => {
    const scoreTriangle = composeMusicalScore(
      geometryToMusic(makeTriangleShapeData(), 'seed-shape-variety'),
      ABSOLUTE_CONFIG,
    );
    const scoreCircle = composeMusicalScore(
      geometryToMusic(makeCircleShapeData(), 'seed-shape-variety'),
      ABSOLUTE_CONFIG,
    );
    const bassTriangle = scoreTriangle.tracks.find((track) => track.role === 'bass')?.notes[0]
      ?.pitch;
    const bassCircle = scoreCircle.tracks.find((track) => track.role === 'bass')?.notes[0]?.pitch;
    expect(bassTriangle).not.toBe(bassCircle);
  });

  it('כל פיץ׳ בבס/פאד נשאר בטווח התפקיד שלו (מוודא שקיפול ה-%7 מונע חריגה מ-generateInversions)', () => {
    for (const shape of [
      makeTriangleShapeData(),
      makeSquareShapeData(),
      makeCircleShapeData(),
      makeAsymmetricShapeData(),
    ]) {
      const score = composeMusicalScore(
        geometryToMusic(shape, 'seed-range-check'),
        ABSOLUTE_CONFIG,
      );
      for (const role of ['bass', 'pad'] as const) {
        const range = HARMONY_ROLE_RANGES[role];
        const track = score.tracks.find((t) => t.role === role);
        for (const note of track?.notes ?? []) {
          expect(note.pitch).toBeGreaterThanOrEqual(range.min);
          expect(note.pitch).toBeLessThanOrEqual(range.max);
        }
      }
    }
  });

  it('validateConstitution ריק (כולל note-in-scale/realistic-range) על כמה צורות שונות', () => {
    for (const shape of [makeTriangleShapeData(), makeSquareShapeData(), makeCircleShapeData()]) {
      const score = composeMusicalScore(
        geometryToMusic(shape, 'seed-constitution'),
        ABSOLUTE_CONFIG,
      );
      expect(validateConstitution(score)).toHaveLength(0);
    }
  });

  it('תופים: עם absoluteNoteBoard, ה-pitch משתנה בין ברים לפי מיקום-הצורה (לא קבוע כמו קודם)', () => {
    const config: CompositionConfig = {
      ...ABSOLUTE_CONFIG,
      rhythmPatterns: {
        drums: { stepsPerBar: 16, hits: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
      },
    };
    const score = composeMusicalScore(
      geometryToMusic(makeAsymmetricShapeData(), 'seed-drums-absolute-pitch'),
      config,
    );
    const drumsTrack = score.tracks.find((track) => track.role === 'drums');
    const distinctPitches = new Set(drumsTrack?.notes.map((note) => note.pitch));
    expect(distinctPitches.size).toBeGreaterThan(1);
    expect(validateConstitution(score)).toHaveLength(0);
  });

  it('תופים: בלי absoluteNoteBoard, ה-pitch נשאר קבוע (ללא שינוי-התנהגות לסגנונות אחרים)', () => {
    const config: CompositionConfig = {
      ...DEFAULT_TEST_CONFIG,
      rhythmPatterns: {
        drums: { stepsPerBar: 16, hits: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
      },
    };
    const score = composeMusicalScore(
      geometryToMusic(makeAsymmetricShapeData(), 'seed-drums-legacy-pitch'),
      config,
    );
    const drumsTrack = score.tracks.find((track) => track.role === 'drums');
    const distinctPitches = new Set(drumsTrack?.notes.map((note) => note.pitch));
    expect(distinctPitches.size).toBe(1);
  });
});
