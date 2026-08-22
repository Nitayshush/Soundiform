/**
 * @file        sidechain.ts
 * @description ⭐ 2026-08-22: סיידצ'יין קומפרשן — חתימת ה-trance/house (supersaw+pumping).
 *              ראה PROJECT.md §5.2. היה stub ריק מאז Sprint 4 (TODO), עכשיו מומש.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ למה scheduled Gain-envelope ולא Tone.Compressor+Follower אמיתי: אין כאן ניתוח אודיו
 * חי של הקיק (הכל דטרמיניסטי מ-MusicalScore הסימבולי, §1) — התזמון המדויק של כל פגיעת-קיק
 * כבר ידוע מראש (drums track's notes). "מדמים" sidechain אמיתי על ידי תזמון ישיר של gain dip
 * בכל פגיעה (Tone.Part, אותה טכניקה שכל שאר sharedScheduling.ts משתמש בה) — פשוט יותר,
 * זול יותר, ודטרמיניסטי לחלוטין (לא תלוי בניתוח-אודיו בזמן אמת).
 */

import { Gain, Part } from 'tone';
import type { Note } from '@soundiform/core';
import { ticksToSeconds } from '../internal/audioUtils';

const DUCK_DEPTH = 0.35;
const DUCK_RELEASE_SECONDS = 0.15;

export interface SidechainDuck {
  /** מכניסים בין panner ל-outputGain של כל טראק שצריך "להידחק" (לא של ה-drums עצמו). */
  readonly gain: Gain;
  dispose(): void;
}

/**
 * בונה gain node משותף ש"שוקע" (duck) בכל פגיעת-קיק ומתאושש (release) לפני הפגיעה הבאה —
 * חיבור אותו טראק אחד ליותר מטראק (panner→duck→outputGain של כל טראק) מדמה sidechain אמיתי,
 * כי כל הטראקים חולקים את אותה מעטפת-דיכוי בו-זמנית.
 */
export function createSidechainDuck(kickNotes: readonly Note[], tempoBpm: number): SidechainDuck {
  const duckGain = new Gain(1);
  const events = kickNotes.map((note) => ({ time: ticksToSeconds(note.startTick, tempoBpm) }));
  const part = new Part<{ time: number }>((time) => {
    duckGain.gain.cancelScheduledValues(time);
    duckGain.gain.setValueAtTime(DUCK_DEPTH, time);
    duckGain.gain.exponentialRampToValueAtTime(1, time + DUCK_RELEASE_SECONDS);
  }, events);
  part.start(0);

  return {
    gain: duckGain,
    dispose: () => {
      part.dispose();
      duckGain.dispose();
    },
  };
}
