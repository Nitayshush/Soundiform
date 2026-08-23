/**
 * @file        xAxisResample.test.ts
 * @description בדיקות ל-resampleByX — ראה xAxisResample.ts.
 * @author      Soundiform
 * @created     2026-08-23
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { ShapePoint } from '@soundiform/shared';
import { resampleByX } from './xAxisResample';

describe('resampleByX', () => {
  it('צורה אלכסונית מונוטונית: ערך ה-Y בכל bucket תואם את המיקום היחסי על ה-X', () => {
    const diagonal: ShapePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const result = resampleByX(diagonal, false, 5);
    expect(result).toHaveLength(5);
    expect(result[0]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0.5);
    expect(result.at(-1)).toBeCloseTo(1);
  });

  it('צורה סגורה עם שני ענפים על אותו X — ממוצע בין שני חיתוכים (לא הענף שצויר ראשון)', () => {
    // עיגול-מקורב: הענף העליון (y=0) והתחתון (y=1) על x=0.5, הצורה סגורה.
    const diamond: ShapePoint[] = [
      { x: 0, y: 0.5 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0.5 },
      { x: 0.5, y: 1 },
    ];
    const result = resampleByX(diamond, true, 5);
    // ה-bucket האמצעי (x=0.5) חייב לחתוך גם את הענף העליון (y≈0) וגם את התחתון (y≈1) — ממוצע ≈0.5.
    expect(result[2]).toBeCloseTo(0.5, 1);
  });

  it('ריצה כמעט-אנכית (טווח X מדולל) מקבלת אינטרפולציה מהעוגנים השכנים, לא null/NaN', () => {
    const shape: ShapePoint[] = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0.5 },
      { x: 0.1, y: 0.9 }, // ריצה אנכית טהורה — אף target-X לא יחתוך אותה בדיוק
      { x: 1, y: 1 },
    ];
    const result = resampleByX(shape, false, 10);
    expect(result.every((value) => Number.isFinite(value))).toBe(true);
    // מונוטוני עולה בגדול (אין "חורים" שקופצים לערך שרירותי)
    let previous = result[0] ?? 0;
    for (const value of result.slice(1)) {
      expect(value).toBeGreaterThanOrEqual(previous - 0.05);
      previous = value;
    }
  });

  it('צורה עם טווח X אפסי (קו אנכי טהור) מחזירה את ה-Y הממוצע לכל האורך', () => {
    const verticalLine: ShapePoint[] = [
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
    ];
    const result = resampleByX(verticalLine, false, 4);
    expect(result).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('דטרמיניסטי: אותו קלט מייצר תמיד את אותה תוצאה', () => {
    const shape: ShapePoint[] = [
      { x: 0, y: 0.2 },
      { x: 0.3, y: 0.9 },
      { x: 0.7, y: 0.1 },
      { x: 1, y: 0.6 },
    ];
    expect(resampleByX(shape, false, 8)).toEqual(resampleByX(shape, false, 8));
  });

  it('זורק שגיאה על מערך נקודות ריק', () => {
    expect(() => resampleByX([], false, 8)).toThrow();
  });
});
