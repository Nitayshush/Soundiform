/**
 * @file        audioUtils.ts
 * @description המרות בסיסיות בין ה-domain המוזיקלי (MIDI, ticks) לבין ה-domain של Tone.js
 *              (הרץ, שניות). לא מיוצא מ-index.ts — פנימי בלבד.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { TICKS_PER_BEAT } from '@shape-sound/core';

export function midiToHz(midiPitch: number): number {
  return 440 * Math.pow(2, (midiPitch - 69) / 12);
}

export function ticksToSeconds(ticks: number, tempoBpm: number): number {
  const secondsPerBeat = 60 / tempoBpm;
  return (ticks / TICKS_PER_BEAT) * secondsPerBeat;
}
