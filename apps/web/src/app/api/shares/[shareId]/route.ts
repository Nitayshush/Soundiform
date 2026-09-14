/**
 * @file        route.ts
 * @description ⭐ 2026-09-04 (מקצה שדרוגים — כפתור פרסום/הסתרה): מחליף בין `public` ל-`private`
 *              על share קיים — הכפתור ב-My Gallery. ראה packages/db/src/schema/shares.ts.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ לא `unlisted` כאן בכוונה: הכפתור מחליף בין שני מצבים בלבד (מוצג/מוסתר), בדיוק כמו
 * ה-visibility שכבר קיים היום ב-useDownload.ts (תמיד 'public'). `unlisted` יישאר ערך תקף
 * בעמודה למי שירצה להשתמש בו בעתיד (למשל שיתוף קישור ישיר בלי הופעה בגלריה), אבל אין לו
 * עדיין נתיב UI — לא מוסיפים אותו לכפתור בלי שיש לו שימוש אמיתי.
 *
 * ⚠️ בעלות: אותו תבנית join בדיוק כמו api/shares/route.ts (renders→projects) — share לא
 * נושא user_id ישיר.
 *
 * ⭐ 2026-09-13 (לפי בקשה חיה): DELETE — מחיקה מלאה של כרטיס-יצירה מ-My Gallery. ברמת
 * ה-render/share, **לא** ברמת הפרויקט: כל הורדה יוצרת render+share חדשים (client/complete,
 * api/shares/route.ts) בלי לגעת ב-renders קודמים של אותו פרויקט — פרויקט אחד יכול לצבור
 * כמה כרטיסים (למשל אותו ציור שהורד גם ב-Trance וגם ב-House). מחיקה ברמת-הפרויקט הייתה
 * מוחקת בטעות כרטיסים-אחים שהמשתמש לא ביקש למחוק. הפרויקט עצמו נמחק *רק* אם זה היה ה-render
 * האחרון שלו (אחרת הוא נשאר, נגיש דרך שאר הכרטיסים).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { count, eq } from 'drizzle-orm';
import {
  comments,
  getDb,
  likes,
  moderationQueue,
  projects,
  remixes,
  renders,
  shares,
} from '@soundiform/db';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import { createClient } from '@/lib/supabase/server';

const patchShareSchema = z.object({
  visibility: z.enum(['public', 'private']),
});

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { shareId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = patchShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const [row] = await db
    .select({ ownerId: projects.userId })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(eq(shares.id, shareId));

  if (!row || row.ownerId !== user.id) {
    // ⚠️ 404 ולא 403 — לא מדליפים את עצם קיומו של share שאינו שייך למשתמש.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.update(shares).set({ visibility: parsed.data.visibility }).where(eq(shares.id, shareId));

  return NextResponse.json({ visibility: parsed.data.visibility }, { status: 200 });
}

/**
 * ⚠️ מחיקה מלאה, לא soft-delete — לפי בקשה מפורשת (2026-09-13). קישור השיתוף מחזיר 404
 * מיד אחרי, לא רק "לא מפורסם" (זה כבר קיים דרך visibility='private' — זה שונה, בכוונה).
 *
 * ⚠️ סדר המחיקה: אין onDelete cascade על אף FK כאן (בכוונה — ראה schema), אז מוחקים ידנית
 * מהעלה-תלוי לעלה-הבסיס: comments/likes/remixes(כ-parent) לפני ה-render עצמו. remixes
 * שבהם ה-render הזה הוא ה-parent נמחקים (רק שורת-הקשר — לא היצירה של מי שעשה רמיקס, זו
 * יצירה עצמאית משלו).
 *
 * ⚠️ הפרויקט נמחק *רק* אם זה היה ה-render האחרון שלו — אחרת הוא נשאר נגיש דרך שאר הכרטיסים
 * (ראה ⭐ למעלה). כשהוא כן נמחק, מנקים גם remixes(כ-child)/moderationQueue שתלויים בו,
 * ואת uploadKey/thumbnailKey שלו מ-R2.
 */
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { shareId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      ownerId: projects.userId,
      projectId: projects.id,
      projectUploadKey: projects.uploadKey,
      projectThumbnailKey: projects.thumbnailKey,
      renderId: renders.id,
      audioKey: renders.audioKey,
      mp3Key: renders.mp3Key,
      videoKey: renders.videoKey,
      posterKey: renders.posterKey,
      midiKey: renders.midiKey,
      stemKeys: renders.stemKeys,
    })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(eq(shares.id, shareId));

  if (!row || row.ownerId !== user.id) {
    // ⚠️ 404 ולא 403 — לא מדליפים את עצם קיומו של share שאינו שייך למשתמש.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let projectAlsoDeleted = false;

  await db.transaction(async (tx) => {
    await tx.delete(comments).where(eq(comments.renderId, row.renderId));
    await tx.delete(likes).where(eq(likes.renderId, row.renderId));
    await tx.delete(remixes).where(eq(remixes.parentRenderId, row.renderId));
    await tx.delete(shares).where(eq(shares.id, shareId));
    await tx.delete(renders).where(eq(renders.id, row.renderId));

    const [remaining] = await tx
      .select({ total: count() })
      .from(renders)
      .where(eq(renders.projectId, row.projectId));
    if ((remaining?.total ?? 0) === 0) {
      await tx.delete(remixes).where(eq(remixes.childProjectId, row.projectId));
      await tx.delete(moderationQueue).where(eq(moderationQueue.projectId, row.projectId));
      await tx.delete(projects).where(eq(projects.id, row.projectId));
      projectAlsoDeleted = true;
    }
  });

  // ⚠️ ניקוי R2 אחרי שה-DB כבר מחק בהצלחה (best-effort — כישלון-ניקוי-אחסון לא אמור להחזיר
  // שגיאה למשתמש; היצירה כבר נעלמה מהאפליקציה, וזה מה שחשוב לו).
  const keysToDelete = [
    row.audioKey,
    row.mp3Key,
    row.videoKey,
    row.posterKey,
    row.midiKey,
    ...Object.values(row.stemKeys ?? {}),
    ...(projectAlsoDeleted ? [row.projectUploadKey, row.projectThumbnailKey] : []),
  ].filter((key): key is string => Boolean(key));

  if (keysToDelete.length > 0) {
    const storage = createR2ProviderFromEnv();
    await Promise.allSettled(keysToDelete.map((key) => storage.deleteObject(key)));
  }

  return NextResponse.json({ success: true });
}
