/**
 * @file        SynthProvider.ts
 * @description מימוש InstrumentProvider מבוסס Tone.js — ה-provider הפעיל היחיד ב-V1.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⭐ Sprint 5: סוג הקול נגזר מ-SynthPresetConfig (מגיע מ-GenrePack.synthMap, §5.1) — לא מ-role
 * קשיח כמו קודם. packages/audio לא יכול לייבא GenrePack ישירות (§3: audio → core, shared
 * בלבד) — apps/web הוא זה שממיר GenrePack.synthMap[role] ל-SynthPresetConfig ומעביר לכאן.
 * אם לא סופק preset מפורש, נופלים לברירת מחדל סבירה (DEFAULT_SYNTH_PRESET).
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { Gain, PolySynth, Synth } from 'tone';
import type { OutputNode } from 'tone';
import type { Note, TrackRole } from '@soundiform/core';
import type { InstrumentProvider } from './InstrumentProvider';
import { midiToHz, ticksToSeconds } from '../internal/audioUtils';

export type OscillatorType = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface SynthEnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface SynthPresetConfig {
  oscillatorType: OscillatorType;
  envelope: SynthEnvelopeConfig;
  /** האם הקול הזה מתנגן פוליפונית (טריאדה בו-זמנית) — בדרך כלל true ל-pad/skank. */
  polyphonic: boolean;
}

// ⚠️ polyphonic: true בכוונה — זו ברירת המחדל שחלה על *כל* role שחסר ב-GenrePack.synthMap
// (z.partialRecord, ראה DECISIONS.md). buildPadTrack (harmonyEngine.ts) מייצר תמיד טריאדות —
// כמה תווים באותו startTick על אותו track — ו-Synth מונופוני זורק "Start time must be
// strictly greater than previous start time" ברגע שני התווים הבו-זמניים. PolySynth מנגן
// גם קווים חד-קוליים (bass/lead) נכון לחלוטין, כך שאין חיסרון שמיעתי בברירת מחדל פוליפונית.
export const DEFAULT_SYNTH_PRESET: SynthPresetConfig = {
  oscillatorType: 'triangle',
  envelope: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.3 },
  polyphonic: true,
};

type ToneVoice = Synth | PolySynth;

/** 'fat' == כמה קולות unison מוסטים-detuning זה מזה — טריק עיצוב-סאונד סטנדרטי לגוון "גדול"
 * יותר מגל בודד, בלי דגימות/תלות חדשה (Tone.js תומך בזה built-in). count/spread שמרניים
 * בכוונה כדי שזה יתחזק את הגוון בלי להישמע כמו chorus-effect מוגזם, גם בפגיעות תופים קצרות. */
const FAT_OSCILLATOR_TYPE: Record<OscillatorType, `fat${OscillatorType}`> = {
  sine: 'fatsine',
  triangle: 'fattriangle',
  sawtooth: 'fatsawtooth',
  square: 'fatsquare',
};
const FAT_UNISON_COUNT = 3;
const FAT_UNISON_SPREAD_CENTS = 18;

function createVoice(preset: SynthPresetConfig): ToneVoice {
  const voiceOptions = {
    oscillator: {
      type: FAT_OSCILLATOR_TYPE[preset.oscillatorType],
      count: FAT_UNISON_COUNT,
      spread: FAT_UNISON_SPREAD_CENTS,
    },
    envelope: preset.envelope,
  };
  return preset.polyphonic ? new PolySynth(Synth, voiceOptions) : new Synth(voiceOptions);
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
  private readonly preset: SynthPresetConfig;
  private readonly outputGain: Gain;
  private voice: ToneVoice | null = null;

  constructor(role: TrackRole, tempoBpm: number, preset: SynthPresetConfig = DEFAULT_SYNTH_PRESET) {
    this.role = role;
    this.tempoBpm = tempoBpm;
    this.preset = preset;
    this.id = `synth-${role}`;
    this.outputGain = new Gain(1);
    this.output = this.outputGain;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- load() חייב Promise לפי InstrumentProvider; אין await אמיתי כרגע (V1 בלי SamplerProvider/רשת).
  async load(_instrumentId: string): Promise<void> {
    this.voice = createVoice(this.preset);
    this.voice.connect(this.outputGain);
  }

  playNote(note: Note, time: number): void {
    if (!this.voice) {
      throw new Error(`SynthProvider(${this.role}): playNote נקרא לפני load()`);
    }
    const frequencyHz = midiToHz(note.pitch);
    const durationSeconds = ticksToSeconds(note.durationTicks, this.tempoBpm);
    this.voice.triggerAttackRelease(frequencyHz, durationSeconds, time, note.velocity);
  }

  dispose(): void {
    this.voice?.dispose();
    this.outputGain.dispose();
  }
}
