/**
 * @file        SynthProvider.ts
 * @description מימוש InstrumentProvider מבוסס Tone.js — ה-provider הפעיל היחיד ב-V1.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה בחירת סוג הסינתיסייזר תלויה ב-role ולא ב-instrumentId:
 * עדיין אין GenrePack (Sprint 5) עם synthMap אמיתי — instrumentId מגיע מ-harmonyEngine.ts
 * כערך placeholder ('default-lead' וכו'). ה-role (bass/lead/pad/drums/skank) הוא המידע
 * המוזיקלי היחיד שבאמת קיים כרגע כדי לבחור סוג קול סביר.
 */

import { Gain, MembraneSynth, NoiseSynth, PolySynth, Synth } from 'tone';
import type { OutputNode } from 'tone';
import type { Note, TrackRole } from '@shape-sound/core';
import type { InstrumentProvider } from './InstrumentProvider';
import { midiToHz, ticksToSeconds } from '../internal/audioUtils';

type MonoVoice = Synth | MembraneSynth | NoiseSynth;
type ToneVoice = MonoVoice | PolySynth;

function createVoiceForRole(role: TrackRole): ToneVoice {
  switch (role) {
    case 'bass':
      return new Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.3 },
      });
    case 'lead':
      return new Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
      });
    case 'pad':
      return new PolySynth(Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.4, decay: 0.3, sustain: 0.8, release: 1.2 },
      });
    case 'skank':
      // ⚠️ placeholder — Reggae דורש דגימות אמיתיות (§5.2), מוסתר ב-V1 ממילא (requiresSamples).
      return new PolySynth(Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.005, decay: 0.08, sustain: 0.1, release: 0.1 },
      });
    case 'drums':
      // ⚠️ placeholder — דפוסי תופים אמיתיים הם Sprint 5 (GenrePack.rhythmPatterns).
      return new MembraneSynth();
    default: {
      const exhaustiveCheck: never = role;
      throw new Error(`SynthProvider: role לא מוכר ${String(exhaustiveCheck)}`);
    }
  }
}

function isPolySynth(voice: ToneVoice): voice is PolySynth {
  return voice instanceof PolySynth;
}

/**
 * מימוש InstrumentProvider מבוסס Tone.js. `output` הוא Gain יציב שנוצר מיד בבנאי —
 * מותר לחבר אותו ל-mixChain גם לפני load(), כדי לא לתלות סדר-קריאות בין הצדדים.
 */
export class SynthProvider implements InstrumentProvider {
  readonly id: string;
  readonly kind = 'synth' as const;
  readonly output: OutputNode;

  private readonly role: TrackRole;
  private readonly tempoBpm: number;
  private readonly outputGain: Gain;
  private voice: ToneVoice | null = null;

  constructor(role: TrackRole, tempoBpm: number) {
    this.role = role;
    this.tempoBpm = tempoBpm;
    this.id = `synth-${role}`;
    this.outputGain = new Gain(1);
    this.output = this.outputGain;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- load() חייב Promise לפי InstrumentProvider; אין await אמיתי כרגע (V1 בלי SamplerProvider/רשת).
  async load(_instrumentId: string): Promise<void> {
    this.voice = createVoiceForRole(this.role);
    this.voice.connect(this.outputGain);
  }

  playNote(note: Note, time: number): void {
    if (!this.voice) {
      throw new Error(`SynthProvider(${this.role}): playNote נקרא לפני load()`);
    }
    const frequencyHz = midiToHz(note.pitch);
    const durationSeconds = ticksToSeconds(note.durationTicks, this.tempoBpm);

    if (isPolySynth(this.voice)) {
      this.voice.triggerAttackRelease(frequencyHz, durationSeconds, time, note.velocity);
    } else if (this.voice instanceof NoiseSynth) {
      this.voice.triggerAttackRelease(durationSeconds, time, note.velocity);
    } else {
      this.voice.triggerAttackRelease(frequencyHz, durationSeconds, time, note.velocity);
    }
  }

  dispose(): void {
    this.voice?.dispose();
    this.outputGain.dispose();
  }
}
