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
// ⭐ 2026-08-28 (שדרוג-תשתית, לפי בקשה חיה: "חירחורים בנייד עם כמה צלילים נבחרים"): 3→2 —
// כל שכבה שלא מגדירה unison מפורש (רוב הפריסטים בפועל כן מגדירים, ראה genres/src/packs)
// מריצה בפועל FAT_UNISON_COUNT אוסצילטורים אמיתיים במקביל לכל תו — מכפיל-CPU נסתר שחל
// לפני שבכלל מגיעים ל"כמה צלילים נבחרו". 2 עדיין נותן "עובי" (יותר מגל בודד) בעלות נמוכה יותר.
//
// ⭐ 2026-08-28 (סבב הרינדור-מראש): מיוצאים עכשיו — apps/web's genreAdapter.ts חייב לחשב את
// *אותו* מספר-אוסצילטורים בדיוק כדי לאכוף תקציב-קולות (ראה applyOscillatorBudget שם). זה
// היה יכול להיות מספר-קסם משוכפל שיסטה בשקט מהמימוש כאן; ייצוא = מקור-אמת יחיד.
export const DEFAULT_UNISON_COUNT = 2;
export const DEFAULT_UNISON_SPREAD_CENTS = 18;
const FAT_UNISON_COUNT = DEFAULT_UNISON_COUNT;
const FAT_UNISON_SPREAD_CENTS = DEFAULT_UNISON_SPREAD_CENTS;

/**
 * ⭐ 2026-08-28: תקרת-קולות ל-PolySynth (pad/skank). ברירת המחדל של Tone.js היא 32 — תקרה
 * מסוכנת: כל "קול" הוא Synth שלם עם unison משלו, אז 32 קולות × unison רחב = פיצוץ-CPU
 * במקרה פתולוגי (אקורדים חופפים עם release ארוך). 8 מאפשר בנוחות אקורד בן 4 תווים *ועוד*
 * אקורד יוצא שעדיין בשלב ה-release (החפיפה האמיתית שקורית בפועל), בלי לגנוב קולות באמצע
 * אקורד — גניבת-קול נשמעת כתו שנחתך, ולכן לא מקטינים מתחת לזה.
 */
const MAX_POLYPHONY = 8;

/**
 * ⚠️ מרווח-הזמן המזערי בין שתי התקפות על אותו קול **מונופוני**. תו שמגיע קרוב מזה לקודמו
 * פשוט **מדולג** (ראה shouldSkipMonophonicNote) — לא נדחף קדימה.
 *
 * למה דילוג ולא דחיפה: קול מונופוני לא יכול פיזית להשמיע שני תווים בו-זמנית — השני רק
 * "חוטף" את הקול מהראשון, כלומר התוצאה הנשמעת כמעט זהה לדילוג. ניסיתי קודם לדחוף קדימה,
 * וזה נכשל משתי סיבות שנמדדו: (א) `GT(a,b)` של Tone הוא `a > b + 1e-6`, אז דחיפה של 1e-6
 * בדיוק עדיין לא נחשבת "גדול ממש"; (ב) חשוב יותר — `Source.start` מהדק (clamp) את הזמן
 * ל-context.currentTime, ובזמן רינדור-אופליין שתי דחיפות בתוך אותו בלוק-עיבוד (128 דגימות
 * ≈ 4ms ב-32kHz) מתקבעות לאותו זמן בדיוק וממילא מתנגשות. דחיפה שתעבוד באמת חייבת להיות
 * ~20ms — וזה כבר איחור נשמע לתופים, שגם מצטבר. דילוג נקי מכל זה.
 */
const MONOPHONIC_MIN_SEPARATION_SECONDS = 0.001;

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
  if (!polyphonic) {
    return new Synth(voiceOptions);
  }
  const polySynth = new PolySynth(Synth, voiceOptions);
  // maxPolyphony הוא property ציבורי ב-Tone.PolySynth (לא חלק מאובייקט-האפשרויות של הבנאי
  // כשקוראים לו בצורת (voice, options) — ראה PolySynth.d.ts), לכן נקבע מיד אחרי הבנייה.
  polySynth.maxPolyphony = MAX_POLYPHONY;
  return polySynth;
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
  /** ⚠️ ראה nextMonophonicTime — שומר על סדר-זמנים עולה-ממש בקולות מונופוניים. */
  private lastScheduledTime: number | null = null;

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
    //
    // ⭐ 2026-08-25 (תיקון-באג אמיתי): synthPresetSchema מתעד "layers, כשמוגדר, *מחליף* את
    // oscillatorType/envelope/filter/unison שלמעלה" — אבל הקוד כאן החיל את preset.filter
    // *תמיד*, גם כש-layers מוגדר. זה גרם לבאג שקט אמיתי: פריסט-תופים עם שכבת-טרנזיינט
    // highpass (למשל "קליק" גבוה מעל שכבת-סאב) ו-preset.filter ברמה-העליונה שהוא lowpass
    // (לשכבת-הסאב) — הקומבינציה ביטלה כמעט לחלוטין את שכבת-הטרנזיינט (highpass מעל 1500Hz
    // דרך lowpass מתחת ל-300Hz = כמעט כלום עובר), בלי שגיאה גלויה. עכשיו preset.filter
    // מוחל רק כש-layers לא מוגדר (התנהגות ה"שכבה המרומזת" היחידה) — עקבי עם התיעוד.
    const hasExplicitLayers = Boolean(this.preset.layers && this.preset.layers.length > 0);
    const layers = resolveLayers(this.preset);
    const presetFilterConfig = hasExplicitLayers ? undefined : this.preset.filter;
    const sumNode = presetFilterConfig ? new Gain(1) : this.outputGain;
    if (presetFilterConfig) {
      this.presetFilterNode = new Filter(presetFilterConfig.frequencyHz, presetFilterConfig.type);
      if (presetFilterConfig.resonance !== undefined) {
        this.presetFilterNode.Q.value = presetFilterConfig.resonance;
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
    if (this.shouldSkipMonophonicNote(time)) {
      return;
    }
    const frequencyHz = midiToHz(note.pitch);
    const durationSeconds = ticksToSeconds(note.durationTicks, this.tempoBpm);
    for (const layerVoice of this.layerVoices) {
      layerVoice.voice.triggerAttackRelease(frequencyHz, durationSeconds, time, note.velocity);
    }
  }

  /**
   * ⚠️ 2026-08-29 (תיקון קריסה אמיתית שנתפסה בסטודיו: Tone זרק "Start time must be strictly
   * greater than previous start time"): קול **מונופוני** ב-Tone.js מחזיק ציר-זמן יחיד, ושני
   * תווים שמתוזמנים לאותו רגע (או קרוב מדי) מפילים אותו. זה קורה בפועל: תבנית-התופים
   * ופגיעות-הפינות (harmonyEngine.ts) יכולות ליפול על אותו step, ו-humanizeTiming יכול לקרב
   * שני תווים עד כדי זהות.
   *
   * ⭐ למה זה קריטי דווקא עכשיו: כשהניגון היה סינתזה-בזמן-אמת זו הייתה שגיאה בקונסולה
   * שהפילה תו בודד. מאז המעבר לרינדור-מראש (offlineRenderer.ts), חריגה באמצע התזמון מפילה
   * את **כל** הרינדור — כלומר "אין צליל בכלל".
   *
   * חל רק על קולות מונופוניים: PolySynth מקצה קול נפרד לכל תו, ואקורד *אמור* להישמע
   * בו-זמנית — שם לא נוגעים בכלום. ראה MONOPHONIC_MIN_SEPARATION_SECONDS למה דילוג ולא דחיפה.
   */
  private shouldSkipMonophonicNote(time: number): boolean {
    if (this.preset.polyphonic) {
      return false;
    }
    if (
      this.lastScheduledTime !== null &&
      time < this.lastScheduledTime + MONOPHONIC_MIN_SEPARATION_SECONDS
    ) {
      return true;
    }
    this.lastScheduledTime = time;
    return false;
  }

  dispose(): void {
    this.layerVoices.forEach(disposeLayerVoice);
    this.presetFilterNode?.dispose();
    this.outputGain.dispose();
  }
}
