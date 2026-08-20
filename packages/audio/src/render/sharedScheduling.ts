/**
 * @file        sharedScheduling.ts
 * @description ⭐⭐ הלוגיקה המשותפת ל-browserRenderer.ts ו-serverRenderer.ts — בונה
 *              SynthProvider+mixChain+Part לכל טראק על ה-Tone.js context הפעיל, יהיה אשר יהיה.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ זה בפועל מה שמבטיח "פריוויו ≈ פלט סופי" (§11 Sprint 6) — לא כוונה טובה, אלא מנגנון:
 * שני ה-renderers קוראים לאותן הפונקציות בדיוק. ההבדל היחיד המותר ביניהם הוא איזה
 * Tone.js context פעיל ברגע הקריאה (Tone.setContext) — קובעים את זה *לפני* קריאה לכאן,
 * לא כאן. הפונקציות כאן לא יודעות אם מדובר ב-AudioContext אמיתי או OfflineAudioContext.
 */

import { connect, Part } from 'tone';
import type { InputNode } from 'tone';
import type { MusicalScore, Note, Track, TrackRole } from '@soundiform/core';
import { TICKS_PER_BEAT } from '@soundiform/core';
import {
  DEFAULT_SYNTH_PRESET,
  SynthProvider,
  type SynthPresetConfig,
} from '../providers/SynthProvider';
import {
  buildMixChain,
  DEFAULT_MIX_CHARACTER,
  type MixCharacterConfig,
  type MixChainHandle,
} from '../mixing/mixChain';
import { ticksToSeconds } from '../internal/audioUtils';

/**
 * מה ש-renderer צריך מסגנון (GenrePack) בלי לתלות ב-@soundiform/genres — §3.
 * apps/web בונה את זה מ-GenrePack.synthMap/mixChain; ברירת המחדל היא באחריות הקורא.
 */
export interface GenreAudioConfig {
  synthPresets: Partial<Record<TrackRole, SynthPresetConfig>>;
  mixCharacter: MixCharacterConfig;
}

export const DEFAULT_AUDIO_CONFIG: GenreAudioConfig = {
  synthPresets: {},
  mixCharacter: DEFAULT_MIX_CHARACTER,
};

export interface ScheduledNoteEvent {
  time: number;
  note: Note;
}

export interface TrackRuntime {
  provider: SynthProvider;
  mixChain: MixChainHandle;
  part: Part<ScheduledNoteEvent>;
}

export function computeDurationSeconds(score: MusicalScore): number {
  const [beatsPerBar] = score.timeSignature;
  const ticksPerBar = TICKS_PER_BEAT * beatsPerBar;
  return ticksToSeconds(score.durationBars * ticksPerBar, score.tempo);
}

export async function createTrackRuntime(
  track: Track,
  tempoBpm: number,
  destination: InputNode,
  audioConfig: GenreAudioConfig,
  reverbSeed: string,
): Promise<TrackRuntime> {
  const preset = audioConfig.synthPresets[track.role] ?? DEFAULT_SYNTH_PRESET;
  const provider = new SynthProvider(track.role, tempoBpm, preset);
  const mixChain = await buildMixChain(
    track.mixSettings,
    destination,
    reverbSeed,
    audioConfig.mixCharacter,
  );
  await provider.load(track.instrumentId);
  // connect() (הפונקציה, לא המתודה) מטפלת נכון באיחוד OutputNode/InputNode של Tone.js —
  // .connect() כמתודה על טיפוס OutputNode לא נבחר תמיד ל-overload הנכון (ראה DECISIONS.md).
  connect(provider.output, mixChain.input);

  const events: ScheduledNoteEvent[] = track.notes.map((note) => ({
    time: ticksToSeconds(note.startTick, tempoBpm),
    note,
  }));
  const part = new Part<ScheduledNoteEvent>((time, event) => {
    provider.playNote(event.note, time);
  }, events);
  part.start(0);

  return { provider, mixChain, part };
}

/** יוצר runtime (provider+mixChain+part מתוזמן) לכל טראק ב-score, על ה-context הפעיל. */
export async function createAllTrackRuntimes(
  score: MusicalScore,
  destination: InputNode,
  audioConfig: GenreAudioConfig,
): Promise<TrackRuntime[]> {
  return Promise.all(
    score.tracks.map((track) =>
      createTrackRuntime(
        track,
        score.tempo,
        destination,
        audioConfig,
        `${score.seed}:${track.role}`,
      ),
    ),
  );
}

export function disposeTrackRuntimes(trackRuntimes: readonly TrackRuntime[]): void {
  trackRuntimes.forEach(({ provider, mixChain, part }) => {
    part.dispose();
    provider.dispose();
    mixChain.dispose();
  });
}
