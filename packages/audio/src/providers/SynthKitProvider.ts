/**
 * @file        SynthKitProvider.ts
 * @description ⭐ 2026-09-28 (ערכת-תופים מסונתזת): מימוש InstrumentProvider שמנגן ערכת-תופים
 *              **מסונתזת** — גרף-קול Tone.js נפרד לכל חלק-ערכה, נבחר לפי `note.drumPiece`,
 *              בלי דגימות. הדפוס מבוסס-דיספאצ' לפי-חלק זהה ל-DrumKitProvider.ts (Tone.Player
 *              → כאן Tone.Synth/PolySynth דרך buildSynthVoiceGraph של SynthProvider.ts).
 * @author      Soundiform
 * @created     2026-09-28
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה זה נוסף.** 7 מ-9 אפשרויות-הצליל לתופים בטראנס/האוס היו פריסט-סינת' **יחיד**
 * לכל התפקיד — קיק/סנר/מחיאה/היי-האט כולם מנגנים אותו גל-קול, רק בגבהים שונים
 * (DRUM_PIECE_DEGREE_OFFSET). autoSelectDrumKit (genreAdapter.ts) תמיד מעדיף ערכת-דגימות
 * אמיתית כשקיימת, כך ש-7 מהאפשרויות האלה לא עשו כלום בפועל בבורר — נמדד ואושר. זה מחליף
 * אותן ביכולת אמיתית: כל חלק מקבל SynthPresetConfig משלו (גוון, לא רק פיץ').
 *
 * ⚠️ כל חלק **תמיד מונופוני** (Tone.Synth, לא PolySynth) — חלק-תופים בודד לא יכול פיזית
 * לחפוף את עצמו, בדיוק כמו קול "drums" הרגיל ב-SynthProvider וכמו Player יחיד ב-DrumKitProvider.
 * לכן גם אותה הגנת-מרווח-מינימלי (MIN_SEPARATION_SECONDS + lastStartByPiece) — זו בדיוק
 * המשפחה של קריסת "Start time must be strictly greater" שתוקנה כבר גם ב-SynthProvider וגם
 * ב-DrumKitProvider; מכות צפופות על אותו חלק (תבנית+פגיעת-פינה על אותו step) הן תרחיש אמיתי.
 */

import { Gain } from 'tone';
import type { Filter, OutputNode } from 'tone';
import { DRUM_PIECES, type DrumPiece, type Note, type TrackRole } from '@soundiform/core';
import type { InstrumentProvider } from './InstrumentProvider';
import {
  buildSynthVoiceGraph,
  disposeLayerVoice,
  type LayerVoice,
  type SynthPresetConfig,
} from './SynthProvider';
import { midiToHz, ticksToSeconds } from '../internal/audioUtils';

function isDrumPiece(value: string): value is DrumPiece {
  return (DRUM_PIECES as readonly string[]).includes(value);
}

export interface SynthKitPresetConfig {
  /** ⚠️ ערכה חלקית מותרת — חלק חסר נופל ל-FALLBACK_PIECE, בדיוק כמו DrumKitProvider. */
  pieces: Partial<Record<DrumPiece, SynthPresetConfig>>;
  gain?: number;
}

const DEFAULT_GAIN = 1;
/** חלק שהציון ביקש ואין לו הגדרה בערכה — נופל לזה (עקבי עם DrumKitProvider.FALLBACK_PIECE). */
const FALLBACK_PIECE: DrumPiece = 'snare';
/** אותו סף בדיוק כמו DrumKitProvider/SynthProvider — ראה תיעוד-הקובץ. */
const MIN_SEPARATION_SECONDS = 0.012;

interface PieceVoice {
  layerVoices: LayerVoice[];
  gain: Gain;
  presetFilterNode: Filter | null;
}

export class SynthKitProvider implements InstrumentProvider {
  readonly id: string;
  readonly kind = 'synth' as const;
  readonly output: OutputNode;

  private readonly role: TrackRole;
  private readonly tempoBpm: number;
  private readonly preset: SynthKitPresetConfig;
  private readonly outputGain: Gain;
  private readonly voices = new Map<DrumPiece, PieceVoice>();
  private readonly lastStartByPiece = new Map<DrumPiece, number>();

  constructor(role: TrackRole, tempoBpm: number, preset: SynthKitPresetConfig) {
    this.role = role;
    this.tempoBpm = tempoBpm;
    this.preset = preset;
    this.id = `synthkit-${role}`;
    this.outputGain = new Gain(preset.gain ?? DEFAULT_GAIN);
    this.output = this.outputGain;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- load() חייב Promise לפי InstrumentProvider; בניית-הגרף כאן סינכרונית לגמרי (בלי דגימות/רשת).
  async load(_instrumentId: string): Promise<void> {
    for (const [piece, synthPreset] of Object.entries(this.preset.pieces) as [
      DrumPiece,
      SynthPresetConfig,
    ][]) {
      if (!isDrumPiece(piece)) {
        continue; // הגנה על קונפיג עם מפתחות לא-קשורים (אותה גישה כמו DrumKitProvider).
      }
      const pieceGain = new Gain(1);
      pieceGain.connect(this.outputGain);
      // ⚠️ תמיד מונופוני (polyphonic=false) — ראה תיעוד-הקובץ.
      const graph = buildSynthVoiceGraph(synthPreset, false, pieceGain);
      this.voices.set(piece, {
        layerVoices: graph.layerVoices,
        gain: pieceGain,
        presetFilterNode: graph.presetFilterNode,
      });
    }

    if (this.voices.size === 0) {
      throw new Error(
        `SynthKitProvider(${this.role}): הערכה לא מגדירה אף חלק-ערכה מוכר (מפתחות בפועל: ` +
          `${Object.keys(this.preset.pieces).join(', ')})`,
      );
    }
  }

  playNote(note: Note, time: number): void {
    if (this.voices.size === 0) {
      throw new Error(`SynthKitProvider(${this.role}): playNote נקרא לפני load()`);
    }
    const requested = note.drumPiece ?? FALLBACK_PIECE;
    const voice =
      this.voices.get(requested) ?? this.voices.get(FALLBACK_PIECE) ?? [...this.voices.values()][0];
    if (!voice) {
      return;
    }

    // ⚠️ אותה הגנה בדיוק כמו DrumKitProvider — ראה תיעוד-הקובץ.
    const previousStart = this.lastStartByPiece.get(requested);
    if (previousStart !== undefined && time < previousStart + MIN_SEPARATION_SECONDS) {
      return;
    }
    this.lastStartByPiece.set(requested, time);

    const frequencyHz = midiToHz(note.pitch);
    const durationSeconds = ticksToSeconds(note.durationTicks, this.tempoBpm);
    for (const layerVoice of voice.layerVoices) {
      layerVoice.voice.triggerAttackRelease(frequencyHz, durationSeconds, time, note.velocity);
    }
  }

  dispose(): void {
    for (const voice of this.voices.values()) {
      voice.layerVoices.forEach(disposeLayerVoice);
      voice.presetFilterNode?.dispose();
      voice.gain.dispose();
    }
    this.voices.clear();
    this.lastStartByPiece.clear();
    this.outputGain.dispose();
  }
}
