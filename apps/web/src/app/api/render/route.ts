/**
 * @file        route.ts
 * @description הפעלת רנדור אודיו/וידאו — מעביר עבודה ל-worker דרך BullMQ. ראה PROJECT.md §11 Sprint 6/8.
 * @author      Soundiform
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
 * ⭐ Sprint 9: הסגנון נטען מ-genre_packs ב-DB (Drizzle), לא מ-@soundiform/genres הסטטי —
 * ראה api/genres/route.ts. כך עריכת GenrePack באדמין משפיעה גם על הרינדור הסופי בשרת.
 *
 * TODO(Sprint 8+): rate limiting אנונימי (§8: 3/שעה) — דורש תשתית IP-tracking/Redis נפרדת.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { geometryToMusic, composeMusicalScore, trackRoleSchema } from '@soundiform/core';
import { VIDEO_ASPECT_RATIOS, type VideoQuality } from '@soundiform/audio';
import {
  checkCreationQuota,
  genrePacks,
  getDb,
  projects,
  recordLedgerEntry,
  resolveEffectivePlan,
  type Plan,
} from '@soundiform/db';
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
  /**
   * ⭐ 2026-08-24 (Area 1), מורחב 2026-08-25 (בחירת-צליל מרובה): בחירת-צליל לפי תפקיד
   * (SoundSelector.tsx) — עכשיו מערך id-ים (כמה תתי-צלילים ביחד), לא id בודד. לא סומכים על
   * id שרירותי; מאמתים למטה שכל אחד באמת קיים ב-genrePack.soundOptions[role] לפני שימוש
   * (§0.3: לעולם לא לסמוך על קליינט למכסות/הרשאות — אותו עיקרון חל גם על תוכן).
   */
  soundSelections: z.partialRecord(trackRoleSchema, z.array(z.string().min(1)).min(1)).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = renderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { projectId, genreId, video, soundSelections } = parsed.data;
  const db = getDb();

  const [genrePackRow] = await db
    .select({ config: genrePacks.config })
    .from(genrePacks)
    .where(eq(genrePacks.id, genreId));
  const genrePack = genrePackRow?.config;
  if (!genrePack) {
    return NextResponse.json({ error: `Genre not found: ${genreId}` }, { status: 400 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { plan } = await resolveEffectivePlan(user.id);

  const quota = await checkCreationQuota(user.id, plan);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `You've reached the creation limit (${String(quota.limit)}) for the ${plan} plan`,
        quota,
      },
      { status: 403 },
    );
  }

  const intent = geometryToMusic(project.shapeData, project.shapeHash);
  const score = composeMusicalScore(intent, toCompositionConfig(genrePack));
  // ⭐ 2026-08-24 (Area 1): toGenreAudioConfig עצמו כבר מאמת כל id מול genrePack.soundOptions
  // (genreAdapter.ts's resolveSynthPresets) — id לא-קיים נופל בשקט ל-synthMap הרגיל, אף פעם
  // לא נכשל/נזרק. אין כאן עוד ולידציה נדרשת מעבר לזו שכבר ב-renderRequestSchema (טיפוס התפקיד).
  const audioConfig = toGenreAudioConfig(genrePack, intent.seed, soundSelections);

  const jobId = await enqueueRenderJob({
    projectId,
    score,
    audioConfig,
    shapeData: project.shapeData,
    stems: plan === 'studio',
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
