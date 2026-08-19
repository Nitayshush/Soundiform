/**
 * @file        renderVideo.ts
 * @description רנדור וידאו (9:16 / 1080p / 4K) — הצורה מונפשת + פס קול. ראה PROJECT.md §11 Sprint 8.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * זרימה: extractContour (פעם אחת) → encodeVideo (פריימים + מיקס עם ה-WAV שכבר מרונדר) → PUT ל-R2.
 * נקרא מ-jobs/renderAudio.ts כהמשך אופציונלי לאותו job (לא queue נפרד) — ראה שם.
 */

import { extractContour } from '@shape-sound/core';
import type { ShapeData } from '@shape-sound/shared';
import type { VideoExportOptions } from '@shape-sound/audio';
import type { StorageProvider } from '@shape-sound/storage';
import { computeVideoDimensions, encodeVideo } from '../video/videoEncoder';

export async function runRenderVideoJob(
  shape: ShapeData,
  durationSeconds: number,
  audioBuffer: Buffer,
  options: VideoExportOptions,
  storage: StorageProvider,
  keyPrefix: string,
): Promise<string> {
  const contour = extractContour(shape);
  const dimensions = computeVideoDimensions(options.quality, options.aspectRatio);

  const videoBuffer = await encodeVideo({
    paths: shape.paths,
    contourPoints: contour.points,
    durationSeconds,
    audioBuffer,
    dimensions,
    watermark: options.watermark,
  });

  const videoKey = `${keyPrefix}/output.mp4`;
  const uploadUrl = await storage.getUploadUrl(videoKey, { contentType: 'video/mp4' });
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(videoBuffer),
    headers: { 'Content-Type': 'video/mp4' },
  });
  if (!response.ok) {
    throw new Error(
      `העלאת וידאו ל-R2 נכשלה עבור ${videoKey}: ${String(response.status)} ${response.statusText}`,
    );
  }

  return videoKey;
}
