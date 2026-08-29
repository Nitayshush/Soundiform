/**
 * @file        SynthProviderScheduling.test.ts
 * @description ⭐ 2026-08-29 (רגרסיה על קריסה אמיתית שנתפסה בסטודיו): שני תווים שמתוזמנים
 *              לאותו רגע בדיוק על קול **מונופוני** הפילו את Tone.js עם
 *              "Start time must be strictly greater than previous start time".
 * @author      Soundiform
 * @created     2026-08-29
 *
 * למה זה קריטי דווקא עכשיו: כשהניגון היה סינתזה-בזמן-אמת, זו הייתה שגיאה בקונסולה שהפילה
 * תו בודד. מאז המעבר לרינדור-מראש (offlineRenderer.ts), חריגה באמצע התזמון מפילה את **כל**
 * הרינדור — כלומר "אין צליל בכלל". התרחיש קורה בפועל: תבנית-התופים ופגיעות-הפינות
 * (harmonyEngine.ts) יכולות ליפול על אותו step, ו-humanizeTiming יכול לקרב שני תווים לזהות.
 *
 * ⚠️ קובץ נפרד ולא הוספה ל-SynthProvider.test.ts — ראה vitest.config.ts: מספר הרינדורים
 * בכל קובץ הוא מה שקובע יציבות מול node-web-audio-api.
 */

import '../render/webAudioPolyfill';
import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@soundiform/core';
import { renderScoreToAudioBuffer } from '../render/offlineRenderer';
import type { GenreAudioConfig } from '../render/sharedScheduling';

/** שני תווים באותו startTick בדיוק על טראק מונופוני — בדיוק מה שהפיל את Tone לפני התיקון. */
function makeCollidingScore(): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'monophonic-collision-regression',
    tempo: 120,
    timeSignature: [4, 4],
    key: { root: 0, mode: 'aeolian' },
    genreId: 'test',
    durationBars: 1,
    tracks: [
      {
        role: 'drums',
        instrumentId: 'test-drums',
        notes: [
          { startTick: 0, durationTicks: 120, pitch: 45, velocity: 1 },
          { startTick: 0, durationTicks: 120, pitch: 45, velocity: 0.8 },
          { startTick: 240, durationTicks: 120, pitch: 45, velocity: 1 },
          // גם "לאחור" — תו שמתוזמן *לפני* קודמו ברשימה, לא רק זהה לו.
          { startTick: 120, durationTicks: 120, pitch: 45, velocity: 0.9 },
        ],
        mixSettings: { volume: 1, pan: 0, reverbSend: 0, delaySend: 0 },
      },
    ],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 1 }],
    metadata: { avgNoteDensity: 4, dominantMode: 'aeolian', rootFrequencyHz: 220 },
  };
}

const MONOPHONIC_CONFIG: GenreAudioConfig = {
  synthPresets: {
    drums: {
      oscillatorType: 'sine',
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
      polyphonic: false,
    },
  },
  mixCharacter: { reverbDecaySeconds: 0.1, delayTime: '8n', delayFeedback: 0 },
};

describe('SynthProvider — תזמון מונופוני: תווים חופפים לא מפילים את הרינדור', () => {
  it('תווים באותו startTick (ומחוץ לסדר) מרונדרים בלי לזרוק, ומייצרים אודיו אמיתי', async () => {
    const rendered = await renderScoreToAudioBuffer(makeCollidingScore(), MONOPHONIC_CONFIG);

    const samples = rendered.buffer.getChannelData(0);
    let sumSquares = 0;
    let peak = 0;
    for (const sample of samples) {
      sumSquares += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    // לא שקט — כלומר הרינדור באמת רץ עד הסוף ולא נקטע באמצע התזמון.
    expect(Math.sqrt(sumSquares / samples.length)).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(1);
  }, 30000);
});
