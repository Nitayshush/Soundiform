/**
 * @file        boardRaster.test.ts
 * @description ⭐ 2026-08-31: בדיקות לרסטריזציה של הציור על לוח התווים. הבדיקה המרכזית כאן
 *              היא **בדיקת הרגרסיה של קריסת-המתאר**: עיגול חייב לייצר יותר משורה אחת.
 *              המנוע הישן (resampleByX) החזיר עבורו span=0.000 — תו בודד שחוזר על עצמו —
 *              וזה מה שגרם לכל היצירות להישמע אותו דבר.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { rasterizeShapeToBoard, type RasterPath } from './boardRaster';

const ROWS = 15;
const COLUMNS = 32;
const OPTIONS = { rowCount: ROWS, columnCount: COLUMNS, maxVoicesPerColumn: 4 };

function circle(cx: number, cy: number, r: number, steps = 64): RasterPath {
  return {
    points: Array.from({ length: steps }, (_, index) => {
      const angle = (2 * Math.PI * index) / steps;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    }),
    closed: true,
  };
}

function horizontalLine(y: number, steps = 32): RasterPath {
  return {
    points: Array.from({ length: steps }, (_, index) => ({ x: index / (steps - 1), y })),
    closed: false,
  };
}

function allRows(raster: readonly (readonly number[])[]): Set<number> {
  return new Set(raster.flatMap((rows) => [...rows]));
}

describe('rasterizeShapeToBoard — רגרסיה: קריסת מתאר-הגובה', () => {
  it('עיגול מייצר יותר משורה אחת (המנוע הישן החזיר תו בודד)', () => {
    const raster = rasterizeShapeToBoard([circle(0.5, 0.5, 0.45)], OPTIONS);
    expect(allRows(raster).size).toBeGreaterThan(1);
  });

  it('עיגול נותן שני קולות באמצע-הצורה — הקצה העליון והתחתון גם יחד', () => {
    const raster = rasterizeShapeToBoard([circle(0.5, 0.5, 0.45)], OPTIONS);
    const middleColumn = raster[Math.floor(COLUMNS / 2)] ?? [];
    expect(middleColumn.length).toBeGreaterThanOrEqual(2);
  });

  it('ריבוע מייצר יותר משורה אחת', () => {
    const square: RasterPath = {
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ],
      closed: true,
    };
    expect(allRows(rasterizeShapeToBoard([square], OPTIONS)).size).toBeGreaterThan(1);
  });

  it('שתי משיכות נפרדות נשמעות שתיהן — לא מתבטלות לתו האמצעי', () => {
    const raster = rasterizeShapeToBoard([horizontalLine(0.2), horizontalLine(0.8)], OPTIONS);
    const rows = allRows(raster);
    const highOnly = allRows(rasterizeShapeToBoard([horizontalLine(0.2)], OPTIONS));
    const lowOnly = allRows(rasterizeShapeToBoard([horizontalLine(0.8)], OPTIONS));
    for (const row of [...highOnly, ...lowOnly]) {
      expect(rows.has(row)).toBe(true);
    }
    expect(rows.size).toBe(2);
  });
});

describe('rasterizeShapeToBoard — נאמנות לציור', () => {
  it('קו ישר אופקי נותן שורה אחת בכל עמודה, לכל אורך הלוח', () => {
    const raster = rasterizeShapeToBoard([horizontalLine(0.5)], OPTIONS);
    expect(raster).toHaveLength(COLUMNS);
    for (const rows of raster) {
      expect(rows).toHaveLength(1);
    }
    expect(allRows(raster).size).toBe(1);
  });

  it('קו אלכסוני עולה מייצר שורות עולות לאורך הזמן', () => {
    const raster = rasterizeShapeToBoard(
      [
        {
          points: [
            { x: 0, y: 1 },
            { x: 1, y: 0 },
          ],
          closed: false,
        },
      ],
      OPTIONS,
    );
    const firstColumn = raster[0] ?? [];
    const lastColumn = raster[COLUMNS - 1] ?? [];
    expect(Math.min(...firstColumn)).toBeLessThan(Math.min(...lastColumn));
  });

  it('מקטע כמעט-אנכי לא נעלם — הליכה על המקטע, לא דגימת X', () => {
    // ⚠️ זה בדיוק מה שדגימת-X מפספסת: הקו קיים רק בתחום X צר מאוד.
    const raster = rasterizeShapeToBoard(
      [
        {
          points: [
            { x: 0, y: 0.5 },
            { x: 0.5, y: 0.5 },
            { x: 0.5001, y: 0.05 },
            { x: 1, y: 0.05 },
          ],
          closed: false,
        },
      ],
      OPTIONS,
    );
    // הקפיצה האנכית חייבת להשאיר עקבות בשורות שבין 0.5 ל-0.05, לא רק בשתי הקצוות.
    const rows = [...allRows(raster)].sort((a, b) => a - b);
    expect(rows.length).toBeGreaterThan(2);
  });

  it('עמודה שהציור לא עובר עליה נשארת ריקה (מרווח בציור = שקט במוזיקה)', () => {
    const raster = rasterizeShapeToBoard(
      [
        {
          points: [
            { x: 0, y: 0.5 },
            { x: 0.2, y: 0.5 },
          ],
          closed: false,
        },
        {
          points: [
            { x: 0.8, y: 0.5 },
            { x: 1, y: 0.5 },
          ],
          closed: false,
        },
      ],
      OPTIONS,
    );
    expect(raster.some((rows) => rows.length === 0)).toBe(true);
  });

  it('ציור חסר-רוחב (קו אנכי) הופך לאקורד מוחזק בכל העמודות', () => {
    const raster = rasterizeShapeToBoard(
      [
        {
          points: [
            { x: 0.5, y: 0.1 },
            { x: 0.5, y: 0.9 },
          ],
          closed: false,
        },
      ],
      OPTIONS,
    );
    expect(raster.every((rows) => rows.length > 1)).toBe(true);
    expect(new Set(raster.map((rows) => rows.join(','))).size).toBe(1);
  });
});

describe('rasterizeShapeToBoard — תקרת קולות', () => {
  it('אף עמודה לא חורגת מהתקרה', () => {
    const raster = rasterizeShapeToBoard(
      [
        {
          points: [
            { x: 0.5, y: 0 },
            { x: 0.5, y: 1 },
          ],
          closed: false,
        },
      ],
      { rowCount: ROWS, columnCount: COLUMNS, maxVoicesPerColumn: 3 },
    );
    for (const rows of raster) {
      expect(rows.length).toBeLessThanOrEqual(3);
    }
  });

  it('הדילול שומר את הקצה העליון והתחתון — הצורה לא משתטחת', () => {
    const raster = rasterizeShapeToBoard(
      [
        {
          points: [
            { x: 0.5, y: 0 },
            { x: 0.5, y: 1 },
          ],
          closed: false,
        },
      ],
      { rowCount: ROWS, columnCount: COLUMNS, maxVoicesPerColumn: 3 },
    );
    const rows = raster[0] ?? [];
    expect(Math.min(...rows)).toBe(0);
    expect(Math.max(...rows)).toBe(ROWS - 1);
  });

  it('השורות בכל עמודה ממוינות ובלי כפילויות', () => {
    const raster = rasterizeShapeToBoard([circle(0.5, 0.5, 0.4)], OPTIONS);
    for (const rows of raster) {
      expect([...rows]).toEqual([...new Set(rows)].sort((a, b) => a - b));
    }
  });
});

describe('rasterizeShapeToBoard — קלט קצה', () => {
  it('בלי paths — כל העמודות ריקות, בלי לזרוק', () => {
    const raster = rasterizeShapeToBoard([], OPTIONS);
    expect(raster).toHaveLength(COLUMNS);
    expect(raster.every((rows) => rows.length === 0)).toBe(true);
  });

  it('נקודה בודדת לא מפילה את הרסטר', () => {
    const raster = rasterizeShapeToBoard(
      [{ points: [{ x: 0.5, y: 0.5 }], closed: false }],
      OPTIONS,
    );
    expect(raster).toHaveLength(COLUMNS);
  });

  it('דטרמיניסטי — אותו קלט, אותו פלט בדיוק', () => {
    const shape = [circle(0.4, 0.6, 0.3)];
    expect(rasterizeShapeToBoard(shape, OPTIONS)).toEqual(rasterizeShapeToBoard(shape, OPTIONS));
  });
});
