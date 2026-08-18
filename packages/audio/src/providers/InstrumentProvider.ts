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
import type { OutputNode } from 'tone';

export interface InstrumentProvider {
  readonly id: string;
  readonly kind: 'synth' | 'sampler';
  /**
   * ⭐ נוסף ב-Sprint 4: נקודת החיבור למיקסינג (mixChain.ts). קיים תמיד (גם לפני load()) —
   * זו נקודת חיבור Tone.js, לא ידע על שיטת הסינתזה, ולכן לא עובר על ה"חוק ברזל" שלמעלה.
   */
  readonly output: OutputNode;
  load(instrumentId: string): Promise<void>;
  playNote(note: Note, time: number): void;
  dispose(): void;
}
