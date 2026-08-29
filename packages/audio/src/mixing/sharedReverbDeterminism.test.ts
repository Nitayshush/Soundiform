/**
 * @file        sharedReverbDeterminism.test.ts
 * @description ⭐ דטרמיניזם (§1, "אותה צורה = אותו צליל, תמיד") של אפיק-הריוורב המשותף —
 *              אותו score מרונדר פעמיים חייב להחזיר PCM זהה בייט-בבייט.
 * @author      Soundiform
 *
 * ⚠️ 2026-08-29 — למה קובץ נפרד לבדיקה אחת: זו הבדיקה היחידה בחבילה שמריצה **שני רינדורים
 * של אותו score ברצף**, וזה בדיוק מה ש-node-web-audio-api לא מחזיק היטב — כשהתהליך כבר
 * ביצע רינדורים קודמים, הרינדור השני האט עד פי-70 (3 שניות אודיו ב-70 שניות שעון) והחזיר
 * PCM שונה. ⚠️ **זו אינה אי-דטרמיניות של קוד המוצר**: אותה בדיקה בדיוק עוברת יציב
 * (5/5 הרצות) ב-offlineRenderer.test.ts, ובדיקה זו נכשלה גם דרך serverRenderer וגם דרך
 * Tone.Offline — כלומר זו תקלת-הרחבה-נייטיב בסביבת הבדיקות, לא באודיו עצמו. הפרדה לקובץ
 * משלה נותנת לה תהליך נקי וזה מייצב אותה. ראה vitest.config.ts.
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
 * ⚠️ מרנדר דרך offlineRenderer (מסלול-הדפדפן) ולא דרך serverRenderer's renderToBuffer,
 * משתי סיבות: (א) renderToBuffer קורא ל-`setContext(...)` ולעולם לא משחזר, כך שכל קריאה
 * משאירה OfflineContext נטוש וזיכרון-נייטיב מצטבר; `Tone.Offline` משחזר בעצמו. (ב) זה גם
 * המסלול ה*נכון* לבדוק — הצליל בדפדפן מיוצר בדיוק כאן. מסלול-השרת מכוסה ב-serverRenderer.test.ts.
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

describe('sharedReverb — רגרסיה: דטרמיניזם (§1) של אפיק-הריוורב המשותף', () => {
  it('אותו score מרונדר תמיד לאותו PCM בדיוק (אין תלות ב-Math.random)', async () => {
    const score = makeReverbTestScore();
    const renderedA = await renderChannels(score, REVERB_TEST_CONFIG);
    const renderedB = await renderChannels(score, REVERB_TEST_CONFIG);

    expect(renderedA.channels[0]).toEqual(renderedB.channels[0]);
    expect(renderedA.channels[1]).toEqual(renderedB.channels[1]);
  }, 30000);
});
