/**
 * @file        route.ts
 * @description ⭐ 2026-08-29: פותח רינדור **במכשיר** — מאמת הרשאות, קובע איכות/ווטרמארק
 *              לפי plan, מחייב קרדיט, ומחזיר את ה-score + כתובות העלאה חתומות ל-R2.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ למה המסלול הזה קיים: ה-worker לא פרוס בשום מקום ורץ בפועל על מחשב מקומי, ולכן
 * ההורדות לקחו דקות. מדידה על אנדרואיד הראתה שקידוד H.264 בדפדפן רץ ב-2.13x מהזמן-אמת
 * (בחומרה) — מהר בסדר-גודל. הרינדור עבר למכשיר, והשרת נשאר **הסמכות** על מי מורשה,
 * מה האיכות, והאם יש ווטרמארק (§0.3).
 *
 * ⚠️ ה-score מוחזר מכאן ולא מחושב בקליינט בפני עצמו — כדי שמה שמקודד המכשיר יהיה בדיוק
 * מה שהשרת ירשום ב-DB ב-complete. שניהם מחשבים אותו מאותם קלטים דטרמיניסטיים (§1).
 *
 * ⚠️ presigned PUT מאפשר לקליינט להעלות תוכן כרצונו — ולכן שורת ה-renders **לא** נכתבת
 * כאן, אלא רק ב-complete, ורק אחרי אימות שהקבצים באמת קיימים (headObject).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { trackRoleSchema } from '@soundiform/core';
import { VIDEO_ASPECT_RATIOS } from '@soundiform/audio';
import { checkCreationQuota, recordLedgerEntry } from '@soundiform/db';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import {
  PLAN_VIDEO_QUALITY,
  PLAN_VIDEO_WATERMARK,
  isResolveFailure,
  resolveClientRender,
} from '@/lib/clientRenderContract';
import { createClient } from '@/lib/supabase/server';

const startRequestSchema = z.object({
  projectId: z.uuid(),
  genreId: z.string().min(1),
  aspectRatio: z.enum(VIDEO_ASPECT_RATIOS),
  // ⚠️ 2026-08-29 (באג אמיתי שנתפס בבדיקה חיה — "Invalid request"): **בלי** .min(1) על המערך.
  // ביטול-בחירה של הצליל האחרון לתפקיד משאיר מערך ריק (soundSelectionStore.ts), וזה מצב
  // חוקי לגמרי — resolveSynthPresets כבר מפרש אותו כ"אין בחירה, קח ברירת מחדל". הסכימה
  // היא זו שדחתה, וכך נשברה כל ההורדה אחרי ביטול-בחירה.
  soundSelections: z.partialRecord(trackRoleSchema, z.array(z.string().min(1))).optional(),
});

/** תוקף קצר בכוונה — §7 מגדיר 15 דקות להעלאות; הרינדור בנייד נמדד בעשרות שניות. */
const UPLOAD_URL_TTL_SECONDS = 900;

const UPLOAD_TARGETS = [
  { name: 'video', suffix: 'output.mp4', contentType: 'video/mp4' },
  { name: 'poster', suffix: 'poster.jpg', contentType: 'image/jpeg' },
  { name: 'audio', suffix: 'output.wav', contentType: 'audio/wav' },
  { name: 'mp3', suffix: 'output.mp3', contentType: 'audio/mpeg' },
  { name: 'midi', suffix: 'output.mid', contentType: 'audio/midi' },
] as const;

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = startRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { projectId, genreId, aspectRatio, soundSelections } = parsed.data;
  const resolved = await resolveClientRender(user.id, projectId, genreId, soundSelections);
  if (isResolveFailure(resolved)) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const quota = await checkCreationQuota(user.id, resolved.plan);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `You've reached the creation limit (${String(quota.limit)}) for the ${resolved.plan} plan`,
        quota,
      },
      { status: 403 },
    );
  }

  const storage = createR2ProviderFromEnv();
  const uploads: Record<string, { key: string; url: string }> = {};
  for (const target of UPLOAD_TARGETS) {
    const key = `${resolved.keyPrefix}/${target.suffix}`;
    uploads[target.name] = {
      key,
      url: await storage.getUploadUrl(key, {
        contentType: target.contentType,
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      }),
    };
  }

  await recordLedgerEntry(user.id, -1, 'render');

  return NextResponse.json(
    {
      score: resolved.score,
      audioConfig: resolved.audioConfig,
      shapeData: resolved.shapeData,
      video: {
        aspectRatio,
        quality: PLAN_VIDEO_QUALITY[resolved.plan],
        watermark: PLAN_VIDEO_WATERMARK[resolved.plan],
      },
      // ⚠️ ה-plan מוחזר לתצוגה בלבד (איזה קבצים בכלל שווה להעלות) — לא מחליף שום בדיקת-שרת.
      plan: resolved.plan,
      uploads,
    },
    { status: 200 },
  );
}
