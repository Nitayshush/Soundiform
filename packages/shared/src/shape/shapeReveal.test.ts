/**
 * @file        shapeReveal.test.ts
 * @description בדיקות ל"שרטוט מסונכרן" — ראה shapeReveal.ts (גרסת 2026-08-23: הקרנה למערכת
 *              צירי סרגל-התווים + חשיפה לפי מיקום-X מול הסורק, לא לפי סדר-ציור).
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { ShapeData } from './ShapeData';
import { projectShapeToStaff, revealedSegments } from './shapeReveal';

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

function zigzag(): ShapeData {
  // חוצה את אותו טווח-X פעמיים — בודק חשיפה לא-רציפה (כמה תת-פוליליינים).
  return {
    version: '1.0.0',
    paths: [
      {
        closed: false,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0.5 },
          { x: 0, y: 1 },
        ],
      },
    ],
  };
}

describe('projectShapeToStaff', () => {
  it('מקרין את תיבת-התיחום של הצורה למלוא ממדי הפריים (X ו-Y בנפרד)', () => {
    const layout = projectShapeToStaff(openLine(), DIMENSIONS);
    const points = layout.paths[0]?.points;
    expect(points?.[0]?.x).toBeCloseTo(0);
    expect(points?.at(-1)?.x).toBeCloseTo(DIMENSIONS.width);
  });

  it('stretchToFillFrame:false — ממפה ישירות מול הקנבס המלא, לא מתאים לתיבת-התיחום (2026-09-19)', () => {
    // קו קצר, מרוכז בפינה (x: 0.1-0.3 מתוך קנבס 0-1 מלא) — לא ממלא את כל רוחב-הצורה.
    const shortCornerLine: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: false,
          points: [
            { x: 0.1, y: 0.5 },
            { x: 0.3, y: 0.5 },
          ],
        },
      ],
    };
    const stretched = projectShapeToStaff(shortCornerLine, DIMENSIONS);
    const trueSize = projectShapeToStaff(shortCornerLine, DIMENSIONS, false);

    // stretch (ברירת-מחדל): הקו הקצר עדיין נמתח למלוא רוחב-הפריים.
    expect(stretched.paths[0]?.points[0]?.x).toBeCloseTo(0);
    expect(stretched.paths[0]?.points.at(-1)?.x).toBeCloseTo(DIMENSIONS.width);

    // trueSize: הקו נשאר במיקומו/גודלו האמיתי (10%-30% מרוחב הפריים), לא נמתח.
    expect(trueSize.paths[0]?.points[0]?.x).toBeCloseTo(0.1 * DIMENSIONS.width);
    expect(trueSize.paths[0]?.points.at(-1)?.x).toBeCloseTo(0.3 * DIMENSIONS.width);
  });

  it('צורה עם טווח-X אפסי לא זורקת (מוגן מחלוקה באפס)', () => {
    const verticalLine: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: false,
          points: [
            { x: 0.5, y: 0 },
            { x: 0.5, y: 1 },
          ],
        },
      ],
    };
    expect(() => projectShapeToStaff(verticalLine, DIMENSIONS)).not.toThrow();
  });
});

describe('revealedSegments', () => {
  it('לא מחזיר כלום ב-progress 0 (הכל מימין לסורק)', () => {
    const layout = projectShapeToStaff(openLine(), DIMENSIONS);
    expect(revealedSegments(layout, 0)).toEqual([]);
  });

  it('מחזיר את כל הצורה ב-progress 1', () => {
    const layout = projectShapeToStaff(openLine(), DIMENSIONS);
    const revealed = revealedSegments(layout, 1);
    expect(revealed).toHaveLength(1);
    expect(revealed[0]?.points.at(-1)?.x).toBeCloseTo(DIMENSIONS.width);
  });

  it('חושף לפי מיקום-X מול הסורק, לא לפי סדר-ציור: אף נקודה חשופה לא חורגת מהסורק', () => {
    // zigzag הולך (x=0)→(x=1, "המרכז" בסדר-הציור)→(x=0) — הנקודה האמצעית צויירה שנייה אבל
    // יש לה את ה-X הגבוה ביותר; ב-progress=0.5 היא לא אמורה להיחשף בכלל, למרות סדר הציור.
    const layout = projectShapeToStaff(zigzag(), DIMENSIONS);
    const revealed = revealedSegments(layout, 0.5);
    const allPoints = revealed.flatMap((segment) => segment.points);
    expect(allPoints.length).toBeGreaterThan(0);
    expect(allPoints.every((point) => point.x <= DIMENSIONS.width / 2 + 1e-6)).toBe(true);
  });

  it('⭐ 2026-09-21: כל מקטע נושא את pathIndex של ה-path המקורי שלו, לא רק points גולמי', () => {
    // שני paths נפרדים (לא zigzag אחד) — pathIndex 0 ו-1, כל אחד חוצה את הסורק פעם אחת.
    const twoPaths: ShapeData = {
      version: '1.0.0',
      paths: [
        { closed: false, points: [{ x: 0, y: 0.2 }, { x: 1, y: 0.2 }] },
        { closed: false, points: [{ x: 0, y: 0.8 }, { x: 1, y: 0.8 }] },
      ],
    };
    const layout = projectShapeToStaff(twoPaths, DIMENSIONS);
    const revealed = revealedSegments(layout, 1);
    expect(revealed).toHaveLength(2);
    expect(revealed.map((segment) => segment.pathIndex).sort()).toEqual([0, 1]);
  });

  it('צורה שחוצה את הסורק פעמיים (זיגזג) חושפת שני תת-פוליליינים נפרדים', () => {
    // zigzag: (x=0)→(x=1)→(x=0). ב-progress=0.3, שתי הקצוות (x=0) גלויות אבל האמצע (x=1) לא —
    // צריך להתקבל שני תת-פוליליינים נפרדים, לא אחד רציף.
    const layout = projectShapeToStaff(zigzag(), DIMENSIONS);
    const revealed = revealedSegments(layout, 0.3);
    expect(revealed).toHaveLength(2);
  });

  it('ב-progress=1 כל הצורה גלויה כפוליליין רציף אחד', () => {
    const layout = projectShapeToStaff(zigzag(), DIMENSIONS);
    const revealedAll = revealedSegments(layout, 1);
    expect(revealedAll).toHaveLength(1);
  });

  it('דטרמיניסטי: אותו קלט מייצר תמיד את אותה תוצאה', () => {
    const layout = projectShapeToStaff(zigzag(), DIMENSIONS);
    expect(revealedSegments(layout, 0.6)).toEqual(revealedSegments(layout, 0.6));
  });
});
