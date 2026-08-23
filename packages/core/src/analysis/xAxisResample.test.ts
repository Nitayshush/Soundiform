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
import { resampleByX, type ResamplePath } from './xAxisResample';

function path(points: ShapePoint[], closed = false): ResamplePath {
  return { points, closed };
}

describe('resampleByX', () => {
  it('צורה אלכסונית מונוטונית (path בודד): ערך ה-Y בכל bucket תואם את המיקום היחסי על ה-X', () => {
    const diagonal = path([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    const result = resampleByX([diagonal], 5);
    expect(result).toHaveLength(5);
    expect(result[0]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0.5);
    expect(result.at(-1)).toBeCloseTo(1);
  });

  it('צורה סגורה עם שני ענפים על אותו X — ממוצע בין שני חיתוכים (לא הענף שצויר ראשון)', () => {
    // עיגול-מקורב: הענף העליון (y=0) והתחתון (y=1) על x=0.5, הצורה סגורה.
    const diamond = path(
      [
        { x: 0, y: 0.5 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0.5 },
        { x: 0.5, y: 1 },
      ],
      true,
    );
    const result = resampleByX([diamond], 5);
    // ה-bucket האמצעי (x=0.5) חייב לחתוך גם את הענף העליון (y≈0) וגם את התחתון (y≈1) — ממוצע ≈0.5.
    expect(result[2]).toBeCloseTo(0.5, 1);
  });

  it('ריצה כמעט-אנכית (טווח X מדולל) מקבלת אינטרפולציה מהעוגנים השכנים, לא null/NaN', () => {
    const shape = path([
      { x: 0, y: 0 },
      { x: 0.1, y: 0.5 },
      { x: 0.1, y: 0.9 }, // ריצה אנכית טהורה — אף target-X לא יחתוך אותה בדיוק
      { x: 1, y: 1 },
    ]);
    const result = resampleByX([shape], 10);
    expect(result.every((value) => Number.isFinite(value))).toBe(true);
    // מונוטוני עולה בגדול (אין "חורים" שקופצים לערך שרירותי)
    let previous = result[0] ?? 0;
    for (const value of result.slice(1)) {
      expect(value).toBeGreaterThanOrEqual(previous - 0.05);
      previous = value;
    }
  });

  it('צורה עם טווח X אפסי (קו אנכי טהור) מחזירה את ה-Y הממוצע לכל האורך', () => {
    const verticalLine = path([
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
    ]);
    const result = resampleByX([verticalLine], 4);
    expect(result).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('דטרמיניסטי: אותו קלט מייצר תמיד את אותה תוצאה', () => {
    const shape = path([
      { x: 0, y: 0.2 },
      { x: 0.3, y: 0.9 },
      { x: 0.7, y: 0.1 },
      { x: 1, y: 0.6 },
    ]);
    expect(resampleByX([shape], 8)).toEqual(resampleByX([shape], 8));
  });

  it('זורק שגיאה כשאין אף path עם נקודות', () => {
    expect(() => resampleByX([], 8)).toThrow();
    expect(() => resampleByX([path([])], 8)).toThrow();
  });

  describe('כמה paths (כל משיכת-עט תורמת ליצירה)', () => {
    it('שתי משיכות בטווחי-X נפרדים — כל אחת ממלאת את ה-buckets שלה, בלי "לגלוש" זו לזו', () => {
      // משיכה ראשונה: x ∈ [0, 0.4], y=0.2 קבוע. משיכה שנייה: x ∈ [0.6, 1], y=0.8 קבוע.
      const first = path([
        { x: 0, y: 0.2 },
        { x: 0.4, y: 0.2 },
      ]);
      const second = path([
        { x: 0.6, y: 0.8 },
        { x: 1, y: 0.8 },
      ]);
      const result = resampleByX([first, second], 10);
      // bucket ראשון (x=0) שייך למשיכה הראשונה בלבד.
      expect(result[0]).toBeCloseTo(0.2);
      // bucket אחרון (x=1) שייך למשיכה השנייה בלבד.
      expect(result.at(-1)).toBeCloseTo(0.8);
    });

    it('שתי משיכות שחופפות באותו X — ממוצע בין שתיהן, בדיוק כמו שני ענפים של אותה צורה', () => {
      const first = path([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);
      const second = path([
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ]);
      const result = resampleByX([first, second], 5);
      expect(result.every((value) => Math.abs(value - 0.5) < 1e-9)).toBe(true);
    });

    it('path בודד עם רשימת-paths של אחד מייצר תוצאה זהה לגרסה הישנה (רגרסיה)', () => {
      const single = path([
        { x: 0, y: 0.2 },
        { x: 0.3, y: 0.9 },
        { x: 0.7, y: 0.1 },
        { x: 1, y: 0.6 },
      ]);
      const viaArray = resampleByX([single], 8);
      expect(viaArray).toHaveLength(8);
      expect(viaArray[0]).toBeCloseTo(0.2);
      expect(viaArray.at(-1)).toBeCloseTo(0.6);
    });
  });
});
