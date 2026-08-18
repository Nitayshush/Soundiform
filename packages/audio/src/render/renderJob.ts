/**
 * @file        renderJob.ts
 * @description ⭐ החוזה המשותף בין apps/web (מפיק job) ל-apps/worker (צורך job) — שם התור
 *              וצורת ה-payload. אין ל-apps לייבא זה מזה (כל app deployable נפרד), אז החוזה
 *              חי כאן: שניהם כבר תלויים ב-@shape-sound/audio, וה-payload בנוי כולו מטיפוסים
 *              שכבר מוגדרים כאן/ב-core — בלי לתלות בשום דבר Node-only (זה בנתיב הראשי, לא "./server").
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { MusicalScore } from '@shape-sound/core';
import type { GenreAudioConfig } from './sharedScheduling';

/** שם התור ב-BullMQ — חייב להיות זהה בין ה-Queue (apps/web) וה-Worker (apps/worker). */
export const RENDER_QUEUE_NAME = 'render-audio';

/**
 * ה-score וה-audioConfig מחושבים ב-apps/web (היחיד שתלוי ב-@shape-sound/genres דרך
 * genreAdapter.ts) *לפני* ההוספה לתור — apps/worker רק מרנדר, לא בוחר סגנון.
 */
export interface RenderJobData {
  score: MusicalScore;
  audioConfig: GenreAudioConfig;
}

export interface RenderJobResult {
  wavKey: string;
  mp3Key: string;
  midiKey: string;
}
