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
 * ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 2): תמיכה בפריסטים רב-שכבתיים (preset.layers) —
 * supersaw אמיתי (כמה שכבות saw מוסטות) ו-bass layering (סאב+אופי) דורשים כמה קולות Tone.js
 * שמתנגנים בו-זמנית לכל תו, לא רק unison "fat" בתוך קול יחיד. כל שכבה היא ToneVoice+Gain
 * (+פילטר/דיסטורשן אופציונליים) משלה, כולן מסתכמות לפני הפילטר/output ברמת-הפריסט. פריסט
 * חד-שכבתי (הרוב, ללא preset.layers) ממשיך לעבוד בדיוק כמו קודם — resolveLayers הופך אותו
 * ל"שכבה אחת מרומזת" עם gain=1, כדי שלא יהיו שני נתיבי-קוד מקבילים.
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { Distortion, Filter, Gain, PolySynth, Synth } from 'tone';
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

/** ⭐ 2026-08-22: פילטר אופציונלי לפי-קול — genre-configurable (§11 item 5). */
export interface SynthFilterConfig {
  type: 'lowpass' | 'highpass';
  frequencyHz: number;
  /** Q — תהודה. אופציונלי, ברירת מחדל של Tone.Filter אם לא סופק. */
  resonance?: number;
}

/** ⭐ 2026-08-22: רוחב ה-unison "fat" לפי-קול — ראה FAT_UNISON_COUNT/SPREAD למטה להסבר הטכניקה. */
export interface SynthUnisonConfig {
  count: number;
  spreadCents: number;
}

/**
 * ⭐ 2026-08-24 (Area 2): שכבת-קול בודדת בתוך פריסט רב-שכבתי — ראה תיעוד הקובץ למעלה.
 */
export interface SynthLayerConfig {
  oscillatorType: OscillatorType;
  envelope: SynthEnvelopeConfig;
  /** עוצמת השכבה יחסית (0-1) — לא volume מוחלט. */
  gain: number;
  /** הסטת-פיץ' לשכבה בחצאי-טונים (למשל -12 לסאב אוקטבה מתחת). */
  detuneSemitones?: number;
  filter?: SynthFilterConfig;
  unison?: SynthUnisonConfig;
  /** עיוות/סטורציה לשכבה הזו בלבד (0=בלי) — ראה mixing/distortion.ts. */
  driveAmount?: number;
}

export interface SynthPresetConfig {
  oscillatorType: OscillatorType;
  envelope: SynthEnvelopeConfig;
  /** האם הקול הזה מתנגן פוליפונית (טריאדה בו-זמנית) — בדרך כלל true ל-pad/skank. */
  polyphonic: boolean;
  /** ⭐ 2026-08-22: undefined = בלי פילטר (ברירת המחדל ההיסטורית). */
  filter?: SynthFilterConfig;
  /** ⭐ 2026-08-22: undefined = נופל ל-FAT_UNISON_COUNT/SPREAD הגלובליים (ברירת מחדל ישנה). */
  unison?: SynthUnisonConfig;
  /** ⭐ 2026-08-24: כשמוגדר ולא ריק — מחליף את oscillatorType/envelope/filter/unison שלמעלה. */
  layers?: SynthLayerConfig[];
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

/** פריסט חד-שכבתי (הרוב) הופך ל"שכבה אחת מרומזת" — נתיב-קוד יחיד ל-createVoice/playNote/dispose. */
function resolveLayers(preset: SynthPresetConfig): SynthLayerConfig[] {
  if (preset.layers && preset.layers.length > 0) {
    return preset.layers;
  }
  return [
    {
      oscillatorType: preset.oscillatorType,
      envelope: preset.envelope,
      gain: 1,
      ...(preset.filter && { filter: preset.filter }),
      ...(preset.unison && { unison: preset.unison }),
    },
  ];
}

function createToneVoice(layer: SynthLayerConfig, polyphonic: boolean): ToneVoice {
  const unison = layer.unison ?? { count: FAT_UNISON_COUNT, spreadCents: FAT_UNISON_SPREAD_CENTS };
  const voiceOptions = {
    oscillator: {
      type: FAT_OSCILLATOR_TYPE[layer.oscillatorType],
      count: unison.count,
      spread: unison.spreadCents,
    },
    envelope: layer.envelope,
    detune: (layer.detuneSemitones ?? 0) * 100, // Tone.js detune הוא בסנטים, לא בחצאי-טונים.
  };
  return polyphonic ? new PolySynth(Synth, voiceOptions) : new Synth(voiceOptions);
}

interface LayerVoice {
  voice: ToneVoice;
  gain: Gain;
  filterNode: Filter | null;
  distortionNode: Distortion | null;
}

function disposeLayerVoice(layerVoice: LayerVoice): void {
  layerVoice.voice.dispose();
  layerVoice.filterNode?.dispose();
  layerVoice.distortionNode?.dispose();
  layerVoice.gain.dispose();
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
  private layerVoices: LayerVoice[] = [];
  private presetFilterNode: Filter | null = null;

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
    // ⭐ שכבות מרובות מתחברות ל-sumNode משותף (לא ישירות ל-outputGain) — כדי שהפילטר
    // ברמת-הפריסט (preset.filter, אם מוגדר) יחול על *סכום* השכבות, לא על כל שכבה בנפרד
    // (שכל שכבה יכולה כבר לקבל פילטר-משלה, layer.filter, לפני הסכימה — ראה §תיעוד למעלה).
    const layers = resolveLayers(this.preset);
    const sumNode = this.preset.filter ? new Gain(1) : this.outputGain;
    if (this.preset.filter) {
      this.presetFilterNode = new Filter(this.preset.filter.frequencyHz, this.preset.filter.type);
      if (this.preset.filter.resonance !== undefined) {
        this.presetFilterNode.Q.value = this.preset.filter.resonance;
      }
      sumNode.connect(this.presetFilterNode);
      this.presetFilterNode.connect(this.outputGain);
    }

    this.layerVoices = layers.map((layer) => {
      const voice = createToneVoice(layer, this.preset.polyphonic);
      const layerGain = new Gain(layer.gain);
      let filterNode: Filter | null = null;
      let distortionNode: Distortion | null = null;
      let tail: ToneVoice | Filter | Distortion = voice;

      if (layer.driveAmount !== undefined && layer.driveAmount > 0) {
        distortionNode = new Distortion(layer.driveAmount);
        tail.connect(distortionNode);
        tail = distortionNode;
      }
      if (layer.filter) {
        filterNode = new Filter(layer.filter.frequencyHz, layer.filter.type);
        if (layer.filter.resonance !== undefined) {
          filterNode.Q.value = layer.filter.resonance;
        }
        tail.connect(filterNode);
        tail = filterNode;
      }
      tail.connect(layerGain);
      layerGain.connect(sumNode);

      return { voice, gain: layerGain, filterNode, distortionNode };
    });
  }

  playNote(note: Note, time: number): void {
    if (this.layerVoices.length === 0) {
      throw new Error(`SynthProvider(${this.role}): playNote נקרא לפני load()`);
    }
    const frequencyHz = midiToHz(note.pitch);
    const durationSeconds = ticksToSeconds(note.durationTicks, this.tempoBpm);
    for (const layerVoice of this.layerVoices) {
      layerVoice.voice.triggerAttackRelease(frequencyHz, durationSeconds, time, note.velocity);
    }
  }

  dispose(): void {
    this.layerVoices.forEach(disposeLayerVoice);
    this.presetFilterNode?.dispose();
    this.outputGain.dispose();
  }
}
