/**
 * @file        webcodecsSupport.test.ts
 * @description ⭐ 2026-08-29: הבדיקה הזו שומרת על **השער** של כל מסלול ההורדה-במכשיר.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * אם הזיהוי יחזיר "נתמך" בטעות במכשיר שלא באמת תומך, המשתמש יקבל שגיאה במקום הודעה
 * מסודרת + יצירה שמורה. ואם יחזיר "לא נתמך" בטעות, כולם יאבדו את הווידאו בלי סיבה.
 * שני הכיוונים נבדקים כאן, כולל המקרה שבו הדפדפן **זורק** במקום להחזיר false.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkVideoExportSupport, h264CodecFor } from './webcodecsSupport';

const originalVideoEncoder = globalThis.VideoEncoder;
const originalAudioEncoder = globalThis.AudioEncoder;

function setEncoders(video: unknown, audio: unknown): void {
  Object.defineProperty(globalThis, 'VideoEncoder', { value: video, configurable: true });
  Object.defineProperty(globalThis, 'AudioEncoder', { value: audio, configurable: true });
}

afterEach(() => {
  setEncoders(originalVideoEncoder, originalAudioEncoder);
  vi.restoreAllMocks();
});

const supported = { isConfigSupported: () => Promise.resolve({ supported: true }) };
const unsupported = { isConfigSupported: () => Promise.resolve({ supported: false }) };

/** מדמה דפדפן שמקודד רק חלק מהקודקים — בדיוק המצב של Firefox מול AAC. */
function audioEncoderSupporting(codecs: readonly string[]) {
  return {
    isConfigSupported: (config: { codec: string }) =>
      Promise.resolve({ supported: codecs.includes(config.codec) }),
  };
}

describe('h264CodecFor — רמת-פרופיל לפי רזולוציה', () => {
  it('720p מקבל Baseline, ומעל זה High (1080p דורש רמה גבוהה יותר)', () => {
    expect(h264CodecFor(1280, 720)).toBe('avc1.42001f');
    expect(h264CodecFor(1920, 1080)).toBe('avc1.640028');
  });
});

describe('checkVideoExportSupport', () => {
  it('מדווח נתמך ובוחר AAC כשהוא זמין (מועדף — תאימות ניגון רחבה)', async () => {
    setEncoders(supported, supported);
    const result = await checkVideoExportSupport(1280, 720);
    expect(result.supported).toBe(true);
    expect(result.audioCodec).toBe('mp4a.40.2');
  });

  /**
   * ⭐ נתפס בבדיקה חיה ב-Firefox 154: הוא מקודד H.264 מצוין (720p ו-1080p, 1.77x מזמן-אמת)
   * אבל **לא מקודד AAC** — ולכן כל הייצוא נפל אצלו למרות שהווידאו נתמך לחלוטין.
   */
  it('⭐ Firefox: אין AAC אבל יש Opus — נתמך, ולא נופל', async () => {
    setEncoders(supported, audioEncoderSupporting(['opus']));
    const result = await checkVideoExportSupport(1280, 720);
    expect(result.supported).toBe(true);
    expect(result.audioCodec).toBe('opus');
  });

  it('לא נתמך כשאין אף קודק אודיו — אין טעם בווידאו בלי פס-קול', async () => {
    setEncoders(supported, audioEncoderSupporting([]));
    const result = await checkVideoExportSupport(1280, 720);
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('audio');
  });

  it('לא נתמך כש-VideoEncoder לא קיים בכלל (הדפדפן הישן)', async () => {
    setEncoders(undefined, supported);
    const result = await checkVideoExportSupport(1280, 720);
    expect(result.supported).toBe(false);
  });

  it('לא נתמך כש-AudioEncoder חסר לגמרי', async () => {
    setEncoders(supported, undefined);
    const result = await checkVideoExportSupport(1280, 720);
    expect(result.supported).toBe(false);
  });

  it('⚠️ ה-API קיים אבל הקונפיג עצמו לא נתמך — חייב להיחשב לא-נתמך', async () => {
    setEncoders(unsupported, supported);
    const result = await checkVideoExportSupport(1920, 1080);
    expect(result.supported).toBe(false);
  });

  it('⚠️ דפדפן שזורק במקום להחזיר false מטופל כמו "לא נתמך", לא מפיל את ההורדה', async () => {
    setEncoders(
      {
        isConfigSupported: () => {
          throw new Error('not implemented');
        },
      },
      supported,
    );
    const result = await checkVideoExportSupport(1280, 720);
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('not implemented');
  });
});
