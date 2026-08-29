/**
 * @file        frameRenderer.ts
 * @description ⭐ עטיפה דקה: יוצרת קנבס של @napi-rs/canvas ומאצילה את הציור עצמו
 *              ל-@soundiform/video (drawVideoFrame) — אותו קוד בדיוק שרץ בדפדפן.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ 2026-08-29: כל לוגיקת הציור (סרגל התווים, הזוהר, פרצי-האור, הצורה הנחשפת,
 * הווטרמארק) **עברה** ל-packages/video/src/drawFrame.ts. עד אז היא הייתה כתובה כאן בלבד,
 * מול @napi-rs/canvas — וההערה בראש הקובץ הזה אף הודתה בכפילות מול ScoreStaff.tsx. מאז
 * שההורדה עברה לרוץ *במכשיר* (apps/web/src/lib/video), אותו ציור נדרש גם מול ה-canvas של
 * הדפדפן, ולכן הוא חי עכשיו במקום אחד ומקבל 2D context מבחוץ. מה שנשאר כאן ייחודי
 * ל-Node: יצירת הקנבס והמרה ל-PNG/JPEG.
 *
 * ⚠️ הקובץ הזה **לא נמחק ולא הוחלף** — מסלול ה-worker נשאר תקף לחלוטין (§0 כלל 2).
 */

import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import type { MusicalScore } from '@soundiform/core';
import type { ShapeData } from '@soundiform/shared';
import { drawVideoFrame, type Canvas2DLike, type FrameDimensions } from '@soundiform/video';

export type { FrameDimensions } from '@soundiform/video';

/**
 * מצייר פריים בודד ומחזיר PNG.
 * ⚠️ ה-cast ל-Canvas2DLike מכוון: ה-context של @napi-rs/canvas מקיים את הממשק המבני
 * במלואו, אבל הטיפוסים שלו מוצהרים עם enum-ים ספציפיים (למשל lineJoin) שלא מתלכדים
 * אוטומטית עם `string`. ראה packages/video/src/canvas2d.ts.
 */
export async function renderVideoFrame(
  score: MusicalScore,
  progress: number,
  dimensions: FrameDimensions,
  watermark: boolean,
  shapeData: ShapeData,
): Promise<Buffer> {
  const canvas = createCanvas(dimensions.width, dimensions.height);
  const ctx = canvas.getContext('2d');
  drawVideoFrame(ctx as unknown as Canvas2DLike, {
    score,
    shapeData,
    progress,
    dimensions,
    watermark,
  });
  return Promise.resolve(canvas.toBuffer('image/png'));
}

const POSTER_PROGRESS = 0.5;

/** פריים בודד (JPG) לשימוש כ-thumbnail בכרטיסי גלריה — ראה renders.posterKey. */
export async function renderPosterFrame(
  score: MusicalScore,
  dimensions: FrameDimensions,
  watermark: boolean,
  shapeData: ShapeData,
): Promise<Buffer> {
  const pngBuffer = await renderVideoFrame(
    score,
    POSTER_PROGRESS,
    dimensions,
    watermark,
    shapeData,
  );
  return sharp(pngBuffer).jpeg({ quality: 80 }).toBuffer();
}
