/**
 * @file        renderVideo.ts
 * @description רנדור וידאו (9:16 / 1080p / 4K) — הצורה המקורית (שרטוט מסונכרן) + סרגל התווים
 *              + פס קול. ראה PROJECT.md §11 Sprint 8.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * זרימה: encodeVideo (פריימים + מיקס עם ה-WAV שכבר מרונדר) → PUT ל-R2. נקרא מ-jobs/renderAudio.ts
 * כהמשך אופציונלי לאותו job (לא queue נפרד) — ראה שם.
 *
 * ⭐ 2026-08-22: מייצר גם poster.jpg (פריים בודד, progress=0.5) — thumbnail לכרטיסי גלריה,
 * ראה renders.posterKey ו-frameRenderer.ts's renderPosterFrame.
 */

import type { MusicalScore } from '@soundiform/core';
import type { VideoExportOptions } from '@soundiform/audio';
import type { StorageProvider } from '@soundiform/storage';
import type { ShapeData } from '@soundiform/shared';
import { computeVideoDimensions, encodeVideo } from '../video/videoEncoder';
import { renderPosterFrame } from '../video/frameRenderer';
import { uploadBuffer } from '../storage/uploadBuffer';

export interface RenderVideoJobResult {
  videoKey: string;
  posterKey: string;
}

export async function runRenderVideoJob(
  score: MusicalScore,
  durationSeconds: number,
  audioBuffer: Buffer,
  options: VideoExportOptions,
  storage: StorageProvider,
  keyPrefix: string,
  shapeData: ShapeData,
): Promise<RenderVideoJobResult> {
  const dimensions = computeVideoDimensions(options.quality, options.aspectRatio);

  const [videoBuffer, posterBuffer] = await Promise.all([
    encodeVideo({
      score,
      durationSeconds,
      audioBuffer,
      dimensions,
      watermark: options.watermark,
      shapeData,
    }),
    renderPosterFrame(score, dimensions, options.watermark, shapeData),
  ]);

  const videoKey = `${keyPrefix}/output.mp4`;
  const posterKey = `${keyPrefix}/poster.jpg`;
  await Promise.all([
    uploadBuffer(storage, videoKey, videoBuffer, 'video/mp4'),
    uploadBuffer(storage, posterKey, posterBuffer, 'image/jpeg'),
  ]);

  return { videoKey, posterKey };
}
