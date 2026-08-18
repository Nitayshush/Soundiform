/**
 * @file        mp3.test.ts
 * @description בדיקת קידוד MP3 אמיתית — מריצה ffmpeg בפועל (לא מוק), מוודאת פלט MPEG תקני.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ דורש ffmpeg מותקן ונגיש דרך PATH בזמן ריצת הבדיקה.
 */

import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';
import { encodeMp3 } from './mp3';

function makeTestToneWav(): Buffer {
  const sampleRate = 44100;
  const durationSeconds = 0.5;
  const frameCount = Math.round(sampleRate * durationSeconds);
  const channel = new Float32Array(frameCount);
  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = 0.4 * Math.sin((2 * Math.PI * 440 * index) / sampleRate);
  }
  return encodeWav({ sampleRate, channels: [channel, channel] });
}

/** מאתר MPEG frame sync (11 ביטים של 1) — 0xFF ואחריו 0xE0-0xFF, בתוך N הבייטים הראשונים. */
function containsMpegFrameSync(buffer: Buffer, searchWindowBytes: number): boolean {
  const limit = Math.min(buffer.length - 1, searchWindowBytes);
  for (let index = 0; index < limit; index += 1) {
    if (buffer[index] === 0xff && (buffer[index + 1] ?? 0) >= 0xe0) {
      return true;
    }
  }
  return false;
}

describe('encodeMp3', () => {
  it('מקודד WAV אמיתי ל-MP3 תקני (magic bytes, גודל סביר) דרך ffmpeg אמיתי', async () => {
    const wavBuffer = makeTestToneWav();
    const mp3Buffer = await encodeMp3(wavBuffer, { bitrateKbps: 192 });

    expect(mp3Buffer.length).toBeGreaterThan(0);
    // ID3v2 header ("ID3") או MPEG frame sync ישירות — תלוי אם ffmpeg כתב תגית.
    const hasId3 = mp3Buffer.subarray(0, 3).toString('ascii') === 'ID3';
    const hasFrameSync = containsMpegFrameSync(mp3Buffer, 4096);
    expect(hasId3 || hasFrameSync).toBe(true);

    // 0.5s ב-192kbps ≈ 12000 בייטים — טולרנס רחב (metadata/framing overhead).
    const expectedBytes = (192_000 / 8) * 0.5;
    expect(mp3Buffer.length).toBeGreaterThan(expectedBytes * 0.5);
    expect(mp3Buffer.length).toBeLessThan(expectedBytes * 2);
  }, 20000);
});
