/**
 * @file        sharedReverb.test.ts
 * @description ⭐ 2026-08-28 (שדרוג-תשתית): מוודא שאפיק-הריוורב המשותף (קונבולוציה דטרמיניסטית,
 *              ראה sharedReverb.ts) באמת מתנהג כמו ריוורב — לא שקט, דועך עם הזמן (לא feedback
 *              שנשאר תקוע), ודטרמיניסטי — דרך רינדור PCM אמיתי (renderToBuffer), לא מוק,
 *              אותו דפוס בדיוק כמו serverRenderer.test.ts/SynthProvider.test.ts. כולל גם
 *              רגרסיה על ניסיון-ביניים (ריוורב-אלגוריתמי) שנפסל בגלל חוסר-יציבות-לאורך-זמן —
 *              ראה ההערות לפני כל describe block למטה, ובפרט ה-describe האחרון בקובץ.
 * @author      Soundiform
 *
 * ⚠️ ה-import של webAudioPolyfill חייב להיות **ראשון** — הוא מזריק את
 * window.OfflineAudioContext, ש-standardized-audio-context (שעליו Tone נשען) קורא פעם אחת
 * ברמת-המודול בזמן ה-import הראשון של 'tone'. עד 2026-08-29 זה הגיע לכאן במקרה, דרך
 * serverRenderer.ts; מאז שהקובץ עבר ל-offlineRenderer (ראה renderChannels למטה) חייבים
 * לייבא אותו במפורש, אחרת: "Missing the native OfflineAudioContext constructor".
 */

import '../render/webAudioPolyfill';
import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@soundiform/core';
import { renderScoreToAudioBuffer } from '../render/offlineRenderer';
import type { GenreAudioConfig } from '../render/sharedScheduling';

/**
 * ⚠️ 2026-08-29 — כל הקובץ הזה מרנדר דרך offlineRenderer (מסלול-הדפדפן) ולא דרך
 * serverRenderer's renderToBuffer, משתי סיבות ממשיות:
 *
 * (א) **דליפת-context**: renderToBuffer קורא ל-`setContext(...)` ולעולם לא משחזר את
 *     ה-context הקודם, כך שכל קריאה משאירה OfflineContext נטוש. בקובץ הזה יש 6 רינדורים,
 *     והצטברות הזיכרון-הנייטיב הזו הפילה את תהליך-העובד של vitest ב~50% מההרצות
 *     ("Worker exited unexpectedly") — נבדק ואומת: הבדיקה הארוכה *לבדה* עוברת 4/4, וכל
 *     הקובץ יחד נופל לסירוגין. `Tone.Offline` משחזר את ה-context בעצמו ולכן לא מדליף.
 * (ב) זה גם המסלול ה*נכון* לבדוק: הבאג שהרגרסיה הזו שומרת עליו (שריקה הולכת ומתחזקת)
 *     נשמע בדפדפן, וזה בדיוק הקוד שרץ שם. מסלול-השרת מכוסה ב-serverRenderer.test.ts.
 */
async function renderChannels(
  score: MusicalScore,
  config: GenreAudioConfig,
): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const rendered = await renderScoreToAudioBuffer(score, config);
  const channels = Array.from({ length: rendered.buffer.numberOfChannels }, (_, index) =>
    rendered.buffer.getChannelData(index),
  );
  return { channels, sampleRate: rendered.buffer.sampleRate };
}

function rms(samples: Float32Array, startSample: number, endSample: number): number {
  let sumSquares = 0;
  const from = Math.max(0, startSample);
  const to = Math.min(samples.length, endSample);
  for (let index = from; index < to; index += 1) {
    const sample = samples[index] ?? 0;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / (to - from));
}

/** בר אחד ב-120bpm = 2 שניות בדיוק; תו קצר (0.2s) עם reverbSend גבוה — הזנב שאחריו הוא כמעט-כולו ריוורב. */
function makeReverbTestScore(): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'shared-reverb-test-seed',
    tempo: 120,
    timeSignature: [4, 4],
    key: { root: 0, mode: 'aeolian' },
    genreId: 'test',
    durationBars: 1,
    tracks: [
      {
        role: 'lead',
        instrumentId: 'test-lead',
        notes: [{ startTick: 0, durationTicks: 96, pitch: 64, velocity: 1 }],
        mixSettings: { volume: 1, pan: 0, reverbSend: 0.9, delaySend: 0 },
      },
    ],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 1 }],
    metadata: { avgNoteDensity: 1, dominantMode: 'aeolian', rootFrequencyHz: 220 },
  };
}

const REVERB_TEST_CONFIG: GenreAudioConfig = {
  synthPresets: {},
  mixCharacter: { reverbDecaySeconds: 1, delayTime: '8n', delayFeedback: 0 },
};

describe('sharedReverb (קונבולוציה דטרמיניסטית) — דרך רינדור PCM אמיתי', () => {
  it('לא שקט בהתקפת-התו, והזנב-שאחרי (כמעט-כולו ריוורב) דועך עם הזמן', async () => {
    const rendered = await renderChannels(makeReverbTestScore(), REVERB_TEST_CONFIG);
    const [channel] = rendered.channels;
    expect(channel).toBeDefined();
    const samples = channel ?? new Float32Array();
    const sampleRate = rendered.sampleRate;

    const attackEnergy = rms(samples, 0, Math.round(0.1 * sampleRate));
    expect(attackEnergy).toBeGreaterThan(0);

    // ⚠️ החלונות חייבים להיות *קרובים בזמן* להתקפת-התו (t=0) — reverbDecaySeconds=1 אומר
    // שהאנרגיה כבר ב- -60dB בערך שנייה אחרי ההתקפה; חלון מאוחר מדי (למשל באזור-הזנב שמוסיף
    // computeDurationSeconds בסוף היצירה, ~2s אחרי) מודד רק רעש-נומרי-שיורי, לא ריוורב אמיתי
    // (זו בדיוק הטעות שגרמה לכישלון-הבדיקה הראשון — "early"/"late" היו שניהם רחוק מדי מ-t=0).
    // התו היבש עצמו (envelope release כולל) שקט לגמרי הרבה לפני 0.5s, אז מ-0.5s זה ריוורב-בלבד.
    const earlyTail = rms(samples, Math.round(0.5 * sampleRate), Math.round(0.8 * sampleRate));
    const lateTail = rms(samples, Math.round(1.5 * sampleRate), Math.round(1.8 * sampleRate));
    expect(earlyTail).toBeGreaterThan(0);
    expect(Number.isFinite(earlyTail)).toBe(true);
    expect(Number.isFinite(lateTail)).toBe(true);
    expect(lateTail).toBeLessThan(earlyTail);
  }, 20000);
});

// ⚠️ בדיקת הדטרמיניזם של אותו אפיק-ריוורב עברה ל-sharedReverbDeterminism.test.ts (קובץ
// משלה) — לא בוטלה. ראה ההסבר שם: היא מריצה שני רינדורים ברצף, וזה מה ש-node-web-audio-api
// לא מחזיק כשבתהליך כבר בוצעו רינדורים קודמים.
