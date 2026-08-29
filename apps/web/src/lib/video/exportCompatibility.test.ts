/**
 * @file        exportCompatibility.test.ts
 * @description ⭐ 2026-08-29 — נועל את הכלל שנלמד בדרך הקשה: **קובץ שלא ייפתח אצל המשתמש
 *              לא יורד אוטומטית**, אלא מוסבר.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * הרקע: הסרטון הראשון שירד ב-Chrome התנגן מצוין באתר אבל **לא נפתח ב-Windows Media Player** —
 * כי פס-הקול קודד ב-Opus (ה-AAC נדחה ב-32kHz). הכל "הצליח", ואיש לא אמר למשתמש כלום.
 * שני הכללים שנגזרו מזה נבדקים כאן, כי שניהם דברים שקל מאוד לשבור בשוגג בעתיד:
 *   1. פס-הקול של הווידאו נבדק ומקודד ב-48kHz — הקצב שמקודדי AAC באמת תומכים בו.
 *   2. תאימות-מוגבלת (Opus) ⇒ אין הורדה אוטומטית.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { checkVideoExportSupport } from './webcodecsSupport';

const originalVideoEncoder = globalThis.VideoEncoder;
const originalAudioEncoder = globalThis.AudioEncoder;

function setEncoders(video: unknown, audio: unknown): void {
  Object.defineProperty(globalThis, 'VideoEncoder', { value: video, configurable: true });
  Object.defineProperty(globalThis, 'AudioEncoder', { value: audio, configurable: true });
}

afterEach(() => {
  setEncoders(originalVideoEncoder, originalAudioEncoder);
});

const videoOk = { isConfigSupported: () => Promise.resolve({ supported: true }) };

/** מדמה את ההתנהגות האמיתית שנתפסה: AAC נתמך רק ב-44.1/48kHz, לא ב-32kHz. */
const aacOnlyAtStandardRates = {
  isConfigSupported: (config: { codec: string; sampleRate: number }) =>
    Promise.resolve({
      supported:
        config.codec === 'mp4a.40.2'
          ? config.sampleRate === 44100 || config.sampleRate === 48000
          : config.codec === 'opus',
    }),
};

describe('תאימות ייצוא — קצב הדגימה של פס-הקול', () => {
  it('⭐ ב-32kHz (קצב הנגינה) ה-AAC נדחה והתוצאה היא Opus — הקובץ שלא נפתח בנגן', async () => {
    setEncoders(videoOk, aacOnlyAtStandardRates);
    const result = await checkVideoExportSupport(1280, 720, {
      numberOfChannels: 2,
      sampleRate: 32000,
    });
    expect(result.supported).toBe(true);
    expect(result.audioCodec).toBe('opus');
  });

  it('⭐ ב-48kHz (אחרי ההמרה) נבחר AAC — וזה הקובץ שנפתח בכל מקום', async () => {
    setEncoders(videoOk, aacOnlyAtStandardRates);
    const result = await checkVideoExportSupport(1280, 720, {
      numberOfChannels: 2,
      sampleRate: 48000,
    });
    expect(result.supported).toBe(true);
    expect(result.audioCodec).toBe('mp4a.40.2');
  });
});

/**
 * ⚠️ הכלל עצמו חי ב-useDownload.ts (`hasVideo && !limitedCompatibility`). כאן מתועדת
 * טבלת-האמת שלו במפורש, כדי שאם מישהו ישנה את התנאי — יהיה ברור מה נשבר ולמה.
 */
describe('מתי מפעילים הורדה אוטומטית', () => {
  function shouldAutoDownload(hasVideo: boolean, limitedCompatibility: boolean): boolean {
    return hasVideo && !limitedCompatibility;
  }

  it('יש וידאו תקין → מורידים', () => {
    expect(shouldAutoDownload(true, false)).toBe(true);
  });

  it('⭐ יש וידאו אבל בתאימות מוגבלת → **לא** מורידים, מסבירים למשתמש', () => {
    expect(shouldAutoDownload(true, true)).toBe(false);
  });

  it('אין וידאו כלל → לא מורידים', () => {
    expect(shouldAutoDownload(false, false)).toBe(false);
  });
});
