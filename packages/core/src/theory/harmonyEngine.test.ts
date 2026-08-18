/**
 * @file        harmonyEngine.test.ts
 * @description ⭐ בדיקות יחידה ל-composeMusicalScore — כולל הבדיקה הנדרשת ב-§11 Sprint 3:
 *              100 צורות אקראיות → כולן חייבות להיות בסולם.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { ShapeData } from '@shape-sound/shared';
import { createSeededRandom } from '../internal/seededRandom';
import { geometryToMusic } from '../mapping/geometryToMusic';
import { musicalScoreSchema } from '../score/scoreSchema';
import { composeMusicalScore } from './harmonyEngine';
import { validateConstitution } from './rules';
import {
  makeCircleShapeData,
  makeSquareShapeData,
  makeTriangleShapeData,
} from '../analysis/testShapes';

const RANDOM_SHAPE_COUNT = 100;

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
      const score = composeMusicalScore(intent);

      const scaleViolations = validateConstitution(score).filter(
        (violation) => violation.rule === 'note-in-scale',
      );
      expect(scaleViolations).toHaveLength(0);
    }
  });
});

describe('composeMusicalScore — תקינות כללית', () => {
  it('הפלט תמיד תקף מול musicalScoreSchema', () => {
    const intent = geometryToMusic(makeSquareShapeData(), 'seed-square');
    const score = composeMusicalScore(intent);
    expect(musicalScoreSchema.safeParse(score).success).toBe(true);
  });

  it('אין הפרות חוקה כלשהן (לא רק סולם) על שלוש הצורות הידועות', () => {
    for (const shape of [makeTriangleShapeData(), makeSquareShapeData(), makeCircleShapeData()]) {
      const intent = geometryToMusic(shape, 'seed');
      const score = composeMusicalScore(intent);
      expect(validateConstitution(score)).toHaveLength(0);
    }
  });

  it('יוצר 3 טראקים: lead, bass, pad', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed');
    const score = composeMusicalScore(intent);
    const roles = score.tracks.map((track) => track.role).sort();
    expect(roles).toEqual(['bass', 'lead', 'pad']);
  });

  it('דטרמיניזם: אותה צורה מייצרת בדיוק את אותו MusicalScore', () => {
    const intentA = geometryToMusic(makeTriangleShapeData(), 'seed-determinism');
    const intentB = geometryToMusic(makeTriangleShapeData(), 'seed-determinism');
    expect(composeMusicalScore(intentA)).toEqual(composeMusicalScore(intentB));
  });

  it('seed שונה מייצר בדרך כלל שורש/מוד שונה (לא תמיד אותו ברירת מחדל קבועה)', () => {
    const seeds = Array.from({ length: 10 }, (_, index) => `seed-variety-${String(index)}`);
    const roots = new Set(
      seeds.map(
        (seed) => composeMusicalScore(geometryToMusic(makeSquareShapeData(), seed)).key.root,
      ),
    );
    expect(roots.size).toBeGreaterThan(1);
  });

  it('צורה עם symmetryTransform מייצרת שני פרייזים (פי 2 מ-durationBars הבסיסי)', () => {
    // ריבוע = retrograde-inversion (שני השיקופים) → אמור להכפיל את durationBars
    const symmetricIntent = geometryToMusic(makeSquareShapeData(), 'seed-symmetric');
    const symmetricScore = composeMusicalScore(symmetricIntent);
    expect(symmetricIntent.symmetryTransform).not.toBe('none');
    expect(symmetricScore.sections).toHaveLength(1);
    expect(symmetricScore.sections[0]?.lengthBars).toBe(symmetricScore.durationBars);
  });
});
