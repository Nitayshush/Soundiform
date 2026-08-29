/**
 * @file        clientRenderContract.ts
 * @description ⭐ 2026-08-29: הלוגיקה המשותפת לשתי נקודות ה-API של הרינדור-במכשיר
 *              (client/start ו-client/complete) — הרשאות, plan, וחישוב ה-score.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ §0.3 — לעולם לא לסמוך על הקליינט: **שתי** הנקודות מחשבות את ה-score מחדש בשרת מתוך
 * projectId+genreId (דטרמיניסטי, §1), ואף אחת מהן לא מקבלת score/watermark/quality מהקליינט.
 * כך שגם אם הקליינט יעלה וידאו כלשהו, מה שנרשם ב-DB הוא תמיד ה-score האמיתי של הפרויקט,
 * ורמת-האיכות/הווטרמארק נגזרות מה-plan בלבד — בדיוק כמו במסלול ה-worker (api/render/route.ts).
 */

import { eq } from 'drizzle-orm';
import { geometryToMusic, composeMusicalScore, type MusicalScore } from '@soundiform/core';
import type { GenreAudioConfig, VideoQuality } from '@soundiform/audio';
import type { ShapeData } from '@soundiform/shared';
import { genrePacks, getDb, projects, resolveEffectivePlan, type Plan } from '@soundiform/db';
import { toCompositionConfig, toGenreAudioConfig } from '@/lib/genreAdapter';

/** ⚠️ חייב להישאר זהה ל-api/render/route.ts — אותה מדיניות, שני מסלולי רינדור. */
export const PLAN_VIDEO_QUALITY: Record<Plan, VideoQuality> = {
  free: '720p',
  pro: '1080p',
  studio: '4k',
};
export const PLAN_VIDEO_WATERMARK: Record<Plan, boolean> = {
  free: true,
  pro: false,
  studio: false,
};

export interface ResolvedClientRender {
  plan: Plan;
  score: MusicalScore;
  audioConfig: GenreAudioConfig;
  shapeData: ShapeData;
  shapeHash: string;
  /** אותה מוסכמה בדיוק כמו ה-worker (jobs/renderAudio.ts) — קבצים באותו מקום. */
  keyPrefix: string;
}

export type ResolveFailure = { error: string; status: 400 | 403 | 404 };

/**
 * מאמת בעלות על הפרויקט ומחזיר את כל מה שצריך כדי לרנדר — או שגיאה מוכנה-לתשובה.
 */
export async function resolveClientRender(
  userId: string,
  projectId: string,
  genreId: string,
  soundSelections: Parameters<typeof toGenreAudioConfig>[2],
): Promise<ResolvedClientRender | ResolveFailure> {
  const db = getDb();

  const [genrePackRow] = await db
    .select({ config: genrePacks.config })
    .from(genrePacks)
    .where(eq(genrePacks.id, genreId));
  const genrePack = genrePackRow?.config;
  if (!genrePack) {
    return { error: `Genre not found: ${genreId}`, status: 400 };
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project || project.userId !== userId) {
    return { error: 'Project not found', status: 404 };
  }

  const { plan } = await resolveEffectivePlan(userId);
  const intent = geometryToMusic(project.shapeData, project.shapeHash);
  const score = composeMusicalScore(intent, toCompositionConfig(genrePack));

  return {
    plan,
    score,
    audioConfig: toGenreAudioConfig(genrePack, intent.seed, soundSelections),
    shapeData: project.shapeData,
    shapeHash: project.shapeHash,
    keyPrefix: `renders/${score.seed}/${score.genreId}`,
  };
}

export function isResolveFailure(
  value: ResolvedClientRender | ResolveFailure,
): value is ResolveFailure {
  return 'error' in value;
}
