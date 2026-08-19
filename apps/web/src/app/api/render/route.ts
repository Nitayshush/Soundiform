/**
 * @file        route.ts
 * @description הפעלת רנדור אודיו/וידאו — מעביר עבודה ל-worker דרך BullMQ. ראה PROJECT.md §11 Sprint 6/8.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ ה-score נבנה כאן, בשרת — לא מתקבל מהקליינט. אותה סיבה כמו הצורך ב-serverRenderer:
 * המקור-האמת לרינדור הסופי (וחיוב עתידי) חייב להיות דטרמיניסטי ולא-נתון-למניפולציה מהדפדפן.
 *
 * ⭐ Sprint 8: דורש התחברות + projectId קיים ובבעלות המשתמש (§9: לא ניתן לשתף יצירה
 * לא-שמורה — ראה renderJob.ts). איכות/watermark הווידאו נקבעים משרת לפי plan, לא מהקליינט
 * (§0.3: לעולם לא לסמוך על קליינט למכסות/הרשאות) — הקליינט יכול לבחור רק aspectRatio.
 *
 * ⚠️ נכתב אבל לא נבדק חי מקצה-לקצה בסשן הזה — אין Redis מקומי/Upstash זמין (הוחלט מראש
 * כחלק מהיקף Sprint 6 המאושר, עדיין נכון ל-Sprint 8).
 *
 * TODO(Sprint 8+): rate limiting אנונימי (§8: 3/שעה) — דורש תשתית IP-tracking/Redis נפרדת.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { geometryToMusic, composeMusicalScore } from '@shape-sound/core';
import { loadGenrePackById } from '@shape-sound/genres';
import { VIDEO_ASPECT_RATIOS, type VideoQuality } from '@shape-sound/audio';
import {
  checkCreationQuota,
  getDb,
  projects,
  recordLedgerEntry,
  users,
  type Plan,
} from '@shape-sound/db';
import { toCompositionConfig, toGenreAudioConfig } from '@/lib/genreAdapter';
import { enqueueRenderJob } from '@/lib/renderQueue';
import { createClient } from '@/lib/supabase/server';

const PLAN_VIDEO_QUALITY: Record<Plan, VideoQuality> = {
  free: '720p',
  pro: '1080p',
  studio: '4k',
};
const PLAN_VIDEO_WATERMARK: Record<Plan, boolean> = {
  free: true,
  pro: false,
  studio: false,
};

const renderRequestSchema = z.object({
  projectId: z.uuid(),
  genreId: z.string().min(1),
  video: z.object({ aspectRatio: z.enum(VIDEO_ASPECT_RATIOS) }).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = renderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'בקשה לא תקינה', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { projectId, genreId, video } = parsed.data;
  const genrePack = loadGenrePackById(genreId);
  if (!genrePack) {
    return NextResponse.json({ error: `סגנון לא נמצא: ${genreId}` }, { status: 400 });
  }

  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: 'פרויקט לא נמצא' }, { status: 404 });
  }

  const [userRow] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, user.id));
  const plan = userRow?.plan ?? 'free';

  const quota = await checkCreationQuota(user.id, plan);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `הגעת למכסת היצירות (${String(quota.limit)}) של תוכנית ${plan}`, quota },
      { status: 403 },
    );
  }

  const intent = geometryToMusic(project.shapeData, project.shapeHash);
  const score = composeMusicalScore(intent, toCompositionConfig(genrePack));
  const audioConfig = toGenreAudioConfig(genrePack);

  const jobId = await enqueueRenderJob({
    projectId,
    score,
    audioConfig,
    ...(video && { shape: project.shapeData }),
    ...(video && {
      video: {
        aspectRatio: video.aspectRatio,
        quality: PLAN_VIDEO_QUALITY[plan],
        watermark: PLAN_VIDEO_WATERMARK[plan],
      },
    }),
  });

  await recordLedgerEntry(user.id, -1, 'render');

  return NextResponse.json({ jobId, shapeHash: project.shapeHash }, { status: 202 });
}
