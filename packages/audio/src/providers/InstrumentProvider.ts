/**
 * @file        InstrumentProvider.ts
 * @description ⭐ ההפשטה שמאפשרת דגימות — ראה PROJECT.md §4.7.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ חוק ברזל:
 * המנוע המוזיקלי לעולם לא יודע אם מאחוריו סינתסייזר או דגימה.
 * אם מופיעה בקוד המוזיקלי שורה עם 'oscillator' או 'waveform' — עברת על ההפשטה. עצור ותקן.
 *
 * V1: SynthProvider בלבד (Tone.js).
 * V2: SamplerProvider נכנס בלי לגעת ב-core.
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { Note } from '@shape-sound/core';

export interface InstrumentProvider {
  readonly id: string;
  readonly kind: 'synth' | 'sampler';
  load(instrumentId: string): Promise<void>;
  playNote(note: Note, time: number): void;
  dispose(): void;
}
