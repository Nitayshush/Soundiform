/**
 * @file        onsetEvents.test.ts
 * @description ⭐ 2026-08-31: בדיקות לשכבת-האירועים. הבדיקה המרכזית היא **שהזרם הרציף נשבר**:
 *              לפני השכבה הזו כל ציור הפיק מכה בכל עמודה, ולכן 100% מעמדות-הגריד הופעלו
 *              בכל בר — 16 מכות בבר, תמיד, בכל ציור. זה מה שגרם לכל היצירות להישמע אותו דבר.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { rasterizeShapeToBoard, type RasterPath } from './boardRaster';
import { buildEventRaster } from './onsetEvents';

const ROWS = 15;
const COLUMNS = 64;
const RASTER_OPTIONS = { rowCount: ROWS, columnCount: COLUMNS, maxVoicesPerColumn: 3 };
const EVENT_OPTIONS = { driftRows: 2 };

function rasterOf(paths: RasterPath[]) {
  return rasterizeShapeToBoard(paths, RASTER_OPTIONS);
}

/** כמה פעמים השורות משתנות בין עמודות סמוכות — פרוקסי ישיר למספר המכות. */
function changeCount(raster: readonly (readonly number[])[]): number {
  let changes = 0;
  for (let column = 1; column < raster.length; column += 1) {
    if ((raster[column] ?? []).join(',') !== (raster[column - 1] ?? []).join(',')) {
      changes += 1;
    }
  }
  return changes;
}

const diagonal: RasterPath = {
  points: Array.from({ length: 64 }, (_, index) => ({
    x: index / 63,
    y: 1 - index / 63,
  })),
  closed: false,
};

describe('buildEventRaster — שבירת הזרם הרציף', () => {
  it('אלכסון מייצר הרבה פחות מכות אחרי הדירוג', () => {
    const raw = rasterOf([diagonal]);
    const evented = buildEventRaster(raw, EVENT_OPTIONS);
    expect(changeCount(evented.raster)).toBeLessThan(changeCount(raw));
  });

  it('אלכסון עדיין עולה — הדירוג לא משטח את הצורה', () => {
    const { raster } = buildEventRaster(rasterOf([diagonal]), EVENT_OPTIONS);
    const first = raster.find((rows) => rows.length > 0) ?? [];
    const last = [...raster].reverse().find((rows) => rows.length > 0) ?? [];
    expect(Math.min(...first)).toBeLessThan(Math.min(...last));
  });

  it('קו ישר אופקי נשאר תו אחד — בלי מכות מיותרות', () => {
    const flat: RasterPath = {
      points: Array.from({ length: 40 }, (_, index) => ({ x: index / 39, y: 0.5 })),
      closed: false,
    };
    const { raster, eventCount } = buildEventRaster(rasterOf([flat]), EVENT_OPTIONS);
    expect(changeCount(raster)).toBe(0);
    expect(eventCount).toBe(1); // רק תחילת המשיכה
  });

  it('קו משונן מייצר יותר אירועים מקשת חלקה — הקצב באמת נגזר מהציור', () => {
    const smooth: RasterPath = {
      points: Array.from({ length: 64 }, (_, index) => {
        const t = index / 63;
        return { x: t, y: 0.9 - 0.7 * Math.sin(Math.PI * t) };
      }),
      closed: false,
    };
    const jagged: RasterPath = {
      points: Array.from({ length: 64 }, (_, index) => ({
        x: index / 63,
        y: index % 2 === 0 ? 0.15 : 0.85,
      })),
      closed: false,
    };
    const smoothEvents = buildEventRaster(rasterOf([smooth]), EVENT_OPTIONS).eventCount;
    const jaggedEvents = buildEventRaster(rasterOf([jagged]), EVENT_OPTIONS).eventCount;
    expect(jaggedEvents).toBeGreaterThan(smoothEvents);
  });
});

describe('buildEventRaster — עוצמות ואירועים', () => {
  it('תחילת משיכה היא האירוע החזק ביותר', () => {
    const { strengthByColumn } = buildEventRaster(rasterOf([diagonal]), EVENT_OPTIONS);
    const firstEvent = strengthByColumn.findIndex((value) => value > 0);
    expect(strengthByColumn[firstEvent]).toBe(1);
  });

  it('עמודה בלי אירוע מקבלת עוצמה 0', () => {
    const flat: RasterPath = {
      points: Array.from({ length: 40 }, (_, index) => ({ x: index / 39, y: 0.5 })),
      closed: false,
    };
    const { strengthByColumn } = buildEventRaster(rasterOf([flat]), EVENT_OPTIONS);
    expect(strengthByColumn.filter((value) => value > 0)).toHaveLength(1);
  });

  it('מרווח בציור מייצר אירוע חדש אחריו (תחילת משיכה שנייה)', () => {
    const twoStrokes: RasterPath[] = [
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
    ];
    const { eventCount } = buildEventRaster(rasterOf(twoStrokes), EVENT_OPTIONS);
    expect(eventCount).toBeGreaterThanOrEqual(2);
  });

  it('סף-נדידה גדול יותר = פחות אירועים', () => {
    const raw = rasterOf([diagonal]);
    const tight = buildEventRaster(raw, { driftRows: 1 }).eventCount;
    const loose = buildEventRaster(raw, { driftRows: 5 }).eventCount;
    expect(loose).toBeLessThan(tight);
  });

  it('דטרמיניסטי', () => {
    const raw = rasterOf([diagonal]);
    expect(buildEventRaster(raw, EVENT_OPTIONS)).toEqual(buildEventRaster(raw, EVENT_OPTIONS));
  });

  it('רסטר ריק לא מפיל ולא ממציא אירועים', () => {
    const empty = rasterizeShapeToBoard([], RASTER_OPTIONS);
    const result = buildEventRaster(empty, EVENT_OPTIONS);
    expect(result.eventCount).toBe(0);
    expect(result.raster).toHaveLength(COLUMNS);
  });
});

describe('buildEventRaster — קיצון שמגיעים אליו בהדרגה ונעצרים בו (2026-09-23)', () => {
  /**
   * ⭐ הבאג שדווח בבדיקה חיה: ירידה הדרגתית (שורה אחת בכל פעם, לא קפיצה) עד שפל, עצירה
   * ארוכה שם (פלאטו — בדיוק מה שצויר), ואז עלייה חזרה. אומת ישירות מול פרויקט אמיתי
   * ("draft 1") — הרצף הגולמי-לפני-דירוג ירד בהדרגה ל-1 והוחזק שם 28 עמודות; הרסטר
   * המדורג הישן **אף פעם לא הכיל את הערך 1**, לא בזמן הפלאטו ולא אחריו.
   *
   * מדמה כאן את אותה צורת-רצף (ירידה הדרגתית → פלאטו ארוך על השפל → עלייה הדרגתית בחזרה)
   * דרך צורה מצוירת אמיתית, לא נתונים גולמיים — כדי שהבדיקה תרוץ דרך אותה צנרת בדיוק
   * (rasterizeShapeToBoard → buildEventRaster) שהמשתמש עובר בפועל.
   */
  const gradualDipAndPlateau: RasterPath = {
    points: [
      // יורד בהדרגה, שורה אחת כל כמה עמודות (לא קפיצה) — מ-y=0.05 (שורה גבוהה) עד השפל
      // האמיתי (y=0.99 -> row 0 מתוך 15 שורות, ראה quantizeYToRowIndex ב-noteBoard.ts).
      ...Array.from({ length: 24 }, (_, i) => ({ x: (0.4 * i) / 23, y: 0.05 + (0.94 * i) / 23 })),
      // פלאטו ארוך בדיוק על השפל (y קבוע) — בדיוק מה שצויר ב-draft 1.
      ...Array.from({ length: 20 }, (_, i) => ({ x: 0.4 + (0.2 * i) / 19, y: 0.99 })),
      // עולה בהדרגה חזרה למעלה.
      ...Array.from({ length: 24 }, (_, i) => ({ x: 0.6 + (0.4 * i) / 23, y: 0.99 - (0.94 * i) / 23 })),
    ],
    closed: false,
  };

  it('השפל שמצוירים אליו בהדרגה ונעצרים בו קיים ברסטר המדורג (לא רק בגולמי)', () => {
    const raw = rasterOf([gradualDipAndPlateau]);
    const rawMinRow = Math.min(...raw.flatMap((rows) => rows));
    // ⚠️ מוודאים קודם שהצורה באמת יורדת עד השפל האמיתי (לא רק "קרוב") — אחרת הבדיקה
    // הייתה יכולה לעבור בטעות גם בלי לתפוס את הבאג.
    expect(rawMinRow).toBe(0);

    const { raster } = buildEventRaster(raw, EVENT_OPTIONS);
    const eventedRows = new Set(raster.flatMap((rows) => rows));
    expect(eventedRows.has(rawMinRow)).toBe(true);
  });

  it('כשהשפל נרשם, יש לו עוצמה ממשית (לא 0) — הוא אירוע אמיתי, לא רק ״נדחס פנימה״', () => {
    const raw = rasterOf([gradualDipAndPlateau]);
    const rawMinRow = Math.min(...raw.flatMap((rows) => rows));
    const { raster, strengthByColumn } = buildEventRaster(raw, EVENT_OPTIONS);
    const columnsWithMinRow = raster
      .map((rows, index) => (rows.includes(rawMinRow) ? index : -1))
      .filter((index) => index >= 0);
    expect(columnsWithMinRow.length).toBeGreaterThan(0);
    const hasRealStrength = columnsWithMinRow.some((column) => (strengthByColumn[column] ?? 0) > 0);
    expect(hasRealStrength).toBe(true);
  });
});
