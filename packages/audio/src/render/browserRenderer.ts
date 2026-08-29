/**
 * @file        browserRenderer.ts
 * @description רנדור פריוויו חי בדפדפן — מנגן באפר שרונדר מראש (offlineRenderer.ts).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ 2026-08-28 — שינוי מבני: מסינתזה-בזמן-אמת לניגון-באפר-מרונדר-מראש.
 * עד הסבב הזה, הקובץ הזה בנה SynthProvider+mixChain לכל טראק ותיזמן את כל התווים על
 * Tone.Transport — כלומר הנייד היה צריך **לנגן** את היצירה בזמן אמת, עם עד ~136 אוסצילטורים
 * במקביל כשנבחרו כמה צלילים לכל תפקיד. מדידה הראתה שזה 0.6x מהזמן-אמת — כלומר בלתי-אפשרי
 * פיזית, ומכאן החירחורים והקטיעות. ההסבר המלא + המדידות נמצאים ב-offlineRenderer.ts.
 * עכשיו: מרנדרים פעם אחת לבאפר, ומנגנים Player יחיד בלולאה. עומס הניגון ≈ קריאת-באפר.
 *
 * ⭐ הממשק (BrowserRendererHandle) **נשמר זהה בכוונה** — הוא נצרך ע"י *שני* hooks:
 * useAudioEngine.ts (הסטודיו) ו-usePlayScore.ts (דפי גלריה/שיתוף, שלפי התיעוד שם הם בדיוק
 * המקומות שמנוגנים בנייד). שמירת הממשק = שני הנגנים מקבלים את התיקון, ו-usePlayScore.ts
 * לא משתנה בכלל.
 *
 * ⭐ אורך הלולאה נשאר בדיוק computeDurationSeconds (נומינלי + זנב-ריוורב) — זהה למה
 * ש-transport.loopEnd עשה קודם, כדי לא לשנות את התוצאה המוזיקלית בסבב הזה.
 *
 * ⭐ 2026-08-24 (דווח על ניגון-מובייל שמושתק אחרי כמה שניות): resumeIfSuspended —
 * דפדפני מובייל (בעיקר iOS Safari) יכולים להשעות (suspend) את חומרת ה-AudioContext אחרי
 * שהאפליקציה עוברת לרקע/המסך ננעל/המערכת חוסכת חשמל. נשמר ללא שינוי — הבעיה הזו לא קשורה
 * לעומס-מעבד, והתיקון עדיין נדרש גם בניגון-באפר.
 */

import { getContext, Player, start as startAudioContext } from 'tone';
import type { MusicalScore } from '@soundiform/core';
import { renderScoreToAudioBufferCached } from './offlineRenderer';
import { DEFAULT_AUDIO_CONFIG, type GenreAudioConfig } from './sharedScheduling';

export { DEFAULT_AUDIO_CONFIG } from './sharedScheduling';
export type { GenreAudioConfig } from './sharedScheduling';

/**
 * ⭐ 2026-08-28 (אבחון, לפי בקשה חיה: "חירחורי-סאונד בנייד"): מונה גלוי ל-renderers חיים
 * כרגע — לא אמור לעלות מעל 1 בשימוש תקין. מ-2026-08-28 מדווח גם את **זמן הרינדור בפועל**,
 * כדי שבדיקה בנייד תחזיר מספרים ולא רק "עובד/לא עובד". נחשף ל-AudioDebugHUD.tsx
 * (apps/web, מוצג רק עם ?debug=audio) — כלי-בדיקה, לא נועד להישאר קבוע בקוד-הפרודקשן.
 */
let totalCreated = 0;
let activeCount = 0;
let lastRenderMilliseconds: number | null = null;
let lastRenderSampleRate: number | null = null;
let lastRenderDurationSeconds: number | null = null;
let lastRenderFromCache = false;

export interface RendererDiagnostics {
  totalCreated: number;
  active: number;
  /** משך הרינדור-מראש האחרון במילישניות (null לפני הרינדור הראשון). */
  lastRenderMilliseconds: number | null;
  lastRenderSampleRate: number | null;
  lastRenderDurationSeconds: number | null;
  /** האם ה-renderer האחרון נבנה מבאפר שכבר היה במטמון (ואז זמן-הרינדור הוא של המדידה המקורית). */
  lastRenderFromCache: boolean;
}

export function getRendererDiagnostics(): RendererDiagnostics {
  return {
    totalCreated,
    active: activeCount,
    lastRenderMilliseconds,
    lastRenderSampleRate,
    lastRenderDurationSeconds,
    lastRenderFromCache,
  };
}

export interface BrowserRendererHandle {
  /** מתחיל ניגון. חייב להיקרא כתגובה למחוות משתמש אמיתית (מדיניות autoplay של דפדפנים). */
  play(): Promise<void>;
  stop(): void;
  seekSeconds(seconds: number): void;
  getCurrentSeconds(): number;
  readonly durationSeconds: number;
  /** ⭐ 2026-08-24: בודק אם ה-AudioContext הושעה (בעיקר iOS) ומחזיר אותו לפעולה אם צריך —
   * בטוח לקרוא לו תדיר (no-op כשה-state כבר 'running'). */
  resumeIfSuspended(): Promise<void>;
  dispose(): void;
}

/**
 * מכין פריוויו מלא ל-MusicalScore: מרנדר אותו מראש לבאפר (ראה offlineRenderer.ts) ומכין
 * Player יחיד שמנגן אותו בלולאה (§4.2: קונטור סגור → לופ).
 */
export async function createBrowserRenderer(
  score: MusicalScore,
  audioConfig: GenreAudioConfig = DEFAULT_AUDIO_CONFIG,
): Promise<BrowserRendererHandle> {
  await startAudioContext();

  const rendered = await renderScoreToAudioBufferCached(score, audioConfig);
  lastRenderMilliseconds = rendered.renderMilliseconds;
  lastRenderSampleRate = rendered.sampleRate;
  lastRenderDurationSeconds = rendered.durationSeconds;
  lastRenderFromCache = rendered.fromCache;

  const durationSeconds = rendered.durationSeconds;
  // ⚠️ מתחבר ישירות ל-destination, בלי Limiter נוסף: הבאפר כבר עבר את createMasterBus
  // (הלימיטר) בתוך הרינדור האופליין. לימיטר שני כאן היה משנה את הצליל ביחס למה שרונדר.
  const player = new Player({ url: rendered.buffer, loop: true }).toDestination();

  totalCreated += 1;
  activeCount += 1;
  let disposed = false;

  /** זמן ה-context שבו התחיל הניגון הנוכחי — null כשלא מנגן. */
  let playStartedAtContextTime: number | null = null;
  /** ההיסט בתוך הבאפר שממנו התחיל הניגון הנוכחי (seek/עצירה). */
  let offsetSeconds = 0;

  function currentSeconds(): number {
    if (playStartedAtContextTime === null || durationSeconds <= 0) {
      return offsetSeconds;
    }
    const elapsed = getContext().currentTime - playStartedAtContextTime;
    return (offsetSeconds + elapsed) % durationSeconds;
  }

  return {
    async play() {
      await startAudioContext();
      if (player.state === 'started') {
        return; // כבר מנגן — לא מפעילים מחדש (start כפול על Source מאתחל את המקור).
      }
      player.start(undefined, offsetSeconds);
      playStartedAtContextTime = getContext().currentTime;
    },
    stop() {
      if (player.state === 'started') {
        player.stop();
      }
      playStartedAtContextTime = null;
      offsetSeconds = 0;
    },
    seekSeconds(seconds: number) {
      const target = Math.max(0, Math.min(seconds, durationSeconds));
      offsetSeconds = target;
      if (player.state === 'started') {
        // Player לא תומך ב"קפיצה" בזמן ניגון — מפעילים מחדש מההיסט החדש.
        player.stop();
        player.start(undefined, target);
        playStartedAtContextTime = getContext().currentTime;
      }
    },
    getCurrentSeconds() {
      return currentSeconds();
    },
    async resumeIfSuspended() {
      const context = getContext();
      if (context.state !== 'running') {
        await context.resume();
      }
    },
    durationSeconds,
    dispose() {
      // ⚠️ idempotency guard — dispose() נקרא יותר מפעם אחת לא אמור להנמיך את המונה יותר מדי.
      if (disposed) {
        return;
      }
      disposed = true;
      activeCount -= 1;
      playStartedAtContextTime = null;
      player.dispose();
    },
  };
}
