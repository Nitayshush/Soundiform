/**
 * @file        symmetryDetector.test.ts
 * @description בדיקות יחידה על צורות ידועות — מוודא שהאיזומורפיזם הגאומטרי-מוזיקלי (§4.4) מבוסס נכון.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { extractContour } from './contourExtractor';
import { detectSymmetry } from './symmetryDetector';
import {
  makeAsymmetricShapeData,
  makeCircleShapeData,
  makeHandDrawnCircleShapeData,
  makeSquareShapeData,
  makeTriangleShapeData,
} from './testShapes';

describe('detectSymmetry', () => {
  it('ריבוע: שיקוף בשני הצירים + סימטריה סיבובית מסדר 4', () => {
    const symmetry = detectSymmetry(extractContour(makeSquareShapeData()));
    expect(symmetry.horizontalMirror).toBe(true);
    expect(symmetry.verticalMirror).toBe(true);
    expect(symmetry.rotationalOrder).toBe(4);
  });

  it('משולש שווה-צלעות (apex למעלה): שיקוף שמאל-ימין בלבד + סימטריה מסדר 3', () => {
    const symmetry = detectSymmetry(extractContour(makeTriangleShapeData()));
    expect(symmetry.horizontalMirror).toBe(true);
    expect(symmetry.verticalMirror).toBe(false);
    expect(symmetry.rotationalOrder).toBe(3);
  });

  it('עיגול: שיקוף בשני הצירים + סימטריה סיבובית בסדר המקסימלי הנבדק', () => {
    const symmetry = detectSymmetry(extractContour(makeCircleShapeData()));
    expect(symmetry.horizontalMirror).toBe(true);
    expect(symmetry.verticalMirror).toBe(true);
    expect(symmetry.rotationalOrder).toBe(8);
  });

  it('עיגול עם רעש-יד קל: הזיהוי עדיין סובלני (לא רק לגאומטריה מושלמת)', () => {
    const symmetry = detectSymmetry(extractContour(makeHandDrawnCircleShapeData()));
    expect(symmetry.horizontalMirror).toBe(true);
    expect(symmetry.verticalMirror).toBe(true);
    expect(symmetry.rotationalOrder).toBeGreaterThanOrEqual(4);
  });

  it('צורה אסימטרית: אין שיקוף ואין סימטריה סיבובית', () => {
    const symmetry = detectSymmetry(extractContour(makeAsymmetricShapeData()));
    expect(symmetry.horizontalMirror).toBe(false);
    expect(symmetry.verticalMirror).toBe(false);
    expect(symmetry.rotationalOrder).toBe(1);
  });
});
