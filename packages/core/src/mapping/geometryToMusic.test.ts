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
});
