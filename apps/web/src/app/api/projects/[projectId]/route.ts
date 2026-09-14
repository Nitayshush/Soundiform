/**
 * @file        route.ts
 * @description ⭐ 2026-09-12: עדכון title/description/keywords של פרויקט קיים —
 *              CreationDetailsModal.tsx כותב לכאן אחרי שהרינדור מסתיים (ראה useDownload.ts),
 *              וגם מ-My Gallery/My Drafts דרך EditDetailsButton.tsx (עריכת יצירה קיימת).
 *              ⚠️ מחיקת-כרטיס-ברינדור **לא** כאן — פרויקט אחד יכול לצבור כמה renders/shares
 *              (כל הורדה יוצרת render חדש, ראה api/render/client/complete/route.ts), אז
 *              מחיקה ברמת-הפרויקט הייתה מוחקת בטעות כרטיסים אחרים ב-My Gallery. DELETE שם
 *              נמצא ב-api/shares/[shareId]/route.ts — ברמת הכרטיס.
 *              ⭐ 2026-09-13: DELETE **כאן** קיים בכל זאת — אבל מוגבל אך ורק לטיוטות (My
 *              Drafts): פרויקט בלי אף render. לטיוטה אין אף כרטיס-אח ב-Gallery שעלול
 *              להימחק בטעות, אז מחיקה ברמת-הפרויקט בטוחה בדיוק כאן. אם יש כבר render — 409,
 *              עם הודעה שמפנה למחוק דרך My Gallery במקום.
 * @author      Soundiform
 * @created     2026-09-12
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בעלות: אותו תבנית בדיוק כמו api/shares/[shareId]/route.ts — 404 (לא 403) למי שאינו
 * הבעלים, כדי לא לדלוף את עצם קיומו של פרויקט שאינו נגיש.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, moderationQueue, projects, remixes, renders } from '@soundiform/db';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import { createClient } from '@/lib/supabase/server';

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    keywords: z.string().max(500).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No field to update was sent' });

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const [existing] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!existing || existing.userId !== user.id) {
    // ⚠️ 404 ולא 403 — לא מדליפים את עצם קיומו של פרויקט שאינו שייך למשתמש.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { title, description, keywords } = parsed.data;
  const [updated] = await db
    .update(projects)
    .set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(keywords !== undefined && { keywords }),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning({
      id: projects.id,
      title: projects.title,
      description: projects.description,
      keywords: projects.keywords,
    });

  return NextResponse.json({ project: updated });
}

/**
 * ⚠️ מחיקת-טיוטה בלבד — ראה ⭐ 2026-09-13 למעלה. 404 (לא 403) על בעלות זרה, 409 אם כבר
 * יש render (כדי לא ליצור מחיקה-ברמת-פרויקט על משהו שכבר "אמיתי" ב-My Gallery).
 */
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const db = getDb();
  const [existing] = await db
    .select({
      userId: projects.userId,
      uploadKey: projects.uploadKey,
      thumbnailKey: projects.thumbnailKey,
    })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!existing || existing.userId !== user.id) {
    // ⚠️ 404 ולא 403 — לא מדליפים את עצם קיומו של פרויקט שאינו שייך למשתמש.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [renderCount] = await db
    .select({ id: renders.id })
    .from(renders)
    .where(eq(renders.projectId, projectId))
    .limit(1);
  if (renderCount) {
    return NextResponse.json(
      { error: 'This creation has already been rendered — delete it from My Gallery instead' },
      { status: 409 },
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(remixes).where(eq(remixes.childProjectId, projectId));
    await tx.delete(moderationQueue).where(eq(moderationQueue.projectId, projectId));
    await tx.delete(projects).where(eq(projects.id, projectId));
  });

  const keysToDelete = [existing.uploadKey, existing.thumbnailKey].filter((key): key is string =>
    Boolean(key),
  );
  if (keysToDelete.length > 0) {
    const storage = createR2ProviderFromEnv();
    await Promise.allSettled(keysToDelete.map((key) => storage.deleteObject(key)));
  }

  return NextResponse.json({ success: true });
}
