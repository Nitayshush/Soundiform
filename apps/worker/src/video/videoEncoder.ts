/**
 * @file        videoEncoder.ts
 * @description ⭐ מרכיב פריימים + אודיו ל-MP4 אחד, דרך ffmpeg. הכל בתיקיית temp זמנית.
 * @author      Shape-to-Sound
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קבצים זמניים בכוונה (לא stdin pipe): ffmpeg צריך גישה seek-able לרצף פריימים
 * (`-framerate` + `frame-%05d.png`) — pipe יחיד לא מתאים לקלט multi-file. תיקיית ה-temp
 * נמחקת תמיד ב-finally, גם בכשל.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import type { ShapePoint } from '@shape-sound/shared';
import type { VideoAspectRatio, VideoQuality } from '@shape-sound/audio';
import { renderVideoFrame, type FrameDimensions } from './frameRenderer';

const FRAME_RATE = 30;

const QUALITY_SHORT_SIDE: Record<VideoQuality, number> = {
  '720p': 720,
  '1080p': 1080,
  '4k': 2160,
};

function toEven(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/** מוסכמה נפוצה לוידאו אנכי: "1080p" = הצלע הקצרה, לא בהכרח הגובה. */
export function computeVideoDimensions(
  quality: VideoQuality,
  aspectRatio: VideoAspectRatio,
): FrameDimensions {
  const shortSide = QUALITY_SHORT_SIDE[quality];
  switch (aspectRatio) {
    case '9:16':
      return { width: toEven(shortSide), height: toEven((shortSide * 16) / 9) };
    case '16:9':
      return { width: toEven((shortSide * 16) / 9), height: toEven(shortSide) };
    case '1:1':
      return { width: toEven(shortSide), height: toEven(shortSide) };
  }
}

interface DrawablePath {
  points: ShapePoint[];
  closed: boolean;
}

export interface VideoEncodeInput {
  paths: readonly DrawablePath[];
  contourPoints: readonly ShapePoint[];
  durationSeconds: number;
  audioBuffer: Buffer;
  dimensions: FrameDimensions;
  watermark: boolean;
}

/** מקודד פריימים+אודיו ל-MP4. מחזיר את ה-buffer המקודד. */
export async function encodeVideo(input: VideoEncodeInput): Promise<Buffer> {
  const frameCount = Math.max(1, Math.round(input.durationSeconds * FRAME_RATE));
  const tempDir = await mkdtemp(join(tmpdir(), 'shape-sound-video-'));

  try {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const progress = frameCount <= 1 ? 0 : frameIndex / frameCount;
      const frameBuffer = renderVideoFrame(
        input.paths,
        input.contourPoints,
        progress,
        input.dimensions,
        input.watermark,
      );
      const frameNumber = String(frameIndex).padStart(5, '0');
      await writeFile(join(tempDir, `frame-${frameNumber}.png`), frameBuffer);
    }

    const audioPath = join(tempDir, 'audio.wav');
    await writeFile(audioPath, input.audioBuffer);
    const outputPath = join(tempDir, 'output.mp4');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(join(tempDir, 'frame-%05d.png'))
        .inputFPS(FRAME_RATE)
        .input(audioPath)
        .outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest'])
        .output(outputPath)
        .on('end', () => {
          resolve();
        })
        .on('error', (error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        })
        .run();
    });

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
