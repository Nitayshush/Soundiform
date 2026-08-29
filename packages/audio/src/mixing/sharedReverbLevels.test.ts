/**
 * @file        sharedReverbLevels.test.ts
 * @description ⭐ רגרסיות-רמה/יציבות לאפיק-הריוורב המשותף (sharedReverb.ts) — שתיהן דורשות
 *              רינדור PCM כבד, ולכן הופרדו מ-sharedReverb.test.ts.
 * @author      Soundiform
 *
 * ⚠️ 2026-08-29 — למה קובץ נפרד ולא עוד describe ב-sharedReverb.test.ts: node-web-audio-api
 * (התוסף הנייטיב שמריץ את הרינדורים בבדיקות) לא יציב כשתהליך אחד מבצע הרבה רינדורים —
 * נמדד: קובץ עם 3 רינדורים עובר 5/5 הרצות, קובץ עם 6 רינדורים נופל בכ-50% מההרצות
 * ("Worker exited unexpectedly"). vitest מבודד תהליך לכל *קובץ*, אז פיצול ל-2 קבצים עם 3
 * רינדורים כל אחד הוא מה שהופך את החבילה הזו ליציבה. ⚠️ לא להוסיף כאן בדיקות-רינדור נוספות
 * בלי לבדוק יציבות בכמה הרצות — עדיף קובץ שלישי.
 *
 * ⚠️ ה-import של webAudioPolyfill חייב להיות ראשון — ראה ההסבר ב-sharedReverb.test.ts.
 */

import '../render/webAudioPolyfill';
import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@soundiform/core';
import { TICKS_PER_BEAT } from '@soundiform/core';
import { renderScoreToAudioBuffer } from '../render/offlineRenderer';
import type { GenreAudioConfig } from '../render/sharedScheduling';

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

/**
 * ⭐ 2026-08-28 — רגרסיה על באגי-רמות/יציבות אמיתיים שנתפסו תוך-כדי-פיתוח, בגרסת-ביניים
 * שניסתה ריוורב-אלגוריתמי (comb-filter feedback bank) במקום קונבולוציה. אימפולס בודד לא
 * חשף כלום; כמה טראקים ביחד (הבדיקה הזו) חשף maxAbs עד 36.7(!); ורק בדיקת-ריצה-ארוכה
 * (הבדיקה הבאה למטה) חשפה חוסר-יציבות-לאורך-זמן אמיתי (שריקה-הולכת-ומתחזקת אחרי ~15
 * שניות ניגון-בלולאה). התוצאה הסופית: חזרה לקונבולוציה (deterministicReverb.ts) — יציבה
 * מתמטית מבנייה (אין לה בכלל לולאת-משוב), ראה ההערה המלאה ב-sharedReverb.ts. שתי הבדיקות
 * האלה נשארות כרגרסיה — לשמור על בטיחות-רמות גם אם מישהו ינסה שוב עיצוב-ריוורב חלופי.
 */
describe('sharedReverb — רגרסיה: כמה טראקים ביחד + decaySeconds שונים לא חורגים מ-±1', () => {
  function makeMultiTrackScore(): MusicalScore {
    return {
      version: '1.0.0',
      seed: 'shared-reverb-multi-track-regression',
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
            startTick: index * 120,
            durationTicks: 100,
            pitch: 60 + (index % 5),
            velocity: 0.8,
          })),
          mixSettings: { volume: 0.78, pan: 0, reverbSend: 0.2, delaySend: 0.15 },
        },
        {
          role: 'pad',
          instrumentId: 'test-pad',
          notes: [48, 55, 60].flatMap((pitch) => [
            { startTick: 0, durationTicks: 1920, pitch, velocity: 0.5 },
            { startTick: 1920, durationTicks: 1920, pitch: pitch + 2, velocity: 0.5 },
          ]),
          mixSettings: { volume: 0.4, pan: 0, reverbSend: 0.3, delaySend: 0.1 },
        },
      ],
      sections: [{ name: 'loop', startBar: 0, lengthBars: 2 }],
      metadata: { avgNoteDensity: 5, dominantMode: 'aeolian', rootFrequencyHz: 220 },
    };
  }

  function maxAbsAmplitude(channel: Float32Array): number {
    let peak = 0;
    for (const sample of channel) {
      peak = Math.max(peak, Math.abs(sample));
    }
    return peak;
  }

  it.each([1.5, 5])(
    'decaySeconds=%s: פסגת-האמפליטודה לא חורגת מ-1 (בטוח, לא קליפינג)',
    async (decaySeconds) => {
      const config: GenreAudioConfig = {
        synthPresets: {},
        mixCharacter: { reverbDecaySeconds: decaySeconds, delayTime: '8n', delayFeedback: 0.3 },
        sidechainEnabled: true,
      };
      const rendered = await renderChannels(makeMultiTrackScore(), config);
      for (const channel of rendered.channels) {
        const peak = maxAbsAmplitude(channel);
        expect(Number.isFinite(peak)).toBe(true);
        expect(peak).toBeLessThanOrEqual(1);
      }
    },
    20000,
  );
});

/**
 * ⭐ 2026-08-28 — הרגרסיה הכי-חשובה בקובץ הזה: הבאג האמיתי שהמשתמש שמע בנייד (שריקה-הולכת-
 * ומתחזקת) **לא** נחשף באף אחת מהבדיקות למעלה — כולן קצרות (≤5s reverb tail על score של
 * שנייה-שתיים). הוא נחשף רק בסקריפט-אבחון ידני שסימלץ ~76 שניות/20 חזרות-לולאה של ניגון
 * רציף עם כמה טראקים שולחים ריוורב — בדיוק התרחיש האמיתי בנייד (browserRenderer.ts קובע
 * `transport.loop=true`, אז ניגון-חי חוזר על עצמו הרבה יותר זמן מכל בדיקת-רינדור קצרה).
 * הבדיקה הזו משחזרת את אותו תרחיש בתור score-אחד-ארוך-ורציף (במקום לולאה ממשית — serverRenderer
 * ממילא לא תומך ב-loop, ראה browserRenderer.ts vs serverRenderer.ts), כדי לתפוס לצמיתות כל
 * עיצוב-ריוורב עתידי מבוסס-לולאת-משוב (comb-filter/feedback delay) שיציג את אותה חוסר-יציבות-
 * לאורך-זמן — קונבולוציה (המימוש הנוכחי) אין לה בכלל לולאת-משוב, אז אמורה לעבור תמיד בנוחות.
 */
describe('sharedReverb — רגרסיה: יציבות-לאורך-זמן (הבאג שנחשף רק בניגון ארוך/בלולאה)', () => {
  const BARS_PER_SECOND_AT_128BPM = 128 / (4 * 60); // 4/4 בקצב 128bpm
  /**
   * ⚠️ 2026-08-29: ירד מ-76 ל-40 שניות. הסיבה **אינה** ויתור על כיסוי — אלא שרינדור של 76
   * שניות דחוסות הפיל את תהליך-העובד של vitest באופן לא-דטרמיניסטי (Worker exited
   * unexpectedly, כ-50% מההרצות; node-web-audio-api הוא תוסף נייטיב ולא עומד בעומס-הזיכרון
   * הזה בצורה יציבה). בדיקה שנופלת חצי מהפעמים גרועה מבדיקה קצרה יותר.
   * 40 שניות עדיין מכסות את הבאג המקורי בביטחון: אי-היציבות של ה-comb-filter התחילה
   * להתבדר אחרי ~15 שניות והפסגה כבר הייתה גדולה פי-כמה עד 40 — הרבה מעל סף הבדיקה למטה.
   */
  const TARGET_SECONDS = 40;
  const DURATION_BARS = Math.ceil(TARGET_SECONDS * BARS_PER_SECOND_AT_128BPM);
  const SIXTEENTH_TICKS = TICKS_PER_BEAT / 4;
  const TICKS_PER_BAR = TICKS_PER_BEAT * 4;

  function makeLongContinuousScore(): MusicalScore {
    const leadNotes = Array.from({ length: DURATION_BARS * 16 }, (_, index) => ({
      startTick: index * SIXTEENTH_TICKS,
      durationTicks: Math.round(SIXTEENTH_TICKS * 0.8),
      pitch: 60 + (index % 5),
      velocity: 0.8,
    }));
    const padNotes = Array.from({ length: DURATION_BARS }, (_, bar) =>
      [48, 55, 60].map((pitch) => ({
        startTick: bar * TICKS_PER_BAR,
        durationTicks: TICKS_PER_BAR,
        pitch: bar % 2 === 0 ? pitch : pitch + 2,
        velocity: 0.5,
      })),
    ).flat();

    return {
      version: '1.0.0',
      seed: 'shared-reverb-long-duration-regression',
      tempo: 128,
      timeSignature: [4, 4],
      key: { root: 0, mode: 'aeolian' },
      genreId: 'test',
      durationBars: DURATION_BARS,
      tracks: [
        {
          role: 'lead',
          instrumentId: 'test-lead',
          notes: leadNotes,
          mixSettings: { volume: 0.78, pan: 0, reverbSend: 0.2, delaySend: 0.15 },
        },
        {
          role: 'pad',
          instrumentId: 'test-pad',
          notes: padNotes,
          mixSettings: { volume: 0.4, pan: 0, reverbSend: 0.3, delaySend: 0.1 },
        },
      ],
      sections: [{ name: 'loop', startBar: 0, lengthBars: DURATION_BARS }],
      metadata: { avgNoteDensity: 5, dominantMode: 'aeolian', rootFrequencyHz: 220 },
    };
  }

  function windowedPeaks(
    channel: Float32Array,
    sampleRate: number,
    windowSeconds: number,
  ): number[] {
    const windowSamples = Math.round(windowSeconds * sampleRate);
    const peaks: number[] = [];
    for (let start = 0; start < channel.length; start += windowSamples) {
      const end = Math.min(channel.length, start + windowSamples);
      let peak = 0;
      for (let index = start; index < end; index += 1) {
        peak = Math.max(peak, Math.abs(channel[index] ?? 0));
      }
      peaks.push(peak);
    }
    return peaks;
  }

  it(`~${String(TARGET_SECONDS)}s של ניגון רציף (${String(DURATION_BARS)} בארים, כמה טראקים שולחים ריוורב) לא בונה-מומנטום: הפסגה לא גדלה עם הזמן ולא חורגת מ-1`, async () => {
    const config: GenreAudioConfig = {
      synthPresets: {},
      mixCharacter: { reverbDecaySeconds: 2, delayTime: '8n', delayFeedback: 0.3 },
      sidechainEnabled: true,
    };
    // ⚠️ 2026-08-29: הבדיקה הזו משתמשת ב-offlineRenderer (מסלול-הדפדפן) ולא ב-renderToBuffer
    // (מסלול-השרת) משתי סיבות ממשיות: (א) renderToBuffer קורא ל-setContext ו**לא** משחזר,
    // כך שכל רינדור משאיר OfflineContext נטוש — בבדיקה הכי-כבדה בקובץ ההצטברות הזו הפילה את
    // תהליך-העובד של vitest באופן לא-דטרמיניסטי; Tone.Offline משחזר את ה-context בעצמו.
    // (ב) זה גם *נכון יותר*: הבאג המקורי (שריקה מתגברת) נשמע בדפדפן, וזה בדיוק המסלול שרץ שם.
    const rendered = await renderScoreToAudioBuffer(makeLongContinuousScore(), config);
    const samples = rendered.buffer.getChannelData(0);

    let overallPeak = 0;
    for (const sample of samples) {
      overallPeak = Math.max(overallPeak, Math.abs(sample));
    }
    expect(Number.isFinite(overallPeak)).toBe(true);
    expect(overallPeak).toBeLessThanOrEqual(1);

    // ⚠️ הבדיקה האמיתית נגד "שריקה-הולכת-ומתחזקת": מחלקים את היצירה לחלונות של 5 שניות
    // ומוודאים שהפסגה בחלונות המאוחרים לא גדולה בהרבה מהפסגה בחלונות המוקדמים — בבאג
    // המקורי היחס היה פי ~30 (0.17→5.64), אז סף של פי 3 תופס את התופעה בלי להיות שביר
    // מדי מול שינויי-תוכן-מוזיקלי טבעיים (velocity/מבנה-אקורדים).
    const peaks = windowedPeaks(samples, rendered.buffer.sampleRate, 5);
    const earlyPeak = Math.max(...peaks.slice(0, 3));
    const latePeak = Math.max(...peaks.slice(-3));
    expect(latePeak).toBeLessThanOrEqual(earlyPeak * 3 + 0.05);
  }, 60000);
});
