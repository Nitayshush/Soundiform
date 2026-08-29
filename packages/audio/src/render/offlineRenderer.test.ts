/**
 * @file        offlineRenderer.test.ts
 * @description ⭐ 2026-08-28 (הסבב המבני לסאונד בנייד): מוודא שהרינדור-מראש בדפדפן
 *              (Tone.Offline) מייצר באפר אמיתי — לא שקט, לא חורג מ-±1, ודטרמיניסטי —
 *              דרך רינדור PCM אמיתי, לא מוק. אותו דפוס בדיוק כמו serverRenderer.test.ts.
 * @author      Soundiform
 *
 * ⚠️ ה-import של webAudioPolyfill חייב להיות **ראשון**: Tone.Offline יוצר OfflineAudioContext
 * דרך standardized-audio-context, שקורא את window.OfflineAudioContext פעם אחת ברמת-המודול
 * בזמן ה-import הראשון של 'tone' (ראה webAudioPolyfill.ts). בדפדפן זה קיים מטבעו; ב-Node
 * (הבדיקה הזו) חייבים להזריק אותו לפני שכל דבר נוגע ב-'tone'.
 */

import './webAudioPolyfill';
import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@soundiform/core';
import { PREVIEW_SAMPLE_RATE, renderScoreToAudioBuffer } from './offlineRenderer';
import type { GenreAudioConfig } from './sharedScheduling';

const TICKS_PER_BEAT = 480;

function makeScore(): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'offline-renderer-test-seed',
    tempo: 128,
    timeSignature: [4, 4],
    key: { root: 0, mode: 'aeolian' },
    genreId: 'test',
    durationBars: 2,
    tracks: [
      {
        role: 'lead',
        instrumentId: 'test-lead',
        notes: Array.from({ length: 16 }, (_, index) => ({
          startTick: index * (TICKS_PER_BEAT / 2),
          durationTicks: 200,
          pitch: 60 + (index % 5),
          velocity: 0.8,
        })),
        mixSettings: { volume: 0.78, pan: 0, reverbSend: 0.25, delaySend: 0.15 },
      },
      {
        role: 'pad',
        instrumentId: 'test-pad',
        notes: [48, 55, 60].map((pitch) => ({
          startTick: 0,
          durationTicks: TICKS_PER_BEAT * 8,
          pitch,
          velocity: 0.5,
        })),
        mixSettings: { volume: 0.4, pan: 0, reverbSend: 0.3, delaySend: 0.1 },
      },
    ],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 2 }],
    metadata: { avgNoteDensity: 4, dominantMode: 'aeolian', rootFrequencyHz: 220 },
  };
}

const CONFIG: GenreAudioConfig = {
  synthPresets: {},
  mixCharacter: { reverbDecaySeconds: 1.5, delayTime: '8n', delayFeedback: 0.3 },
  sidechainEnabled: true,
};

function channelOf(buffer: AudioBuffer, index: number): Float32Array {
  return buffer.getChannelData(index);
}

function rms(samples: Float32Array): number {
  let sumSquares = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
}

function peak(samples: Float32Array): number {
  let maxAbs = 0;
  for (const sample of samples) {
    maxAbs = Math.max(maxAbs, Math.abs(sample));
  }
  return maxAbs;
}

describe('offlineRenderer — רינדור-מראש בדפדפן דרך Tone.Offline', () => {
  it('מייצר באפר סטריאו באורך/קצב-דגימה הנכונים, לא שקט ולא חורג מ-±1', async () => {
    const rendered = await renderScoreToAudioBuffer(makeScore(), CONFIG);

    expect(rendered.buffer.numberOfChannels).toBe(2);
    expect(rendered.sampleRate).toBe(PREVIEW_SAMPLE_RATE);
    expect(rendered.durationSeconds).toBeGreaterThan(0);
    // אורך הבאפר חייב לכסות את כל היצירה כולל זנב-הריוורב (computeDurationSeconds).
    expect(rendered.buffer.length).toBe(Math.round(rendered.durationSeconds * PREVIEW_SAMPLE_RATE));
    expect(rendered.renderMilliseconds).toBeGreaterThanOrEqual(0);

    const left = channelOf(rendered.buffer, 0);
    expect(rms(left)).toBeGreaterThan(0);
    // ⚠️ "בלי קליפינג" הוא כלל קשיח (§4.3) — הבאפר הזה מנוגן כמו-שהוא, בלי לימיטר נוסף
    // אחריו (ראה browserRenderer.ts), אז חריגה כאן הייתה עיוות אמיתי שנשמע.
    expect(peak(left)).toBeLessThanOrEqual(1);
    expect(peak(channelOf(rendered.buffer, 1))).toBeLessThanOrEqual(1);
  }, 30000);

  it('דטרמיניזם (§1): אותו score מרונדר פעמיים לאותו PCM בדיוק', async () => {
    const score = makeScore();
    const first = await renderScoreToAudioBuffer(score, CONFIG);
    const second = await renderScoreToAudioBuffer(score, CONFIG);

    expect(Array.from(channelOf(first.buffer, 0))).toEqual(Array.from(channelOf(second.buffer, 0)));
    expect(Array.from(channelOf(first.buffer, 1))).toEqual(Array.from(channelOf(second.buffer, 1)));
  }, 60000);
});
