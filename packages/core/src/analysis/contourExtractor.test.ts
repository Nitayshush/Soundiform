/**
 * @file        contourExtractor.test.ts
 * @description בדיקות יחידה + מקרי קצה (§0.4: קלט ריק/מנוון) לחילוץ קונטור.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { ShapeData } from '@soundiform/shared';
import { extractContour } from './contourExtractor';
import { makeSquareShapeData } from './testShapes';

describe('extractContour', () => {
  it('מדגם מחדש למספר הנקודות המבוקש', () => {
    const contour = extractContour(makeSquareShapeData(), 32);
    expect(contour.points).toHaveLength(32);
  });

  it('מזהה נכון צורה סגורה (paths[].closed) גם בלי בדיקה גאומטרית', () => {
    const contour = extractContour(makeSquareShapeData());
    expect(contour.closed).toBe(true);
  });

  it('מזהה קונטור סגור גאומטרית גם כש-closed=false אך תחילת/סוף המסלול חופפים', () => {
    const shape: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: false,
          points: [
            { x: 0.5, y: 0.2 },
            { x: 0.8, y: 0.5 },
            { x: 0.5, y: 0.8 },
            { x: 0.2, y: 0.5 },
            { x: 0.51, y: 0.21 }, // כמעט חוזר לנקודת ההתחלה
          ],
        },
      ],
    };
    expect(extractContour(shape).closed).toBe(true);
  });

  it('לא מזהה קונטור סגור כשהמסלול פתוח בבירור', () => {
    const shape: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: false,
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.9 },
          ],
        },
      ],
    };
    expect(extractContour(shape).closed).toBe(false);
  });

  it('בוחר את המסלול עם הכי הרבה נקודות כמסלול ראשי (ציור רב-משיכות)', () => {
    const [squarePath] = makeSquareShapeData().paths;
    if (!squarePath) {
      throw new Error('unreachable: makeSquareShapeData() always has one path');
    }
    const shape: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: false,
          points: [
            { x: 0, y: 0 },
            { x: 0.01, y: 0.01 },
          ],
        },
        squarePath,
      ],
    };
    const contour = extractContour(shape);
    // אם נבחר הריבוע (המסלול הארוך), הוא סגור.
    expect(contour.closed).toBe(true);
  });

  it('לא קורס על צורה מנוונת (כל הנקודות זהות) — לא מייצר NaN', () => {
    const shape: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: true,
          points: [
            { x: 0.5, y: 0.5 },
            { x: 0.5, y: 0.5 },
            { x: 0.5, y: 0.5 },
          ],
        },
      ],
    };
    const contour = extractContour(shape, 16);
    expect(contour.points).toHaveLength(16);
    for (const point of contour.points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it('זורק שגיאה מפורשת על צורה בלי אף מסלול', () => {
    const shape: ShapeData = { version: '1.0.0', paths: [] };
    expect(() => extractContour(shape)).toThrow();
  });
});
