/**
 * @file        browserRenderer.ts
 * @description רנדור פריוויו חי בדפדפן — Tone.js על AudioContext אמיתי.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ Sprint 6: לוגיקת התזמון (createAllTrackRuntimes וכו') עברה ל-sharedScheduling.ts, שגם
 * serverRenderer.ts קורא לה — זה המימוש בפועל של "פריוויו ≈ פלט סופי" (§11 Sprint 6), לא
 * רק כוונה. מה שנשאר כאן ייחודי לדפדפן: Tone.start() (מדיניות autoplay), ו-Transport
 * live control (play/stop/seek בזמן אמת) — לעומת serverRenderer שרק "מריץ קדימה" אופליין.
 */

import { getTransport, start as startAudioContext } from 'tone';
import type { MusicalScore } from '@soundiform/core';
import { createMasterBus } from '../mixing/loudness';
import {
  computeDurationSeconds,
  createAllTrackRuntimes,
  DEFAULT_AUDIO_CONFIG,
  type GenreAudioConfig,
} from './sharedScheduling';

export { DEFAULT_AUDIO_CONFIG } from './sharedScheduling';
export type { GenreAudioConfig } from './sharedScheduling';

export interface BrowserRendererHandle {
  /** מתחיל ניגון. חייב להיקרא כתגובה למחוות משתמש אמיתית (מדיניות autoplay של דפדפנים). */
  play(): Promise<void>;
  stop(): void;
  seekSeconds(seconds: number): void;
  getCurrentSeconds(): number;
  readonly durationSeconds: number;
  dispose(): void;
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

  const durationSeconds = computeDurationSeconds(score, audioConfig);
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = durationSeconds;

  const { disposeAll } = await createAllTrackRuntimes(score, masterBus, audioConfig);

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
      disposeAll();
      masterBus.dispose();
    },
  };
}
