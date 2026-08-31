/**
 * @file        DrumKitProvider.ts
 * @description ⭐ 2026-08-31 (ערכת תופים אמיתית): מימוש InstrumentProvider שמנגן **ערכה** —
 *              באפר נפרד לכל חלק (קיק/סנר/היי-האט…), נבחר לפי `note.drumPiece`.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה לא SamplerProvider.** `Tone.Sampler` ממפה תו→באפר ו**מותח את הגובה** כדי לכסות
 * תווים חסרים. לערכה זו התנהגות שגויה: קיק שנמתח כלפי מעלה מפסיק להישמע כמו קיק. כאן כל
 * חלק מנוגן ב-`Tone.Player` נפרד, **בגובה המקורי שלו**, בלי שום מתיחה.
 *
 * ⚠️ **עוצמה לכל מכה** נקבעת דרך Gain ייעודי עם `setValueAtTime` בזמן המתוזמן — לא דרך
 * `player.volume`, שהוא מאפיין של הנגן כולו ולא של המכה הבודדת ולכן היה משנה למפרע גם
 * מכות שכבר תוזמנו.
 *
 * ⚠️ שתי מכות של אותו חלק בחפיפה מפעילות מחדש את אותו נגן (המכה הקודמת נקטעת). זו
 * ההתנהגות הנכונה לערכה אמיתית — היי-האט אמיתי נחתך כשמכים בו שוב — ולא באג.
 */

import { Gain, Player } from 'tone';
import type { OutputNode } from 'tone';
import { DRUM_PIECES, type DrumPiece, type Note, type TrackRole } from '@soundiform/core';
import type { InstrumentProvider } from './InstrumentProvider';
import { getDecodedSamples, type SampledInstrumentSpec } from './sampleLoader';

/**
 * ⚠️ `pieces` ולא `notes` (SampledInstrumentSpec): המפתחות כאן הם שמות חלקי-ערכה, לא תווים.
 * הטוען (sampleLoader) עדיין משרת את שניהם — הקורא ממיר pieces→notes, ראה offlineRenderer.
 */
export interface DrumKitPresetConfig {
  instrumentId: string;
  pieces: readonly string[];
  extension: string;
  gain?: number;
}

/** ממיר ערכה למפרט-טעינה גנרי — נקודת ההמרה היחידה בין שתי אוצרות-המילים. */
export function drumKitToSampleSpec(preset: DrumKitPresetConfig): SampledInstrumentSpec {
  return {
    instrumentId: preset.instrumentId,
    notes: preset.pieces,
    extension: preset.extension,
  };
}

const DEFAULT_GAIN = 1;
/** חלק שהציון ביקש ואין לו דגימה — נופל לזה, כדי שלעולם לא תיווצר מכה שקטה בלי הסבר. */
const FALLBACK_PIECE: DrumPiece = 'snare';

/**
 * ⚠️ **מרווח מינימלי בין שתי מכות של אותו חלק — לא רק "גדול ממש".**
 *
 * ההגנה הראשונה כאן דרשה רק `time > previousStart`, וזה לא הספיק: `Source.start` **מהדק**
 * את הזמן לבלוק-העיבוד (128 דגימות ≈ 4ms), ולכן שתי מכות במרחק מילישניות ספורות מתקבעות
 * לאותו זמן בדיוק ואז Tone זורק "Start time must be strictly greater than previous start
 * time" — כשל שמפיל את **כל** הרינדור. זו בדיוק אותה טעות שכבר תוקנה ב-SynthProvider
 * (MONOPHONIC_MIN_SEPARATION_SECONDS), ולא הוחלה כאן.
 *
 * 12ms מכסה בלוק בכל קצב-דגימה, ועדיין רחוק מאוד מהמכה הקצרה ביותר שמתנגנת בפועל
 * (שלושים-ושתיים ב-138BPM ≈ 54ms) — כלומר לא מדלג על שום מכה מוזיקלית אמיתית.
 */
const MIN_SEPARATION_SECONDS = 0.012;

interface PieceVoice {
  player: Player;
  gain: Gain;
}

export class DrumKitProvider implements InstrumentProvider {
  readonly id: string;
  readonly kind = 'sampler' as const;
  readonly output: OutputNode;

  private readonly role: TrackRole;
  private readonly preset: DrumKitPresetConfig;
  private readonly outputGain: Gain;
  private readonly voices = new Map<DrumPiece, PieceVoice>();
  /** זמן ההפעלה האחרון לכל חלק — ראה ההגנה ב-playNote. */
  private readonly lastStartByPiece = new Map<DrumPiece, number>();

  constructor(role: TrackRole, preset: DrumKitPresetConfig) {
    this.role = role;
    this.preset = preset;
    this.id = `drumkit-${role}-${preset.instrumentId}`;
    this.outputGain = new Gain(preset.gain ?? DEFAULT_GAIN);
    this.output = this.outputGain;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- Promise נדרש ע"י InstrumentProvider; הדגימות כבר מפוענחות (sampleLoader.ts), אין כאן await אמיתי.
  async load(_instrumentId: string): Promise<void> {
    const samples = getDecodedSamples(this.preset.instrumentId);
    if (!samples || Object.keys(samples).length === 0) {
      throw new Error(
        `DrumKitProvider(${this.role}): הדגימות של '${this.preset.instrumentId}' לא נטענו מראש — ` +
          'יש לקרוא ל-preloadSampledInstrument לפני הרינדור (ראה sampleLoader.ts)',
      );
    }

    for (const piece of DRUM_PIECES) {
      const buffer = samples[piece];
      if (!buffer) {
        continue; // ערכה חלקית מותרת — playNote נופל לחלק קיים.
      }
      const gain = new Gain(1);
      const player = new Player(buffer);
      player.connect(gain);
      gain.connect(this.outputGain);
      this.voices.set(piece, { player, gain });
    }

    if (this.voices.size === 0) {
      throw new Error(
        `DrumKitProvider(${this.role}): אף חלק-ערכה מוכר לא נמצא ב-'${this.preset.instrumentId}' ` +
          `(מפתחות בפועל: ${Object.keys(samples).join(', ')})`,
      );
    }
  }

  playNote(note: Note, time: number): void {
    if (this.voices.size === 0) {
      throw new Error(`DrumKitProvider(${this.role}): playNote נקרא לפני load()`);
    }
    // ⚠️ תו בלי drumPiece מגיע מציון שנוצר לפני 2026-08-31 (או מהנתיב הישן) — לא זורקים,
    // מנגנים חלק ברירת-מחדל, כדי שיצירה שמורה תמשיך להישמע ולא תיפול.
    const requested = note.drumPiece ?? FALLBACK_PIECE;
    const voice =
      this.voices.get(requested) ?? this.voices.get(FALLBACK_PIECE) ?? [...this.voices.values()][0];
    if (!voice) {
      return;
    }

    // ⚠️ **הגנה קשיחה (2026-08-31, אחרי כשל בפרודקשן-דיפ).** `Tone.Source.start` זורק
    // "Start time must be strictly greater than previous start time" כשמפעילים מקור שכבר
    // מנגן בזמן שאינו גדול-ממש מהקודם — ולכל חלק יש כאן `Player` **אחד**. חריגה כזו
    // מפילה את הרינדור **כולו**, ולא רק את המכה הבודדת.
    //
    // composeMusicalScore כבר מאחד מכות בו-זמניות (collapseSimultaneousDrumHits), אבל
    // ההגנה חוזרת גם כאן במכוון: ציונים שנשמרו ב-renders.score לפני התיקון עדיין מכילים
    // כפילויות, והם חייבים להמשיך להתנגן. מדלגים על המכה — לא זורקים.
    const previousStart = this.lastStartByPiece.get(requested);
    if (previousStart !== undefined && time < previousStart + MIN_SEPARATION_SECONDS) {
      return;
    }
    this.lastStartByPiece.set(requested, time);

    voice.gain.gain.setValueAtTime(Math.min(1, Math.max(0, note.velocity)), time);
    voice.player.start(time);
  }

  dispose(): void {
    for (const { player, gain } of this.voices.values()) {
      player.dispose();
      gain.dispose();
    }
    this.voices.clear();
    this.lastStartByPiece.clear();
    this.outputGain.dispose();
  }
}
