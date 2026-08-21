/**
 * @file        renderVideo.ts
 * @description רנדור וידאו (9:16 / 1080p / 4K) — הצורה מונפשת + פס קול. ראה PROJECT.md §11 Sprint 8.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * זרימה: encodeVideo (פריימים של סרגל התווים + מיקס עם ה-WAV שכבר מרונדר) → PUT ל-R2.
 * נקרא מ-jobs/renderAudio.ts כהמשך אופציונלי לאותו job (לא queue נפרד) — ראה שם.
 */

import type { MusicalScore } from '@soundiform/core';
import type { VideoExportOptions } from '@soundiform/audio';
import type { StorageProvider } from '@soundiform/storage';
import { computeVideoDimensions, encodeVideo } from '../video/videoEncoder';

export async function runRenderVideoJob(
  score: MusicalScore,
  durationSeconds: number,
  audioBuffer: Buffer,
  options: VideoExportOptions,
  storage: StorageProvider,
  keyPrefix: string,
): Promise<string> {
  const dimensions = computeVideoDimensions(options.quality, options.aspectRatio);

  const videoBuffer = await encodeVideo({
    score,
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
