/**
 * @file        kidsShapes.test.ts
 * @description ⭐ 2026-09-04 (Kids Studio v1): דטרמיניזם וגיאומטריה בסיסית של מחולל הצורות.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { applyAspectRatio, generateShapePoints, KIDS_SHAPE_KINDS } from './kidsShapes';

function centroid(points: { x: number; y: number }[]): { x: number; y: number } {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

describe('generateShapePoints', () => {
  it('דטרמיניסטי — אותו קלט מייצר אותו פלט בדיוק', () => {
    for (const kind of KIDS_SHAPE_KINDS) {
      const first = generateShapePoints(kind, 0.5, 0.5, 0.3);
      const second = generateShapePoints(kind, 0.5, 0.5, 0.3);
      expect(second).toEqual(first);
    }
  });

  it('כל נקודה בטווח [0,1] גם כשהצורה חורגת מהלוח', () => {
    for (const kind of KIDS_SHAPE_KINDS) {
      const points = generateShapePoints(kind, 0.05, 0.95, 0.8);
      for (const p of points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('כל צורה מייצרת לפחות 3 נקודות (מסגרת תקפה לצליל)', () => {
    for (const kind of KIDS_SHAPE_KINDS) {
      expect(generateShapePoints(kind, 0.5, 0.5, 0.3).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('עיגול/ריבוע/כוכב ממורכזים סביב cx,cy (סימטריים)', () => {
    for (const kind of ['circle', 'square', 'star'] as const) {
      const points = generateShapePoints(kind, 0.4, 0.6, 0.2);
      const c = centroid(points);
      expect(c.x).toBeCloseTo(0.4, 2);
      expect(c.y).toBeCloseTo(0.6, 2);
    }
  });

  it('שינוי size משנה את פיזור הנקודות (לא צורה קבועה)', () => {
    const small = generateShapePoints('circle', 0.5, 0.5, 0.1);
    const large = generateShapePoints('circle', 0.5, 0.5, 0.4);
    const spread = (points: { x: number; y: number }[]): number =>
      Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    expect(spread(large)).toBeGreaterThan(spread(small));
  });
});

describe('applyAspectRatio', () => {
  it('הופך "עיגול" למעגל פיזי אמיתי על מיכל שאינו מרובע (16:9)', () => {
    const width = 1600;
    const height = 900;
    const aspectRatio = width / height;
    const raw = generateShapePoints('circle', 0.5, 0.5, 0.3);
    const corrected = applyAspectRatio(raw, 0.5, aspectRatio);

    const physicalXs = corrected.map((p) => p.x * width);
    const physicalYs = corrected.map((p) => p.y * height);
    const xRadius = (Math.max(...physicalXs) - Math.min(...physicalXs)) / 2;
    const yRadius = (Math.max(...physicalYs) - Math.min(...physicalYs)) / 2;

    // ⚠️ זה הבאג שדווח חי: "העיגול יוצא ביצתי" — בלי applyAspectRatio, yRadius כאן היה
    // ~0.56 מ-xRadius (900/1600), אליפסה מובהקת, לא סטיית-עיגול קטנה.
    expect(yRadius / xRadius).toBeCloseTo(1, 2);
  });

  it('על מיכל מרובע (aspectRatio=1) לא משנה כלום', () => {
    const raw = generateShapePoints('star', 0.5, 0.5, 0.3);
    const corrected = applyAspectRatio(raw, 0.5, 1);
    expect(corrected).toEqual(raw);
  });
});
