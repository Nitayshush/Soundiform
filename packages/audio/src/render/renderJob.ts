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
import type { ShapeData } from '@shape-sound/shared';
import type { GenreAudioConfig } from './sharedScheduling';

/** שם התור ב-BullMQ — חייב להיות זהה בין ה-Queue (apps/web) וה-Worker (apps/worker). */
export const RENDER_QUEUE_NAME = 'render-audio';

export const VIDEO_ASPECT_RATIOS = ['9:16', '16:9', '1:1'] as const;
export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];

export const VIDEO_QUALITIES = ['720p', '1080p', '4k'] as const;
export type VideoQuality = (typeof VIDEO_QUALITIES)[number];

/** לפי §9: חינם=720p ממותג, Pro=1080p, Studio=4K נקי. */
export interface VideoExportOptions {
  aspectRatio: VideoAspectRatio;
  quality: VideoQuality;
  watermark: boolean;
}

/**
 * ה-score וה-audioConfig מחושבים ב-apps/web (היחיד שתלוי ב-@shape-sound/genres דרך
 * genreAdapter.ts) *לפני* ההוספה לתור — apps/worker רק מרנדר, לא בוחר סגנון.
 *
 * ⭐ Sprint 8: projectId חובה — כדי ש-apps/worker יוכל לכתוב שורת renders אמיתית (§6),
 * שדף השיתוף/גלריה/רמיקס נשענים עליה. אין רינדור בלי פרויקט שמור (§9: לא ניתן לשתף
 * יצירה אנונימית/לא-שמורה). shape+video אופציונליים: בלי video, זה רינדור אודיו בלבד
 * (כמו Sprint 6) — shape נחוץ רק אם video מבוקש (מצייר את הפריימים).
 */
export interface RenderJobData {
  projectId: string;
  score: MusicalScore;
  audioConfig: GenreAudioConfig;
  shape?: ShapeData;
  video?: VideoExportOptions;
}

export interface RenderJobResult {
  renderId: string;
  wavKey: string;
  mp3Key: string;
  midiKey: string;
  videoKey?: string;
}
