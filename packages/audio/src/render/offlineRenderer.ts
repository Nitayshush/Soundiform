/**
 * @file        offlineRenderer.ts
 * @description ⭐ 2026-08-28 (הסבב המבני לסאונד בנייד): מרנדר MusicalScore לבאפר אודיו
 *              **בדפדפן**, מראש, במקום לסנתז אותו בזמן-אמת תוך כדי הניגון.
 * @author      Soundiform
 * @created     2026-08-28
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ למה זה קיים — הבעיה שזה פותר (מדידות אמיתיות על מנוע הרינדור הזה):
 * חירחורים וקטיעות-קול בנייד. חמישה ניסיונות-תיקון קודמים כיוונו ל"להוזיל את הסינתזה
 * בזמן-אמת" (צפיפות תופים, unison ברירת-מחדל, זנב-ריוורב, אפיק-ריוורב משותף, latencyHint)
 * ולא פתרו — כי כולם גזרו 10-30% מעומס שחרג ב-650%:
 *
 *   בקרה (טראק 1, אוסצילטור 1, בלי אפקטים) ......  1 אוסצילטור  → 23.4x מהזמן-אמת
 *   צליל 1 לכל תפקיד + ריוורב + דיליי + סיידצ'יין . 45 אוסצילטורים →  3.9x
 *   4 צלילים לכל תפקיד, שרשרת מלאה ............... 136 אוסצילטורים →  0.6x  ← מתחת לזמן-אמת!
 *
 * כלומר: האפקטים כמעט חינם (3.8x מול 3.9x עם/בלי) — **כל** העלות היא מספר-הקולות
 * (שכבות × unison × פוליפוניה). מתחת ל-1.0x המעבד פשוט לא מספיק לייצר את הדגימות בקצב
 * שהכרטיס-קול צורך אותן — וזה, בהגדרה, חירחור.
 *
 * התובנה: ה-score דטרמיניסטי לחלוטין, באורך קבוע, ומתנגן בלולאה, ושום דבר לא משתנה תוך
 * כדי הניגון (כל שינוי בצורה/סגנון/בחירת-צליל כבר בונה renderer חדש מאפס). אין שום סיבה
 * לסנתז אותו בזמן-אמת. מרנדרים פעם אחת ומשמיעים את ההקלטה — ואז עומס-המעבד בזמן הניגון
 * הוא של קריאת-באפר בלבד, כלומר חירחור נעשה **בלתי-אפשרי מבנית**, בלי קשר לכמה צלילים
 * נבחרו. זה גם מה שמאפשר להמשיך להגדיל את ספריית-הצלילים בלי לשבור את זה שוב.
 *
 * ⭐ "אותו קוד" (§3, §11 Sprint 6) נשמר: משתמש ב-createAllTrackRuntimes/computeDurationSeconds
 * המשותפים — בדיוק כמו browserRenderer.ts ו-serverRenderer.ts. למעשה זה **מחזק** את
 * "פריוויו ≈ פלט סופי", כי עכשיו גם הפריוויו עובר מסלול-רינדור-אופליין, כמו הקובץ הסופי.
 *
 * ⚠️ חסין-סביבה בכוונה (מיוצא מה-index הראשי): משתמש רק ב-'tone', בלי node-web-audio-api.
 * זה ההבדל מ-serverRenderer.ts, שחייב polyfill ולכן חשוף רק דרך "./server".
 */

import { Offline } from 'tone';
import type { MusicalScore } from '@soundiform/core';
import { createMasterBus } from '../mixing/loudness';
import { withGlobalContextLock } from './globalContextLock';
import {
  computeDurationSeconds,
  createAllTrackRuntimes,
  DEFAULT_AUDIO_CONFIG,
  type GenreAudioConfig,
} from './sharedScheduling';

/**
 * ⭐ קצב-הדגימה לרינדור הפריוויו. **לא** משנה את ה-AudioContext החי — זה פרמטר לרינדור
 * האופליין בלבד; Web Audio ממיר קצב אוטומטית כשמשמיעים באפר בקצב אחר מזה של ה-context.
 *
 * 32000 נבחר במפורש (מול 44100): שומר תוכן עד 16kHz — כמעט בלתי-מורגש לרוב האוזניים —
 * תמורת ~פי 1.4 קיצור בזמן-הרינדור ו-~27% פחות זיכרון. ההורדה הסופית (apps/worker) נשארת
 * 44100 מלא ולא מושפעת מכאן בכלל. זו נקודת-הכיוונון הראשונה אם זמן-הרינדור בנייד יתברר ארוך.
 */
export const PREVIEW_SAMPLE_RATE = 32000;

const CHANNEL_COUNT = 2;

export interface OfflineRenderResult {
  /** באפר מוכן-לניגון (AudioBuffer של Web Audio), באורך computeDurationSeconds. */
  buffer: AudioBuffer;
  durationSeconds: number;
  /** ⭐ נמדד בפועל — נחשף ב-AudioDebugHUD כדי שבדיקה בנייד תחזיר מספר, לא רק "עובד/לא". */
  renderMilliseconds: number;
  sampleRate: number;
}

/**
 * מרנדר score שלם לבאפר אודיו יחיד, על OfflineAudioContext של הדפדפן.
 *
 * ⚠️ עובר דרך withGlobalContextLock: `Tone.Offline` מחליף את ה-context הגלובלי לזמן
 * הרינדור (ומשחזר אחריו) — ראה globalContextLock.ts להסבר המלא למה זה חייב להיות סריאלי.
 */
export async function renderScoreToAudioBuffer(
  score: MusicalScore,
  audioConfig: GenreAudioConfig = DEFAULT_AUDIO_CONFIG,
  sampleRate: number = PREVIEW_SAMPLE_RATE,
): Promise<OfflineRenderResult> {
  const durationSeconds = computeDurationSeconds(score, audioConfig);

  return withGlobalContextLock(async () => {
    const startedAtMs = Date.now();
    // ⚠️ disposeAll נלכד מחוץ ל-callback ונקרא רק **אחרי** שהרינדור הסתיים — הצמתים חייבים
    // להישאר חיים לכל אורך הרינדור. (ה-context האופליין עצמו נזרק ממילא אחרי זה, אבל
    // שחרור מפורש שומר על אותו דפוס כמו serverRenderer.ts ולא מסתמך על GC.)
    let disposeAll: (() => void) | null = null;

    const renderedBuffer = await Offline(
      async ({ transport }) => {
        const masterBus = createMasterBus();
        masterBus.toDestination();
        const runtimes = await createAllTrackRuntimes(score, masterBus, audioConfig);
        disposeAll = runtimes.disposeAll;
        transport.bpm.value = score.tempo;
        transport.start();
      },
      durationSeconds,
      CHANNEL_COUNT,
      sampleRate,
    );

    (disposeAll as (() => void) | null)?.();

    const buffer = renderedBuffer.get();
    if (!buffer) {
      throw new Error('רינדור אופליין הסתיים בלי באפר — ToneAudioBuffer ריק');
    }

    return {
      buffer,
      durationSeconds,
      renderMilliseconds: Date.now() - startedAtMs,
      sampleRate: buffer.sampleRate,
    };
  });
}

/**
 * ⭐ מטמון קטן לבאפרים שכבר רונדרו. התרחיש שהוא פותר: המשתמש מדפדף בין בחירות-צליל
 * (בורר-הצלילים) הלוך-ושוב — בלי מטמון, כל חזרה לבחירה קודמת משלמת שוב את מלוא זמן
 * הרינדור. מוגבל ל-2 ערכים בכוונה: כל באפר הוא ~15MB (60 שניות סטריאו ב-32kHz), ובנייד
 * זה המשאב שנגמר ראשון.
 */
const MAX_CACHED_RENDERS = 2;
const renderCache = new Map<string, OfflineRenderResult>();

/**
 * מפתח-מטמון דטרמיניסטי. (seed, genreId) קובעים את ה-score במלואו — הצורה נכנסת דרך ה-seed
 * וה-score נגזר ממנה דטרמיניסטית (§1) — ו-audioConfig קובע את בחירות-הצליל/המיקס. ⚠️ שגיאה
 * במפתח היא לכל היותר החטאה (רינדור מחדש), לא צליל שגוי — אין כאן סיכון לנכונות.
 */
function cacheKey(score: MusicalScore, audioConfig: GenreAudioConfig, sampleRate: number): string {
  return `${score.seed}|${score.genreId}|${String(sampleRate)}|${JSON.stringify(audioConfig)}`;
}

/**
 * כמו renderScoreToAudioBuffer, אבל מחזיר תוצאה מהמטמון כשזמינה. זה מה ש-browserRenderer.ts
 * קורא לו; הגרסה הלא-ממוטמנת נשארת זמינה למי שצריך רינדור טרי מפורש (ולבדיקות).
 */
export async function renderScoreToAudioBufferCached(
  score: MusicalScore,
  audioConfig: GenreAudioConfig = DEFAULT_AUDIO_CONFIG,
  sampleRate: number = PREVIEW_SAMPLE_RATE,
): Promise<OfflineRenderResult & { fromCache: boolean }> {
  const key = cacheKey(score, audioConfig, sampleRate);
  const cached = renderCache.get(key);
  if (cached) {
    // מחדש את מיקומו בסוף התור (Map שומר סדר-הכנסה) — LRU פשוט בלי מבנה-נתונים נוסף.
    renderCache.delete(key);
    renderCache.set(key, cached);
    return { ...cached, fromCache: true };
  }

  const rendered = await renderScoreToAudioBuffer(score, audioConfig, sampleRate);
  renderCache.set(key, rendered);
  while (renderCache.size > MAX_CACHED_RENDERS) {
    const oldestKey = renderCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    renderCache.delete(oldestKey);
  }
  return { ...rendered, fromCache: false };
}
