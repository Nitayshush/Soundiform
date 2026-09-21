/**
 * @file        sidechain.test.ts
 * @description ⭐ 2026-09-20: רגרסיה לבאג-סיכום-האודיו של הסיידצ'יין (ראה sidechain.ts).
 *
 *              ⚠️ הבאג: `createSidechainDuck` החזיר צומת-Gain **משותף אחד** (`.gain`),
 *              ו-mixChain.ts מחבר את האודיו של כל טראק *לתוך* הצומת הזה. חיבור כמה מקורות
 *              שונים לאותה כניסת-Gain מסכם אותם שם בפועל ב-Web Audio — כלומר כל טראק שחלק
 *              duck קיבל גם את האודיו המסוכם של כל הטראקים האחרים, לא רק מעטפת-עוצמה
 *              משותפת. זו בדיוק הסיבה ל"רעשי הרקע" שדווחו בבס. התיקון: `createTrackGain()` —
 *              צומת נפרד לכל טראק, כולם מקבלים את אותה אוטומציה מ-Part משותף אחד.
 * @author      Soundiform
 * @created     2026-09-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בדיקה מבנית טהורה — בלי רינדור אודיו כלל (ראה vitest.config.ts: רינדורים מקבילים לא
 * יציבים ב-node-web-audio-api), בדיוק כמו sidechainTrigger.test.ts.
 *
 * ⚠️ ה-import של webAudioPolyfill חייב להיות **ראשון**: יצירת Tone.Part (בתוך
 * createSidechainDuck) דורשת Tone-context פעיל, ו-standardized-audio-context קורא את
 * window.OfflineAudioContext/AudioContext פעם אחת בזמן ה-import הראשון של 'tone' — ראה
 * webAudioPolyfill.ts. ⚠️ בלי setContext(OfflineContext)+transport.bpm מפורשים (בדיוק כמו
 * serverRenderer.ts) `new Part(...)` נכשל על bpm לא-מוגדר — אין context פעיל כברירת-מחדל.
 */

import '../render/webAudioPolyfill';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getContext, getTransport, OfflineContext, setContext } from 'tone';
import { createSidechainDuck } from './sidechain';

function note(startTick: number) {
  return { startTick, durationTicks: 120, pitch: 40, velocity: 0.9, drumPiece: 'kick' as const };
}

describe('createSidechainDuck — כל טראק מקבל צומת-Gain נפרד, לא משותף', () => {
  let previousContext: ReturnType<typeof getContext>;

  beforeEach(() => {
    previousContext = getContext();
    setContext(new OfflineContext(2, 1, 44100));
    getTransport().bpm.value = 120;
  });

  afterEach(() => {
    setContext(previousContext);
  });

  it('שתי קריאות ל-createTrackGain מחזירות שני צמתים שונים (לא אותו אובייקט)', () => {
    const duck = createSidechainDuck([note(0), note(960)], 120);
    const trackGainA = duck.createTrackGain();
    const trackGainB = duck.createTrackGain();
    expect(trackGainA).not.toBe(trackGainB);
    duck.dispose();
  });

  it('אין יותר שדה gain משותף על ה-handle — רק createTrackGain', () => {
    const duck = createSidechainDuck([note(0)], 120);
    expect('gain' in duck).toBe(false);
    expect(typeof duck.createTrackGain).toBe('function');
    duck.dispose();
  });

  it('כל צומת שנוצר מתחיל ב-gain=1 (לא דחוק) — הדחיקה קורית רק בפגיעת-קיק בפועל', () => {
    const duck = createSidechainDuck([note(1920)], 120);
    const trackGain = duck.createTrackGain();
    expect(trackGain.gain.value).toBe(1);
    duck.dispose();
  });

  it('dispose לא זורק גם בלי אף טראק שנוצר (Set ריק)', () => {
    const duck = createSidechainDuck([note(0)], 120);
    expect(() => {
      duck.dispose();
    }).not.toThrow();
  });

  it('dispose לא זורק אחרי כמה createTrackGain', () => {
    const duck = createSidechainDuck([note(0), note(480), note(960)], 120);
    duck.createTrackGain();
    duck.createTrackGain();
    duck.createTrackGain();
    expect(() => {
      duck.dispose();
    }).not.toThrow();
  });
});
