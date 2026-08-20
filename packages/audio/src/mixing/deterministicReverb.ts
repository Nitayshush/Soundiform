/**
 * @file        deterministicReverb.ts
 * @description ⭐ ריוורב-קונבולוציה עם impulse response שנוצר מ-seededRandom, לא מ-Tone.Reverb.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — למה לא Tone.Reverb: Tone.Reverb מייצר את ה-impulse response שלו דרך Tone.Noise,
 * ש-Tone.js מקודד ישירות עם Math.random() — גם לתוכן ה-buffer (בפעם הראשונה בכל process) וגם
 * ל-offset ההתחלתי בתוכו (בכל קריאה ל-start(), כלומר בכל בניית Reverb מחדש). זה שובר את
 * עקרון הדטרמיניזם (§1: "אותה צורה = בדיוק אותו סאונד, תמיד") — התגלה ב-Sprint 6 דרך בדיקה
 * אמיתית: אותו MusicalScore, מרונדר פעמיים באותו process, נתן PCM שונה. כל סגנון אמיתי
 * (genres/packs/*.json) מגדיר reverbSend>0 לפחות ל-pad, אז זה השפיע על *כל* רינדור.
 * הפתרון: קונבולוציה (Tone.Convolver, wrapper דק סביב ConvolverNode) עם IR שנבנה כאן
 * מ-createSeededRandom(reverbSeed) — קבוע לגמרי לאותו seed, גם בין processes/הפעלות שונות.
 */

import { Convolver, getContext, ToneAudioBuffer } from 'tone';
import { createSeededRandom } from '../internal/seededRandom';

const CHANNEL_COUNT = 2;
/** קבוע דעיכה ל- -60dB (RT60): exp(-DECAY_TO_MINUS_60DB) ≈ 0.001. */
const DECAY_TO_MINUS_60DB = Math.log(1000);

function buildImpulseResponseChannel(
  random: () => number,
  length: number,
  decaySeconds: number,
  sampleRate: number,
): Float32Array {
  const channel = new Float32Array(length);
  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    const white = random() * 2 - 1;
    const timeSeconds = sampleIndex / sampleRate;
    const envelope = Math.exp((-DECAY_TO_MINUS_60DB * timeSeconds) / decaySeconds);
    channel[sampleIndex] = white * envelope;
  }
  return channel;
}

/**
 * בונה Convolver עם impulse response דטרמיניסטי (רעש לבן דועך) — תחליף ל-Tone.Reverb.
 * אותו reverbSeed מייצר תמיד את אותו IR, כלומר אותו סאונד ריוורב בדיוק.
 */
export function createDeterministicReverb(reverbSeed: string, decaySeconds: number): Convolver {
  const sampleRate = getContext().sampleRate;
  const length = Math.ceil(decaySeconds * sampleRate);
  const random = createSeededRandom(reverbSeed);
  const channels = Array.from({ length: CHANNEL_COUNT }, () =>
    buildImpulseResponseChannel(random, length, decaySeconds, sampleRate),
  );
  const impulseResponse = ToneAudioBuffer.fromArray(channels);
  return new Convolver(impulseResponse);
}
