/**
 * @file        wav.test.ts
 * @description בדיקת מבנה בייטים אמיתי של קובץ WAV מקודד — לא מוק.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';

describe('encodeWav', () => {
  it('כותב RIFF/WAVE header ו-fmt chunk תקניים', () => {
    const left = new Float32Array([0, 0.5, -0.5, 1]);
    const right = new Float32Array([0, -0.5, 0.5, -1]);
    const buffer = encodeWav({ sampleRate: 44100, channels: [left, right] });
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(buffer.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(buffer.subarray(12, 16).toString('ascii')).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16); // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2); // channelCount
    expect(view.getUint32(24, true)).toBe(44100); // sampleRate
    expect(view.getUint16(34, true)).toBe(16); // bitsPerSample
    expect(buffer.subarray(36, 40).toString('ascii')).toBe('data');

    const dataSize = view.getUint32(40, true);
    expect(dataSize).toBe(4 * 2 * 2); // frames * channels * bytesPerSample
    expect(buffer.length).toBe(44 + dataSize);
    expect(view.getUint32(4, true)).toBe(36 + dataSize); // RIFF chunk size
  });

  it('דוגמאות ה-PCM המקודדות מתאימות (בטולרנס כימות) לקלט המקורי', () => {
    const left = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const buffer = encodeWav({ sampleRate: 8000, channels: [left] });
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const decoded: number[] = [];
    for (let index = 0; index < left.length; index += 1) {
      decoded.push(view.getInt16(44 + index * 2, true) / 0x7fff);
    }

    for (let index = 0; index < left.length; index += 1) {
      expect(decoded[index]).toBeCloseTo(left[index] ?? 0, 3);
    }
  });

  it('buffer ריק (0 פריימים) לא זורק ומחזיר data chunk באורך 0', () => {
    const buffer = encodeWav({ sampleRate: 44100, channels: [new Float32Array(0)] });
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    expect(view.getUint32(40, true)).toBe(0);
    expect(buffer.length).toBe(44);
  });
});
