/**
 * @file        shapeAnalyzer.test.ts
 * @description בדיקות יחידה על צורות ידועות (עיגול, משולש, ריבוע) — §11 Sprint 2.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { extractContour } from './contourExtractor';
import { analyzeShape } from './shapeAnalyzer';
import { makeCircleShapeData, makeSquareShapeData, makeTriangleShapeData } from './testShapes';

describe('analyzeShape', () => {
  it('מזהה ריבוע: 4 קודקודים, מרכז מסה נכון, שטח קרוב לתיאורטי', () => {
    const contour = extractContour(makeSquareShapeData({ x: 0.5, y: 0.5 }, 0.3));
    const features = analyzeShape(contour);

    expect(features.closed).toBe(true);
    expect(features.vertexCount).toBe(4);
    expect(features.centerOfMass.x).toBeCloseTo(0.5, 1);
    expect(features.centerOfMass.y).toBeCloseTo(0.5, 1);
    // ריבוע בצלע 0.6 (חצי-צלע 0.3) → שטח תיאורטי 0.36
    expect(features.area).toBeCloseTo(0.36, 1);
  });

  it('מזהה משולש: 3 קודקודים, גודל מוטיב תואם (§4.2: משולש→3 תווים)', () => {
    const contour = extractContour(makeTriangleShapeData({ x: 0.5, y: 0.5 }, 0.3));
    const features = analyzeShape(contour);

    expect(features.closed).toBe(true);
    expect(features.vertexCount).toBe(3);
  });

  it('מזהה עיגול: כמעט אין קודקודים חדים (עקומה חלקה)', () => {
    const contour = extractContour(makeCircleShapeData({ x: 0.5, y: 0.5 }, 0.3));
    const features = analyzeShape(contour);

    expect(features.closed).toBe(true);
    expect(features.vertexCount).toBeLessThanOrEqual(1);
    // שטח עיגול תיאורטי: π*r² ≈ 0.283
    expect(features.area).toBeCloseTo(Math.PI * 0.3 * 0.3, 1);
  });

  it('bounding box תואם לגבולות הצורה', () => {
    const contour = extractContour(makeSquareShapeData({ x: 0.5, y: 0.5 }, 0.3));
    const features = analyzeShape(contour);

    expect(features.boundingBox.minX).toBeCloseTo(0.2, 1);
    expect(features.boundingBox.maxX).toBeCloseTo(0.8, 1);
    expect(features.boundingBox.minY).toBeCloseTo(0.2, 1);
    expect(features.boundingBox.maxY).toBeCloseTo(0.8, 1);
  });
});
