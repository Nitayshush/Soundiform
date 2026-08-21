/**
 * @file        avatarImage.ts
 * @description ⭐ תמונת פרופיל: sharp resize-to-256×256 + strip metadata. אין כאן שום קונטור/
 *              ShapeData — זו לא צורה, רק תמונה לתצוגה. ראה rasterToShapeData.ts להשוואה
 *              (אותו rotate()+re-encode, בלי החצי של potrace).
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import sharp from 'sharp';

const AVATAR_DIMENSION = 256;

/** הופך תמונת raster גולמית (לא-סמוכה) לPNG מרובע 256×256 נקי-מטא-דאטה. */
export async function toAvatarPng(originalBuffer: Buffer): Promise<Buffer> {
  return sharp(originalBuffer)
    .rotate()
    .resize({
      width: AVATAR_DIMENSION,
      height: AVATAR_DIMENSION,
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer();
}
