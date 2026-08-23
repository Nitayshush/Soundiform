/**
 * @file        shapeReveal.test.ts
 * @description בדיקות ל"שרטוט מסונכרן" — ראה shapeReveal.ts.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { ShapeData } from './ShapeData';
import { computeShapeLayout, revealedSegments } from './shapeReveal';

const DIMENSIONS = { width: 200, height: 100 };

function openLine(): ShapeData {
  return {
    version: '1.0.0',
    paths: [
      {
        closed: false,
        points: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
        ],
      },
    ],
  };
}

function twoDisjointLines(): ShapeData {
  return {
    version: '1.0.0',
    paths: [
      {
        closed: false,
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
        ],
      },
      {
        closed: false,
        points: [
          { x: 0, y: 1 },
          { x: 0.5, y: 1 },
        ],
      },
    ],
  };
}

describe('computeShapeLayout', () => {
  it('מקרין נקודות מנורמלות לריבוע ממורכז בתוך הפריים', () => {
    const layout = computeShapeLayout(openLine(), DIMENSIONS);
    const squareSize = Math.min(DIMENSIONS.width, DIMENSIONS.height);
    const offsetX = (DIMENSIONS.width - squareSize) / 2;
    expect(layout.segments[0]?.start.x).toBeCloseTo(offsetX);
    expect(layout.segments[0]?.end.x).toBeCloseTo(offsetX + squareSize);
  });

  it('מוסיף קטע סגירה למסלול closed', () => {
    const closedTriangle: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: true,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0.5, y: 1 },
          ],
        },
      ],
    };
    const layout = computeShapeLayout(closedTriangle, DIMENSIONS);
    expect(layout.segments).toHaveLength(3);
  });
});

describe('revealedSegments', () => {
  it('לא מחזיר כלום ב-progress 0', () => {
    const layout = computeShapeLayout(openLine(), DIMENSIONS);
    expect(revealedSegments(layout, 0)).toEqual([]);
  });

  it('מחזיר את כל הצורה ב-progress 1', () => {
    const layout = computeShapeLayout(openLine(), DIMENSIONS);
    const revealed = revealedSegments(layout, 1);
    expect(revealed).toHaveLength(1);
    expect(revealed[0]?.at(-1)?.x).toBeCloseTo(layout.segments[0]?.end.x ?? NaN);
  });

  it('חושף חלק פרופורציונלי ב-progress חלקי', () => {
    const layout = computeShapeLayout(openLine(), DIMENSIONS);
    const revealed = revealedSegments(layout, 0.5);
    expect(revealed).toHaveLength(1);
    const points = revealed[0];
    expect(points).toBeDefined();
    const lastPoint = points?.at(-1);
    expect(lastPoint?.x).toBeCloseTo((layout.segments[0]?.start.x ?? 0) + layout.totalLength / 2);
  });

  it('חושף מסלולים נפרדים ברצף (השני לא מתחיל לפני שהראשון הושלם)', () => {
    const layout = computeShapeLayout(twoDisjointLines(), DIMENSIONS);
    // שני המסלולים באורך שווה — ב-25% מהאורך הכולל רק המסלול הראשון אמור להופיע, חלקית.
    const revealedQuarter = revealedSegments(layout, 0.25);
    expect(revealedQuarter).toHaveLength(1);

    // ב-100% שני המסלולים אמורים להופיע.
    const revealedAll = revealedSegments(layout, 1);
    expect(revealedAll).toHaveLength(2);
  });

  it('דטרמיניסטי: אותו קלט מייצר תמיד את אותה תוצאה', () => {
    const layout = computeShapeLayout(twoDisjointLines(), DIMENSIONS);
    expect(revealedSegments(layout, 0.6)).toEqual(revealedSegments(layout, 0.6));
  });
});
