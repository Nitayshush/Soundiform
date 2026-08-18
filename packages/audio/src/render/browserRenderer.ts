/**
 * @file        browserRenderer.ts
 * @description רנדור פריוויו חי בדפדפן — Tone.js על AudioContext אמיתי.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי: חייב לחלוק לוגיקה עם serverRenderer.ts (§3 חוקה 1) —
 * ההבדל היחיד המותר הוא ה-AudioContext הבסיסי, לא ה-scheduling/mixing.
 * כרגע (Sprint 4) serverRenderer.ts עוד לא קיים (Sprint 6) — הקוד כאן כבר בנוי כך
 * שרוב הלוגיקה (createTrackRuntime, buildMixChain, SynthProvider) לא תלויה ב-window/document,
 * רק ב-Tone.js context הגלובלי, כדי שיהיה ניתן לשימוש חוזר.
 *
 * ⚠️ Tone.js מחזיק Transport גלובלי יחיד per context — אסור להריץ שני BrowserRenderer
 * במקביל בלי לקרוא dispose() לקודם, אחרת loop/bpm/scheduling יתנגשו.
 */

import { connect, getTransport, Part, start as startAudioContext } from 'tone';
import type { InputNode } from 'tone';
import type { MusicalScore, Note, Track, TrackRole } from '@shape-sound/core';
import { TICKS_PER_BEAT } from '@shape-sound/core';
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
import { createMasterBus } from '../mixing/loudness';
import { ticksToSeconds } from '../internal/audioUtils';

/**
 * מה ש-browserRenderer צריך מסגנון (GenrePack) בלי לתלות ב-@shape-sound/genres — §3.
 * apps/web בונה את זה מ-GenrePack.synthMap/mixChain; ברירת המחדל היא באחריות הקורא.
 */
export interface GenreAudioConfig {
  synthPresets: Partial<Record<TrackRole, SynthPresetConfig>>;
  mixCharacter: MixCharacterConfig;
}

const DEFAULT_AUDIO_CONFIG: GenreAudioConfig = {
  synthPresets: {},
  mixCharacter: DEFAULT_MIX_CHARACTER,
};

interface ScheduledNoteEvent {
  time: number;
  note: Note;
}

interface TrackRuntime {
  provider: SynthProvider;
  mixChain: MixChainHandle;
  part: Part<ScheduledNoteEvent>;
}

export interface BrowserRendererHandle {
  /** מתחיל ניגון. חייב להיקרא כתגובה למחוות משתמש אמיתית (מדיניות autoplay של דפדפנים). */
  play(): Promise<void>;
  stop(): void;
  seekSeconds(seconds: number): void;
  getCurrentSeconds(): number;
  readonly durationSeconds: number;
  dispose(): void;
}

function computeDurationSeconds(score: MusicalScore): number {
  const [beatsPerBar] = score.timeSignature;
  const ticksPerBar = TICKS_PER_BEAT * beatsPerBar;
  return ticksToSeconds(score.durationBars * ticksPerBar, score.tempo);
}

async function createTrackRuntime(
  track: Track,
  tempoBpm: number,
  destination: InputNode,
  audioConfig: GenreAudioConfig,
): Promise<TrackRuntime> {
  const preset = audioConfig.synthPresets[track.role] ?? DEFAULT_SYNTH_PRESET;
  const provider = new SynthProvider(track.role, tempoBpm, preset);
  const mixChain = await buildMixChain(track.mixSettings, destination, audioConfig.mixCharacter);
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

/**
 * מכין פריוויו חי מלא ל-MusicalScore: יוצר SynthProvider+mixChain לכל טראק, מתזמן את כל
 * התווים על Tone.Transport, ומגדיר לופ על פני כל משך היצירה (§4.2: קונטור סגור → לופ).
 */
export async function createBrowserRenderer(
  score: MusicalScore,
  audioConfig: GenreAudioConfig = DEFAULT_AUDIO_CONFIG,
): Promise<BrowserRendererHandle> {
  await startAudioContext();

  const transport = getTransport();
  transport.bpm.value = score.tempo;

  const masterBus = createMasterBus();
  masterBus.toDestination();

  const durationSeconds = computeDurationSeconds(score);
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = durationSeconds;

  const trackRuntimes = await Promise.all(
    score.tracks.map((track) => createTrackRuntime(track, score.tempo, masterBus, audioConfig)),
  );

  return {
    async play() {
      await startAudioContext();
      transport.start();
    },
    stop() {
      transport.stop();
      transport.seconds = 0;
    },
    seekSeconds(seconds: number) {
      transport.seconds = Math.max(0, Math.min(seconds, durationSeconds));
    },
    getCurrentSeconds() {
      return transport.seconds;
    },
    durationSeconds,
    dispose() {
      transport.stop();
      transport.cancel(0);
      trackRuntimes.forEach(({ provider, mixChain, part }) => {
        part.dispose();
        provider.dispose();
        mixChain.dispose();
      });
      masterBus.dispose();
    },
  };
}
