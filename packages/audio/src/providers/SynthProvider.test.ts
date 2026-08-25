/**
 * @file        SynthProvider.test.ts
 * @description ⭐ 2026-08-25 (תיקון-באג אמיתי): preset.filter (ברמה-העליונה) לא אמור להיות
 *              מוחל כשל-preset יש layers מפורש — synthPresetSchema מתעד "layers מחליף
 *              oscillatorType/envelope/filter/unison". לפני התיקון, preset.filter הוחל
 *              *תמיד* על סכום-השכבות, מה שיכול לבטל כמעט-לגמרי שכבת-highpass כש-preset.filter
 *              הוא lowpass נמוך (בדיוק המקרה שהתגלה בטראקי-תופים חדשים, ראה harmonyEngine.ts).
 * @author      Soundiform
 * @created     2026-08-25
 */

import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@soundiform/core';
import { renderToBuffer } from '../render/serverRenderer';
import type { GenreAudioConfig } from '../render/sharedScheduling';

function rms(samples: Float32Array): number {
  let sumSquares = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
}

function makeDrumsOnlyScore(): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'synth-provider-layers-test',
    tempo: 120,
    timeSignature: [4, 4],
    key: { root: 0, mode: 'aeolian' },
    genreId: 'test',
    durationBars: 1,
    tracks: [
      {
        role: 'drums',
        instrumentId: 'test-drums',
        notes: [{ startTick: 0, durationTicks: 240, pitch: 45, velocity: 1 }],
        mixSettings: { volume: 1, pan: 0, reverbSend: 0, delaySend: 0 },
      },
    ],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 1 }],
    metadata: { avgNoteDensity: 1, dominantMode: 'aeolian', rootFrequencyHz: 220 },
  };
}

function makeAudioConfig(topLevelFilterFrequencyHz: number): GenreAudioConfig {
  return {
    synthPresets: {
      drums: {
        oscillatorType: 'sine',
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
        polyphonic: false,
        filter: { type: 'lowpass', frequencyHz: topLevelFilterFrequencyHz },
        layers: [
          {
            oscillatorType: 'square',
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
            gain: 1,
            detuneSemitones: 0,
            filter: { type: 'highpass', frequencyHz: 2000 },
          },
        ],
      },
    },
    mixCharacter: { reverbDecaySeconds: 0.1, delayTime: '8n', delayFeedback: 0 },
  };
}

describe('SynthProvider — preset.filter (top-level) לא מבטל שכבות מפורשות (layers)', () => {
  it('שכבת-layer עם highpass גבוה מייצרת בערך אותה עוצמה גם כש-preset.filter הוא lowpass נמוך שהיה מבטל אותה לפני התיקון', async () => {
    // ⚠️ לפני התיקון, preset.filter (lowpass) הוחל תמיד על סכום-השכבות — lowpass נמוך (100Hz)
    // דרך highpass גבוה (2000Hz) ≈ כלום עובר, בעוד lowpass גבוה (20000Hz, כמעט "בלי פילטר")
    // לא היה משנה כלום. אחרי התיקון, preset.filter מתעלם לגמרי כש-layers מוגדר — שני הרינדורים
    // אמורים לצאת *זהים* (אותו סכום-שכבות בדיוק, ה-lowpass לא נכנס למשוואה כלל).
    const lowLowpass = await renderToBuffer(makeDrumsOnlyScore(), makeAudioConfig(100));
    const highLowpass = await renderToBuffer(makeDrumsOnlyScore(), makeAudioConfig(20000));

    const [lowChannel] = lowLowpass.channels;
    const [highChannel] = highLowpass.channels;
    expect(lowChannel).toBeDefined();
    expect(highChannel).toBeDefined();

    const lowEnergy = rms(lowChannel ?? new Float32Array());
    const highEnergy = rms(highChannel ?? new Float32Array());
    expect(lowEnergy).toBeGreaterThan(0);
    expect(lowEnergy).toBeCloseTo(highEnergy, 5);
  }, 20000);
});
