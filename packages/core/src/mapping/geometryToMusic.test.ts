/**
 * @file        geometryToMusic.test.ts
 * @description בדיקות אינטגרציה על צורות ידועות + דטרמיניזם (§1) של שכבת ה-Mapping.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { ShapeData } from '@soundiform/shared';
import { geometryToMusic, rawMusicalIntentSchema } from './geometryToMusic';
import {
  makeAsymmetricShapeData,
  makeCircleShapeData,
  makeSquareShapeData,
  makeTriangleShapeData,
} from '../analysis/testShapes';

describe('geometryToMusic', () => {
  it('משולש: לופ (קונטור סגור), גודל מוטיב 3, טרנספורמציית סימטריה = retrograde', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed-triangle');
    expect(intent.loop).toBe(true);
    expect(intent.motifSize).toBe(3);
    expect(intent.symmetryTransform).toBe('retrograde');
    expect(intent.rotationalOrder).toBe(3);
  });

  it('ריבוע: גודל מוטיב 4, טרנספורמציית סימטריה = retrograde-inversion (שני השיקופים)', () => {
    const intent = geometryToMusic(makeSquareShapeData(), 'seed-square');
    expect(intent.motifSize).toBe(4);
    expect(intent.symmetryTransform).toBe('retrograde-inversion');
    expect(intent.rotationalOrder).toBe(4);
  });

  it('עיגול: articulation=legato (עקומה חלקה, לא סטקטו)', () => {
    const intent = geometryToMusic(makeCircleShapeData(), 'seed-circle');
    expect(intent.articulation).toBe('legato');
    expect(intent.loop).toBe(true);
  });

  it('צורה אסימטרית: אין טרנספורמציית סימטריה', () => {
    const intent = geometryToMusic(makeAsymmetricShapeData(), 'seed-asymmetric');
    expect(intent.symmetryTransform).toBe('none');
    expect(intent.rotationalOrder).toBe(1);
  });

  it('הפלט תמיד תקף מול rawMusicalIntentSchema', () => {
    const intent = geometryToMusic(makeSquareShapeData(), 'seed');
    expect(rawMusicalIntentSchema.safeParse(intent).success).toBe(true);
  });

  it('דטרמיניזם: אותה צורה מייצרת בדיוק את אותה RawMusicalIntent', () => {
    const intentA = geometryToMusic(makeTriangleShapeData(), 'seed-x');
    const intentB = geometryToMusic(makeTriangleShapeData(), 'seed-x');
    expect(intentA).toEqual(intentB);
  });

  it('לא קורס על צורה מנוונת מינימלית (מסלול פתוח בן 2 נקודות) — אין NaN בפלט', () => {
    const minimalOpenShape: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: false,
          points: [
            { x: 0.2, y: 0.3 },
            { x: 0.7, y: 0.6 },
          ],
        },
      ],
    };
    const intent = geometryToMusic(minimalOpenShape, 'seed-minimal');
    expect(rawMusicalIntentSchema.safeParse(intent).success).toBe(true);
    expect(Number.isFinite(intent.velocityHint)).toBe(true);
    expect(Number.isFinite(intent.durationHint)).toBe(true);
    expect(intent.pitchContour.every((y) => Number.isFinite(y))).toBe(true);
  });

  it('ה-seed שמור כפי שהתקבל (§1: hash הצורה)', () => {
    const intent = geometryToMusic(makeSquareShapeData(), 'abc123');
    expect(intent.seed).toBe('abc123');
  });

  it('§11 מגוון מוזיקלי לפי-צורה: durationHint כבר לא כפילות מילולית של velocityHint', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed-duration-independent');
    expect(intent.durationHint).not.toBe(intent.velocityHint);
  });

  it('§11 תיקון ממוקד: cornerHint מאוכלס, כל ערך בטווח [0,1] (מזין תזמון-תופים תלוי-צורה)', () => {
    const intent = geometryToMusic(makeTriangleShapeData(), 'seed-corner-hint');
    expect(intent.cornerHint.length).toBeGreaterThan(0);
    for (const value of intent.cornerHint) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  describe('§11 שיפור-סאונד Area 3: sizeHint (גודל bounding-box) נפרד מ-motifSize (קודקודים)', () => {
    it('משולש גדול וקטן: אותו motifSize (3 קודקודים), אך sizeHint שונה משמעותית', () => {
      const small = geometryToMusic(makeTriangleShapeData({ x: 0.5, y: 0.5 }, 0.02), 'seed-size-a');
      const large = geometryToMusic(makeTriangleShapeData({ x: 0.5, y: 0.5 }, 0.45), 'seed-size-b');
      expect(small.motifSize).toBe(large.motifSize);
      expect(large.sizeHint).toBeGreaterThan(small.sizeHint);
    });

    it('צורה פתוחה (קו בודד, area=0) עדיין מקבלת sizeHint משמעותי — לא רק צורות סגורות', () => {
      const longOpenLine: ShapeData = {
        version: '1.0.0',
        paths: [
          {
            closed: false,
            points: [
              { x: 0.05, y: 0.05 },
              { x: 0.95, y: 0.95 },
            ],
          },
        ],
      };
      const intent = geometryToMusic(longOpenLine, 'seed-open-line-size');
      expect(intent.sizeHint).toBeGreaterThan(0.5);
    });

    it('sizeHint תמיד בטווח [0,1] גם על נקודה בודדת מנוונת', () => {
      const degeneratePoint: ShapeData = {
        version: '1.0.0',
        paths: [{ closed: false, points: [{ x: 0.5, y: 0.5 }] }],
      };
      const intent = geometryToMusic(degeneratePoint, 'seed-degenerate-size');
      expect(intent.sizeHint).toBeGreaterThanOrEqual(0);
      expect(intent.sizeHint).toBeLessThanOrEqual(1);
    });
  });

  describe('כמה משיכות-עט (§11 2026-08-23: כל משיכה תורמת ליצירה)', () => {
    it('משיכה שנייה מגדילה את motifSize מעבר למה שהמשיכה הדומיננטית לבדה הייתה נותנת', () => {
      const triangleOnly = geometryToMusic(makeTriangleShapeData(), 'seed-multi');
      expect(triangleOnly.motifSize).toBe(3); // בסיס — כמו הבדיקה הראשונה בקובץ הזה.

      const triangleWithSecondStroke: ShapeData = {
        ...makeTriangleShapeData(),
        paths: [
          ...makeTriangleShapeData().paths,
          {
            closed: false,
            points: [
              { x: 0, y: 0.1 },
              { x: 0.1, y: 0.9 },
              { x: 0.2, y: 0.1 },
              { x: 0.3, y: 0.9 },
            ],
          },
        ],
      };
      const withSecondStroke = geometryToMusic(triangleWithSecondStroke, 'seed-multi');
      expect(withSecondStroke.motifSize).toBeGreaterThan(triangleOnly.motifSize);
    });

    it('pitchContour משקף את שתי המשיכות (לפי מיקום-X של כל אחת), לא רק את הדומיננטית', () => {
      // משיכה ראשונה (הדומיננטית — יותר נקודות): x ∈ [0, 0.4], y=0.1 קבוע.
      // משיכה שנייה: x ∈ [0.6, 1], y=0.9 קבוע.
      const twoStrokes: ShapeData = {
        version: '1.0.0',
        paths: [
          {
            closed: false,
            points: [
              { x: 0, y: 0.1 },
              { x: 0.1, y: 0.1 },
              { x: 0.2, y: 0.1 },
              { x: 0.4, y: 0.1 },
            ],
          },
          {
            closed: false,
            points: [
              { x: 0.6, y: 0.9 },
              { x: 1, y: 0.9 },
            ],
          },
        ],
      };
      const intent = geometryToMusic(twoStrokes, 'seed-two-strokes');
      const [first] = intent.pitchContour;
      const last = intent.pitchContour.at(-1);
      // התחלת ה-contour (X נמוך) שייכת למשיכה הראשונה (y≈0.1); הסוף (X גבוה) למשיכה השנייה (y≈0.9).
      expect(first).toBeCloseTo(0.1, 1);
      expect(last).toBeCloseTo(0.9, 1);
    });
  });
});
