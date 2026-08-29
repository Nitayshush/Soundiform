/**
 * @file        serverRenderer.ts
 * @description רנדור לבאפר בשרת — קורא לאותה sharedScheduling.ts כמו browserRenderer.ts,
 *              על node-web-audio-api במקום AudioContext אמיתי. ראה PROJECT.md §11 Sprint 6.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי: "אותו קוד!" (§3, §11 Sprint 6) — createAllTrackRuntimes/computeDurationSeconds
 * (sharedScheduling.ts) הם *בדיוק* מה ש-browserRenderer.ts קורא לו. זה מה שמבטיח
 * פריוויו ≈ פלט סופי, לא רק כוונה טובה.
 *
 * ⚠️ יוצא-מן-הכלל ארכיטקטוני מתועד: זה הקובץ היחיד ב-packages/audio שתלוי בסביבת Node
 * (node-web-audio-api) — לכן הוא נחשף רק דרך package.json "exports"."./server", **לעולם לא**
 * מה-index.ts הראשי, כדי ש-apps/web (שמייבא רק את הנתיב הראשי) לא ייגע בקוד הזה בכלל.
 *
 * למה יש polyfill ל-globalThis.window (ראה webAudioPolyfill.ts):
 * Tone.js לא מקבל context מותאם-אישית ישירות — הוא תמיד קורא ל-`standardized-audio-context`'s
 * `new OfflineAudioContext(...)` הפנימי (עוטף-נייטיב, לא מנוע משלו), שקורא את
 * window.OfflineAudioContext פעם אחת, ברמת ה-module, בזמן ה-import הראשון של tone. לכן
 * ה-import של webAudioPolyfill.ts *חייב* להופיע ראשון, לפני ה-import מ-'tone' למטה.
 */

import './webAudioPolyfill';
import { getContext, getTransport, OfflineContext, setContext } from 'tone';
import type { MusicalScore } from '@soundiform/core';
import { createMasterBus } from '../mixing/loudness';
import {
  computeDurationSeconds,
  createAllTrackRuntimes,
  DEFAULT_AUDIO_CONFIG,
  type GenreAudioConfig,
} from './sharedScheduling';

const SAMPLE_RATE = 44100;
const CHANNEL_COUNT = 2;

export interface RenderedAudio {
  sampleRate: number;
  durationSeconds: number;
  /** ערוץ אחד לכל אינדקס (0=שמאל, 1=ימין כש-CHANNEL_COUNT=2). */
  channels: Float32Array[];
}

/**
 * מרנדר MusicalScore לבאפר PCM אופליין (לא ניגון בזמן אמת) — קורא ל-jobs/renderAudio.ts.
 */
export async function renderToBuffer(
  score: MusicalScore,
  audioConfig: GenreAudioConfig = DEFAULT_AUDIO_CONFIG,
): Promise<RenderedAudio> {
  const durationSeconds = computeDurationSeconds(score, audioConfig);

  // עומס-יתר של הקונסטרוקטור: (channels, duration-בשניות, sampleRate) — Tone בונה context
  // אופליין משלו דרך standardized-audio-context, שמוצא את window.OfflineAudioContext
  // (שהוזרק ב-webAudioPolyfill.ts, ראה import למעלה) במקום מימוש דפדפן.
  // ⭐ 2026-08-29 (תיקון דליפה אמיתי): שומרים את ה-context הקודם ומשחזרים אותו ב-finally.
  // עד כאן setContext נקרא ולא שוחזר לעולם, כך שכל קריאה ל-renderToBuffer השאירה
  // OfflineContext נטוש. בתהליך קצר-חיים זה לא הורגש, אבל apps/worker מרנדר הרבה ג'ובים
  // באותו תהליך — שם זו דליפת-זיכרון מצטברת אמיתית. (נתפס דרך בדיקות: הצטברות של כמה
  // רינדורים בתהליך אחד הפילה את תהליך-העובד של vitest; ראה vitest.config.ts.)
  const previousContext = getContext();
  const toneContext = new OfflineContext(CHANNEL_COUNT, durationSeconds, SAMPLE_RATE);
  setContext(toneContext);

  const masterBus = createMasterBus();
  masterBus.toDestination();
  const { disposeAll } = await createAllTrackRuntimes(score, masterBus, audioConfig);

  try {
    const transport = getTransport();
    transport.bpm.value = score.tempo;
    transport.start();

    const renderedBuffer = await toneContext.render();

    const channels: Float32Array[] = [];
    for (let channelIndex = 0; channelIndex < renderedBuffer.numberOfChannels; channelIndex += 1) {
      channels.push(renderedBuffer.getChannelData(channelIndex));
    }

    return { sampleRate: renderedBuffer.sampleRate, durationSeconds, channels };
  } finally {
    // ⚠️ סדר חשוב: משחררים את הצמתים *לפני* שמחזירים את ה-context, כדי ש-dispose ירוץ על
    // ה-context שהם באמת שייכים לו.
    disposeAll();
    masterBus.dispose();
    setContext(previousContext);
  }
}
