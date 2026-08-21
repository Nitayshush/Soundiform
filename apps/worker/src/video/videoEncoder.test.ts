/**
 * @file        videoEncoder.test.ts
 * @description בדיקה אמיתית: מרנדר פריימים אמיתיים (napi-rs/canvas) ומקודד ל-MP4 עם ffmpeg
 *              אמיתי, ומאמת את הפלט עם ffprobe אמיתי (רזולוציה/משך/streams) — לא מוק.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ דורש ffmpeg+ffprobe מותקנים ונגישים דרך PATH בזמן ריצת הבדיקה.
 */

import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ffmpeg from 'fluent-ffmpeg';
import { composeMusicalScore, geometryToMusic, type CompositionConfig } from '@soundiform/core';
import { encodeVideo, computeVideoDimensions } from './videoEncoder';

const TEST_CONFIG: CompositionConfig = {
  genreId: 'test',
  tempoBpm: 120,
  mode: 'aeolian',
  gridSubdivision: 16,
  swingAmount: 0,
};

function makeTestScore() {
  const shape = {
    version: '1.0.0',
    paths: [
      {
        closed: true,
        points: [
          { x: 0.5, y: 0.1 },
          { x: 0.9, y: 0.9 },
          { x: 0.1, y: 0.9 },
        ],
      },
    ],
  };
  const intent = geometryToMusic(shape, 'video-encoder-test-seed');
  return composeMusicalScore(intent, TEST_CONFIG);
}

function makeToneWav(durationSeconds: number): Buffer {
  const sampleRate = 44100;
  const frameCount = Math.round(sampleRate * durationSeconds);
  const channel = new Float32Array(frameCount);
  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = 0.3 * Math.sin((2 * Math.PI * 440 * index) / sampleRate);
  }

  // WAV קטן, בדיוק כמו encodeWav ב-apps/worker/src/encoders/wav.ts — כפילות מכוונת (טסט
  // עצמאי, לא רוצה תלות בין שתי חבילות בדיקה).
  const bytesPerSample = 2;
  const dataSize = frameCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < frameCount; index += 1) {
    const sample = Math.max(-1, Math.min(1, channel[index] ?? 0));
    view.setInt16(44 + index * 2, Math.round(sample * 0x7fff), true);
  }
  return Buffer.from(buffer);
}

function probe(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      resolve(data);
    });
  });
}

describe('computeVideoDimensions', () => {
  it('9:16 720p -> 720x1280 (זוגי)', () => {
    expect(computeVideoDimensions('720p', '9:16')).toEqual({ width: 720, height: 1280 });
  });
});

describe('encodeVideo', () => {
  it('מרנדר MP4 אמיתי עם וידאו+אודיו, רזולוציה ומשך נכונים', async () => {
    const durationSeconds = 1;
    const dimensions = computeVideoDimensions('720p', '9:16');
    const videoBuffer = await encodeVideo({
      score: makeTestScore(),
      durationSeconds,
      audioBuffer: makeToneWav(durationSeconds),
      dimensions,
      watermark: true,
    });

    expect(videoBuffer.length).toBeGreaterThan(0);
    expect(videoBuffer.subarray(4, 8).toString('ascii')).toBe('ftyp');

    // ffprobe דורש path על דיסק — כותבים לקובץ זמני לצורך הבדיקה בלבד.
    const tempPath = join(tmpdir(), `soundiform-video-test-${String(Date.now())}.mp4`);
    await writeFile(tempPath, videoBuffer);
    try {
      const info = await probe(tempPath);
      const videoStream = info.streams.find((stream) => stream.codec_type === 'video');
      const audioStream = info.streams.find((stream) => stream.codec_type === 'audio');
      expect(videoStream).toBeDefined();
      expect(audioStream).toBeDefined();
      expect(videoStream?.width).toBe(dimensions.width);
      expect(videoStream?.height).toBe(dimensions.height);
      expect(Number(info.format.duration)).toBeCloseTo(durationSeconds, 0);
    } finally {
      await unlink(tempPath);
    }
  }, 30000);
});
