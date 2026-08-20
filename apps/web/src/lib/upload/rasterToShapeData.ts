/**
 * @file        rasterToShapeData.ts
 * @description ⭐ raster (PNG/JPEG/WebP) → ShapeData: sharp re-encode (§8 שלב 4, מסיר
 *              EXIF/payloads) → potrace (מעקב-קונטור, כמו Inkscape) → אותו path-parsing
 *              כמו SVG. ראה PROJECT.md §11 (הערה ליד Sprint 2 — נדרש אלגוריתם נפרד מ-SVG).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ ה-SVG שיוצא מ-potrace הוא תוצר-שלנו (מבּיטמאפ שכבר עבר sharp re-encode), לא markup
 * שהמשתמש שלט בו ישירות — אין צורך להעביר אותו דרך sanitizeSvg.ts (DOMPurify). עדיין מפורש
 * דרך svgMarkupToShapeData (jsdom parse-only, אין הרצת script) כדי לחלץ את הנקודות.
 */

import sharp from 'sharp';
import { trace, type PotraceOptions } from 'potrace';
import type { ShapeData } from '@soundiform/shared';
import { svgMarkupToShapeData } from './svgToShapeData';

/** גבול צד לפני מעקב-קונטור — חוסם עלות CPU/זיכרון על תמונות ענקיות (קלט לא-סמוך, §8). */
const MAX_TRACE_DIMENSION = 2000;
/** תקרת גודל לגרסה שנשמרת ב-R2 (תצוגה/מודרציה) — נדיבה יותר, לא צריכה להיות מדויקת לניתוח. */
const MAX_STORED_DIMENSION = 4096;

const POTRACE_OPTIONS: PotraceOptions = {
  threshold: 128,
  turdSize: 4,
  optCurve: true,
  blackOnWhite: true,
};

function traceToSvg(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    trace(buffer, POTRACE_OPTIONS, (error, svg) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(svg);
    });
  });
}

export interface RasterConversionResult {
  shapeData: ShapeData;
  /** PNG נקי (rotate()+strip metadata) — נשמר ב-R2 תחת uploads/, לתצוגה/מודרציה. */
  sanitizedPngBuffer: Buffer;
}

/**
 * הופך תמונת raster גולמית (עדיין לא-סמוכה!) ל-ShapeData + גרסה נקייה לאחסון.
 * זורק אם sharp לא מצליח לפענח את הקובץ (לא תמונה תקינה חרף magic bytes תקינים) או אם
 * potrace לא מוצא אף קונטור (למשל תמונה חלקה/ריקה לגמרי).
 */
export async function rasterToShapeData(originalBuffer: Buffer): Promise<RasterConversionResult> {
  const traceInput = await sharp(originalBuffer)
    .rotate()
    .resize({
      width: MAX_TRACE_DIMENSION,
      height: MAX_TRACE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .grayscale()
    .png()
    .toBuffer();

  const svg = await traceToSvg(traceInput);
  const shapeData = svgMarkupToShapeData(svg);

  const sanitizedPngBuffer = await sharp(originalBuffer)
    .rotate()
    .resize({
      width: MAX_STORED_DIMENSION,
      height: MAX_STORED_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  return { shapeData, sanitizedPngBuffer };
}
