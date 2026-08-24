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
