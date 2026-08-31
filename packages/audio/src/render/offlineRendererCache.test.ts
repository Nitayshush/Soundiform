/**
 * @file        offlineRendererCache.test.ts
 * @description ⭐ 2026-08-31: רגרסיה למפתח-המטמון של הרינדור.
 *
 *              ⚠️ הבאג שנתפס בבדיקה חיה: המפתח היה `(seed, genreId, audioConfig)`, מתוך הנחה
 *              מתועדת ש"(seed, genreId) קובעים את ה-score במלואו". סבב א' (בורר סולם ומקצב)
 *              שבר את ההנחה — הסולם משנה את התווים **בלי** לשנות את ה-seed. המשתמש החליף
 *              סולם, הלוח התעדכן, והמטמון החזיר את הבאפר הישן: **צליל שגוי**, גם בניגון וגם
 *              בקובץ שהורד. הבדיקה הזו נועלת את התיקון — המפתח נגזר מתוכן ה-score.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **שני רינדורים אמיתיים בלבד בקובץ הזה.** node-web-audio-api אינו יציב כשמצטברים הרבה
 * רינדורים בתהליך אחד (ראה packages/audio/vitest.config.ts) — לכן זה קובץ נפרד ולא תוספת
 * ל-offlineRenderer.test.ts, שכבר מרנדר בעצמו.
 */

import './webAudioPolyfill';
import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@soundiform/core';
import { renderScoreToAudioBufferCached } from './offlineRenderer';
import type { GenreAudioConfig } from './sharedScheduling';

const TICKS_PER_BEAT = 480;

const AUDIO_CONFIG: GenreAudioConfig = {
  synthPresets: {
    lead: {
      oscillatorType: 'sine',
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 },
      polyphonic: true,
    },
  },
  mixCharacter: { reverbDecaySeconds: 0.5, delayTime: '8n', delayFeedback: 0 },
};

/**
 * ⚠️ אותו `seed` ואותו `genreId` בשתי הגרסאות — בדיוק המצב שהמפתח הישן לא הבחין בו.
 * ההבדל היחיד הוא הגבהים, כמו שקורה כשמחליפים סולם.
 */
function makeScore(pitches: readonly number[]): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'same-drawing-different-key',
    tempo: 120,
    timeSignature: [4, 4],
    key: { root: 0, mode: 'aeolian' },
    genreId: 'test',
    durationBars: 1,
    tracks: [
      {
        role: 'lead',
        instrumentId: 'default-lead',
        notes: pitches.map((pitch, index) => ({
          startTick: index * TICKS_PER_BEAT,
          durationTicks: TICKS_PER_BEAT,
          pitch,
          velocity: 0.8,
        })),
        mixSettings: { volume: 1, pan: 0, reverbSend: 0, delaySend: 0 },
      },
    ],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 1 }],
    metadata: { avgNoteDensity: 4, dominantMode: 'aeolian', rootFrequencyHz: 220 },
  };
}

describe('renderScoreToAudioBufferCached — מפתח המטמון', () => {
  // ⚠️ הפונקציה מחזירה עותק רדוד עם דגל `fromCache`, ולכן השוואת-זהות על התוצאה עצמה חסרת
  // משמעות. מה שנבדק הוא החוזה בפועל: הדגל, ו**זהות הבאפר** — הוא מה שבאמת נחסך או מרונדר.
  it('אותו score בדיוק מוחזר מהמטמון, בלי רינדור נוסף', async () => {
    const score = makeScore([60, 62, 64, 65]);
    const first = await renderScoreToAudioBufferCached(score, AUDIO_CONFIG);
    const second = await renderScoreToAudioBufferCached(score, AUDIO_CONFIG);
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.buffer).toBe(first.buffer);
  });

  it('שינוי גבהים באותו seed **לא** מוחזר מהמטמון — זה הבאג של החלפת הסולם', async () => {
    const inC = makeScore([60, 62, 64, 65]);
    const transposed = makeScore([66, 68, 70, 71]);
    const cached = await renderScoreToAudioBufferCached(inC, AUDIO_CONFIG);
    const fresh = await renderScoreToAudioBufferCached(transposed, AUDIO_CONFIG);
    expect(fresh.fromCache).toBe(false);
    expect(fresh.buffer).not.toBe(cached.buffer);
  });
});
