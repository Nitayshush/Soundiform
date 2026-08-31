/**
 * @file        SamplerProvider.ts
 * @description ⭐ 2026-08-30: מימוש InstrumentProvider מבוסס **דגימות אמיתיות** — הכלי
 *              השני לצד SynthProvider, ובדיוק מה ש-§4.7 תכנן ל-V2.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ חוק הברזל של §4.7: "המנוע המוזיקלי לעולם לא יודע אם מאחוריו סינתסייזר או דגימה".
 * לכן החוזה כאן זהה לחלוטין ל-SynthProvider — `output`/`load`/`playNote`/`dispose` —
 * ו-sharedScheduling.ts מתזמן את שניהם באותו קוד בדיוק, בלי לדעת מי מהם.
 *
 * ⚠️ `load()` **לא מוריד כלום**: הדגימות חייבות להיות מפוענחות מראש (sampleLoader.ts), כי
 * הרינדור רץ בתוך `Tone.Offline` שמתחיל מיד ולא ממתין לרשת. אם הן חסרות — נזרקת שגיאה
 * מפורשת, ולא "דגימה שקטה" שקשה לאבחן.
 */

import { Gain, Sampler } from 'tone';
import type { OutputNode } from 'tone';
import type { Note, TrackRole } from '@soundiform/core';
import { midiToHz, ticksToSeconds } from '../internal/audioUtils';
import type { InstrumentProvider } from './InstrumentProvider';
import { getDecodedSamples, type SampledInstrumentSpec } from './sampleLoader';

export interface SamplerPresetConfig extends SampledInstrumentSpec {
  /** עוצמת הכלי יחסית לשאר — מקביל ל-gain של שכבת-סינת'. */
  gain?: number;
  /** זמן שחרור (שניות) — כמה הצליל דועך אחרי סוף התו. */
  release?: number;
}

const DEFAULT_GAIN = 1;
const DEFAULT_RELEASE_SECONDS = 0.4;

export class SamplerProvider implements InstrumentProvider {
  readonly id: string;
  readonly kind = 'sampler' as const;
  readonly output: OutputNode;

  private readonly role: TrackRole;
  private readonly tempoBpm: number;
  private readonly preset: SamplerPresetConfig;
  private readonly outputGain: Gain;
  private sampler: Sampler | null = null;

  constructor(role: TrackRole, tempoBpm: number, preset: SamplerPresetConfig) {
    this.role = role;
    this.tempoBpm = tempoBpm;
    this.preset = preset;
    this.id = `sampler-${role}-${preset.instrumentId}`;
    this.outputGain = new Gain(preset.gain ?? DEFAULT_GAIN);
    this.output = this.outputGain;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- Promise נדרש ע"י InstrumentProvider; כאן אין await אמיתי כי הדגימות כבר מפוענחות (ראה הערת הקובץ).
  async load(_instrumentId: string): Promise<void> {
    const samples = getDecodedSamples(this.preset.instrumentId);
    if (!samples || Object.keys(samples).length === 0) {
      throw new Error(
        `SamplerProvider(${this.role}): הדגימות של '${this.preset.instrumentId}' לא נטענו מראש — ` +
          'יש לקרוא ל-preloadSampledInstrument לפני הרינדור (ראה sampleLoader.ts)',
      );
    }
    // ⭐ Tone.Sampler מקבל AudioBuffer ישירות ב-urls (ראה SamplesMap ב-Sampler.d.ts), ולכן
    // אין כאן baseUrl ואין טעינה — רק מיפוי תו→באפר שכבר בזיכרון.
    this.sampler = new Sampler({
      urls: samples,
      release: this.preset.release ?? DEFAULT_RELEASE_SECONDS,
    });
    this.sampler.connect(this.outputGain);
  }

  playNote(note: Note, time: number): void {
    if (!this.sampler) {
      throw new Error(`SamplerProvider(${this.role}): playNote נקרא לפני load()`);
    }
    // ⚠️ Sampler הוא פוליפוני מטבעו (קול לכל תו), ולכן — בניגוד ל-SynthProvider המונופוני —
    // אין כאן שום צורך בהגנת "זמן עולה-ממש": שני תווים באותו רגע פשוט מקבלים שני קולות.
    this.sampler.triggerAttackRelease(
      midiToHz(note.pitch),
      ticksToSeconds(note.durationTicks, this.tempoBpm),
      time,
      note.velocity,
    );
  }

  dispose(): void {
    this.sampler?.dispose();
    this.outputGain.dispose();
  }
}
