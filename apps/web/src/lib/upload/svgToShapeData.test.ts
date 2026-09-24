import { describe, expect, it } from 'vitest';
import { shapeDataSchema } from '@soundiform/shared';
import { svgMarkupToShapeData, SvgConversionError } from './svgToShapeData';

describe('svgMarkupToShapeData', () => {
  it('הופך <rect> לארבע נקודות סגורות, מנורמלות ל-0..1', () => {
    const shape = svgMarkupToShapeData(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="100"/></svg>',
    );
    expect(shapeDataSchema.safeParse(shape).success).toBe(true);
    expect(shape.paths).toHaveLength(1);
    expect(shape.paths[0]?.closed).toBe(true);
    for (const point of shape.paths[0]?.points ?? []) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it('שומר יחס-רוחב-גובה (fit-to-square, ממורכז) — מלבן לא רבוע לא נהפך לריבוע', () => {
    // רוחב 200, גובה 100 → side=200, ה-Y צריך להיות ממורכז סביב 0.25..0.75
    const shape = svgMarkupToShapeData(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="200" height="100"/></svg>',
    );
    const ys = shape.paths[0]?.points.map((p) => p.y) ?? [];
    expect(Math.min(...ys)).toBeCloseTo(0.25, 2);
    expect(Math.max(...ys)).toBeCloseTo(0.75, 2);
  });

  it('מדגם <circle> למספר נקודות סגור', () => {
    const shape = svgMarkupToShapeData(
      '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50"/></svg>',
    );
    expect(shape.paths[0]?.closed).toBe(true);
    expect(shape.paths[0]?.points.length).toBeGreaterThan(10);
  });

  it('מפעיל transform="translate(...)" על <path> לפני נרמול', () => {
    // שני מלבנים זהים בגודלם, אחד מוזז — התיבה הכוללת (bbox) צריכה לכלול את שניהם,
    // כך שאחרי נרמול הם לא חופפים במלואם.
    const shape = svgMarkupToShapeData(
      `<svg xmlns="http://www.w3.org/2000/svg">
         <rect x="0" y="0" width="10" height="10"/>
         <rect x="0" y="0" width="10" height="10" transform="translate(100,0)"/>
       </svg>`,
    );
    expect(shape.paths).toHaveLength(2);
    const firstMinX = Math.min(...(shape.paths[0]?.points.map((p) => p.x) ?? []));
    const secondMinX = Math.min(...(shape.paths[1]?.points.map((p) => p.x) ?? []));
    expect(secondMinX).toBeGreaterThan(firstMinX);
  });

  it('מצטבר transform דרך עץ <g> מקונן (הורה + ילד)', () => {
    const shape = svgMarkupToShapeData(
      `<svg xmlns="http://www.w3.org/2000/svg">
         <g transform="translate(50,0)">
           <rect x="0" y="0" width="10" height="10" transform="translate(50,0)"/>
         </g>
       </svg>`,
    );
    // world x מתחיל ב-100 (50 מה-g + 50 מה-rect עצמו) — אחרי נרמול על bbox יחיד, עדיין תיבה תקינה.
    expect(shapeDataSchema.safeParse(shape).success).toBe(true);
  });

  it('מתעלם מ-<defs>/<clipPath> — לא הופך את תוכנם לנקודות', () => {
    const shape = svgMarkupToShapeData(
      `<svg xmlns="http://www.w3.org/2000/svg">
         <defs><rect x="0" y="0" width="999" height="999"/></defs>
         <circle cx="10" cy="10" r="5"/>
       </svg>`,
    );
    expect(shape.paths).toHaveLength(1);
  });

  it('זורק SvgConversionError כשאין אף צורה גיאומטרית', () => {
    expect(() =>
      svgMarkupToShapeData('<svg xmlns="http://www.w3.org/2000/svg"><title>ריק</title></svg>'),
    ).toThrow(SvgConversionError);
  });

  it('זורק SvgConversionError כש-<svg> חסר לחלוטין', () => {
    expect(() => svgMarkupToShapeData('not svg at all')).toThrow(SvgConversionError);
  });
});

describe('svgMarkupToShapeData — קנבס-אמיתי (viewBox/width+height) לא נחתך (2026-09-24)', () => {
  it('עם width/height על ה-<svg>: צורה קטנה וממורכזת נשארת קטנה וממורכזת, לא נמתחת', () => {
    // קנבס 200x100, ריבוע 20x20 ממורכז בתוכו (x:90-110, y:40-60) — 10% מהרוחב, 20% מהגובה.
    const shape = svgMarkupToShapeData(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">' +
        '<rect x="90" y="40" width="20" height="20"/></svg>',
    );
    const xs = shape.paths[0]?.points.map((p) => p.x) ?? [];
    const ys = shape.paths[0]?.points.map((p) => p.y) ?? [];
    // side=max(200,100)=200 → x: (90..110)/200=0.45..0.55; y: קנבס-100 ממורכז בריבוע-200
    // (offsetY=50), אז (40+50..60+50)/200=0.45..0.55 — לא 0..1 (הבאג הישן).
    expect(Math.min(...xs)).toBeCloseTo(0.45, 2);
    expect(Math.max(...xs)).toBeCloseTo(0.55, 2);
    expect(Math.min(...ys)).toBeCloseTo(0.45, 2);
    expect(Math.max(...ys)).toBeCloseTo(0.55, 2);
  });

  it('עם viewBox על ה-<svg>: אותו עיקרון, כולל minX/minY לא-אפסיים', () => {
    const shape = svgMarkupToShapeData(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 200 100">' +
        '<rect x="100" y="50" width="20" height="20"/></svg>',
    );
    const xs = shape.paths[0]?.points.map((p) => p.x) ?? [];
    // x בתוך ה-viewBox: 100-10=90 עד 120-10=110, מתוך רוחב-200 → 0.45..0.55 (אחרי איזון-ריבוע).
    expect(Math.min(...xs)).toBeCloseTo(0.45, 2);
    expect(Math.max(...xs)).toBeCloseTo(0.55, 2);
  });

  it('בלי viewBox/width/height על ה-<svg> — נופל בדיוק להתנהגות הישנה (bbox של הצורה)', () => {
    // אותו טסט כמו "שומר יחס-רוחב-גובה" הקיים — מוודא שהתיקון לא שינה את ברירת-המחדל.
    const shape = svgMarkupToShapeData(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="200" height="100"/></svg>',
    );
    const ys = shape.paths[0]?.points.map((p) => p.y) ?? [];
    expect(Math.min(...ys)).toBeCloseTo(0.25, 2);
    expect(Math.max(...ys)).toBeCloseTo(0.75, 2);
  });

  it('width/height עם יחידות לא-מספריות ("200px") נופל בבטחה לברירת-המחדל, לא זורק/משתגע', () => {
    expect(() =>
      svgMarkupToShapeData(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200px" height="100px">' +
          '<rect x="0" y="0" width="50" height="50"/></svg>',
      ),
    ).not.toThrow();
  });
});
