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

import { connect, Gain, Part } from 'tone';
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
import { createSidechainDuck, type SidechainDuck } from '../mixing/sidechain';
import { ticksToSeconds } from '../internal/audioUtils';

/**
 * מה ש-renderer צריך מסגנון (GenrePack) בלי לתלות ב-@soundiform/genres — §3.
 * apps/web בונה את זה מ-GenrePack.synthMap/mixChain; ברירת המחדל היא באחריות הקורא.
 */
export interface GenreAudioConfig {
  synthPresets: Partial<Record<TrackRole, SynthPresetConfig>>;
  mixCharacter: MixCharacterConfig;
  /** ⭐ 2026-08-22: trance/house — ראה sidechain.ts. undefined/false = בלי pumping. */
  sidechainEnabled?: boolean;
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

/** תקרה סבירה לתוספת-זנב — מונעת padding בלתי-סביר גם אם קונפיג עתידי יגדיר reverb ארוך מאוד. */
const MAX_RELEASE_TAIL_SECONDS = 8;

/**
 * ⭐ 2026-08-22 — באג אמיתי שנתפס ע"י בדיקה חיה: המשך היה מחושב *רק* מ-durationBars,
 * בלי לתת זמן לזנב-ריוורב/release להישמע — outro (Item 4) עם ריוורב ארוך (chill 4s,
 * cinematic 5s) היה נחתך אמצע-דעיכה, ממש ההיפך מ"outro". audioConfig?.mixCharacter.
 * reverbDecaySeconds (אם סופק) קובע תוספת-זנב אמיתית, לא ניחוש קבוע — genre-aware.
 */
export function computeDurationSeconds(
  score: MusicalScore,
  audioConfig?: GenreAudioConfig,
): number {
  const [beatsPerBar] = score.timeSignature;
  const ticksPerBar = TICKS_PER_BEAT * beatsPerBar;
  const nominalSeconds = ticksToSeconds(score.durationBars * ticksPerBar, score.tempo);
  const releaseTailSeconds = Math.min(
    MAX_RELEASE_TAIL_SECONDS,
    audioConfig?.mixCharacter.reverbDecaySeconds ?? 0,
  );
  return nominalSeconds + releaseTailSeconds;
}

export async function createTrackRuntime(
  track: Track,
  tempoBpm: number,
  destination: InputNode,
  audioConfig: GenreAudioConfig,
  reverbSeed: string,
  sidechainDuck?: Gain,
): Promise<TrackRuntime> {
  const preset = audioConfig.synthPresets[track.role] ?? DEFAULT_SYNTH_PRESET;
  const provider = new SynthProvider(track.role, tempoBpm, preset);
  const mixChain = await buildMixChain(
    track.mixSettings,
    destination,
    reverbSeed,
    audioConfig.mixCharacter,
    sidechainDuck,
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

export interface TrackRuntimeSet {
  trackRuntimes: TrackRuntime[];
  /** משחרר גם את ה-sidechain duck המשותף (אם נבנה) בנוסף לכל track runtime. פונקציה-כערך
   * (לא method-shorthand) בכוונה — הקוראים תמיד מפרקים ({ disposeAll }), ו-method-shorthand
   * מפעיל @typescript-eslint/unbound-method על destructuring כזה. */
  disposeAll: () => void;
}

/**
 * יוצר runtime (provider+mixChain+part מתוזמן) לכל טראק ב-score, על ה-context הפעיל.
 * ⭐ 2026-08-22: כשaudioConfig.sidechainEnabled ויש טראק 'drums' — בונה gain node משותף אחד
 * (ראה sidechain.ts) מתוזמן לפי פגיעות התופים, ומחבר אותו לכל טראק *חוץ* מה-drums עצמו
 * (קיק לא דוחק את עצמו).
 */
export async function createAllTrackRuntimes(
  score: MusicalScore,
  destination: InputNode,
  audioConfig: GenreAudioConfig,
): Promise<TrackRuntimeSet> {
  const drumsTrack = score.tracks.find((track) => track.role === 'drums');
  const sidechainDuck: SidechainDuck | null =
    audioConfig.sidechainEnabled && drumsTrack
      ? createSidechainDuck(drumsTrack.notes, score.tempo)
      : null;

  const trackRuntimes = await Promise.all(
    score.tracks.map((track) =>
      createTrackRuntime(
        track,
        score.tempo,
        destination,
        audioConfig,
        `${score.seed}:${track.role}`,
        track.role === 'drums' ? undefined : (sidechainDuck?.gain ?? undefined),
      ),
    ),
  );

  return {
    trackRuntimes,
    disposeAll: () => {
      disposeTrackRuntimes(trackRuntimes);
      sidechainDuck?.dispose();
    },
  };
}

export function disposeTrackRuntimes(trackRuntimes: readonly TrackRuntime[]): void {
  trackRuntimes.forEach(({ provider, mixChain, part }) => {
    part.dispose();
    provider.dispose();
    mixChain.dispose();
  });
}
