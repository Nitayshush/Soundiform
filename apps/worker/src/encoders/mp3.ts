/**
 * @file        mp3.ts
 * @description קידוד MP3 מ-WAV buffer באמצעות fluent-ffmpeg (libmp3lame), הכל בזיכרון (stdin/stdout).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ נרמול -14 LUFS (§4.3) קורה *לפני* קידוד ה-WAV הנכנס לכאן (packages/audio/src/mixing/
 * loudness.ts's normalizeToTargetLufs, מופעל ב-jobs/renderAudio.ts) — הקידוד כאן לא נוגע
 * בעוצמה, רק ממיר קידוד.
 *
 * דורש ffmpeg מותקן ונגיש דרך PATH (ב-Docker: apt-get install ffmpeg, ראה Dockerfile).
 */

import ffmpeg from 'fluent-ffmpeg';
import { PassThrough, Readable } from 'node:stream';

const DEFAULT_BITRATE_KBPS = 192;

export interface Mp3EncodeOptions {
  bitrateKbps?: number;
}

/** מקודד buffer של קובץ WAV ל-MP3 (libmp3lame). מחזיר Promise שנפתר עם ה-buffer המקודד. */
export function encodeMp3(wavBuffer: Buffer, options: Mp3EncodeOptions = {}): Promise<Buffer> {
  const bitrateKbps = options.bitrateKbps ?? DEFAULT_BITRATE_KBPS;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const outputStream = new PassThrough();

    outputStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    outputStream.on('error', reject);
    outputStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    ffmpeg(Readable.from(wavBuffer))
      .inputFormat('wav')
      .audioCodec('libmp3lame')
      .audioBitrate(bitrateKbps)
      .format('mp3')
      .on('error', (error: unknown) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      })
      .pipe(outputStream, { end: true });
  });
}
