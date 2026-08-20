import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { shapeDataSchema } from '@soundiform/shared';
import { rasterToShapeData } from './rasterToShapeData';

/** ריבוע שחור על רקע לבן — קלט "אמיתי" (לא mock) שנועד לבדוק שpotrace באמת עוקב קונטור. */
async function blackSquareOnWhitePng(): Promise<Buffer> {
  const size = 200;
  const margin = 50; // ריבוע פנימי 100x100 בתוך קנבס 200x200 לבן
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}">
    <rect width="${String(size)}" height="${String(size)}" fill="#ffffff"/>
    <rect x="${String(margin)}" y="${String(margin)}" width="100" height="100" fill="#000000"/>
  </svg>`;
  return sharp(Buffer.from(svg))
    .png()
    .withMetadata({ exif: { IFD0: { Make: 'TestCam' } } })
    .toBuffer();
}

describe('rasterToShapeData — §8 שלב 4 (sharp re-encode) + potrace (מעקב-קונטור)', () => {
  it('מפיק ShapeData תקין (Zod) מתמונה אמיתית', async () => {
    const { shapeData } = await rasterToShapeData(await blackSquareOnWhitePng());
    expect(shapeDataSchema.safeParse(shapeData).success).toBe(true);
    expect(shapeData.paths.length).toBeGreaterThan(0);
  });

  it('עוקב אחרי קונטור מרובע (הריבוע השחור), לא נקודה מנוונת', async () => {
    const { shapeData } = await rasterToShapeData(await blackSquareOnWhitePng());
    const primary = shapeData.paths.reduce((longest, candidate) =>
      candidate.points.length > longest.points.length ? candidate : longest,
    );
    // potrace מפיק path עם הקואורדינטה האחרונה = הראשונה, אבל בלי פקודת Z מפורשת — עדיין
    // סגור-גיאומטרית (זה גם מה ש-contourExtractor.isNearlyClosed בודק בהמשך ה-pipeline).
    const first = primary.points[0];
    const last = primary.points.at(-1);
    expect(
      Math.hypot((last?.x ?? 0) - (first?.x ?? 0), (last?.y ?? 0) - (first?.y ?? 0)),
    ).toBeLessThan(0.05);
    const xs = primary.points.map((p) => p.x);
    const ys = primary.points.map((p) => p.y);
    // ריבוע ממורכז — הטווח על שני הצירים אמור להיות דומה בגודלו (לא קו שטוח בציר אחד).
    const widthSpan = Math.max(...xs) - Math.min(...xs);
    const heightSpan = Math.max(...ys) - Math.min(...ys);
    expect(widthSpan).toBeGreaterThan(0.3);
    expect(heightSpan).toBeGreaterThan(0.3);
    expect(widthSpan / heightSpan).toBeGreaterThan(0.5);
    expect(widthSpan / heightSpan).toBeLessThan(2);
  });

  it('מסיר EXIF metadata מהגרסה הנשמרת (§8 "מסיר EXIF ו-payloads")', async () => {
    const original = await blackSquareOnWhitePng();
    const originalMeta = await sharp(original).metadata();
    expect(originalMeta.exif).toBeDefined(); // ודאות שיש בכלל EXIF להסיר לפני הבדיקה

    const { sanitizedPngBuffer } = await rasterToShapeData(original);
    const cleanedMeta = await sharp(sanitizedPngBuffer).metadata();
    expect(cleanedMeta.exif).toBeUndefined();
  });

  it('זורק אם sharp לא מצליח לפענח את הקלט (בייטים אקראיים לא-תמונה)', async () => {
    const garbage = Buffer.from(Array.from({ length: 64 }, (_, i) => i));
    await expect(rasterToShapeData(garbage)).rejects.toThrow();
  });
});
