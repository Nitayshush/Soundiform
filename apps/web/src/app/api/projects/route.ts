/**
 * @file        route.ts
 * @description CRUD על פרויקטים (צורות שמורות). ראה PROJECT.md §6 טבלת projects.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי (§9): זו הנקודה שממשת "היצירה עוברת אוטומטית לחשבון" — הקליינט (studio page)
 * קורא ל-POST הזה עם ה-shape שהיה ב-localStorage, מיד אחרי שמשתמש אנונימי נרשם/מתחבר.
 * המכסה (§9: 5 שמורות בחינם) נאכפת כאן, בצד שרת בלבד — לא בקליינט (§0.3).
 *
 * ⚠️ getDb() (Drizzle, מחובר כ-postgres owner role) עוקף RLS — זה תקין ומכוון: השרת הוא
 * ה"privileged" side, ו-RLS מגן על גישה ישירה מהקליינט (Supabase client עם anon/authenticated
 * role), לא על הקוד הזה. הבעלות (user.id) נלקחת מה-session המאומת, לא מגוף הבקשה.
 *
 * ⭐ Sprint 8: remixOf (אופציונלי) — כפתור Remix בדף שיתוף טוען את הצורה ל-shapeStore ומעביר
 * ל-studio; ברגע שהפרויקט-הבן נשמר כאן, נרשמת שורת remixes (§9 "כל צופה הופך ליוצר בקליק").
 *
 * ⭐ Sprint 9: sourceType !== 'drawing' (כלומר svg/raster, מגיע מ-api/upload) → נרשמת שורת
 * moderation_queue (status='pending') — זה קורה כאן ולא ב-api/upload, כי לשורת המודרציה יש
 * project_id NOT NULL (ראה moderationQueue.ts) שעדיין לא קיים בשלב ההעלאה עצמה.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { shapeDataSchema } from '@soundiform/shared';
import {
  checkSaveQuota,
  getDb,
  moderationQueue,
  projects,
  recordLedgerEntry,
  remixes,
  renders,
  users,
} from '@soundiform/db';
import { eq, isNull, and, desc } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

const createProjectSchema = z.object({
  shape: shapeDataSchema,
  shapeHash: z.string().min(1),
  sourceType: z.enum(['drawing', 'svg', 'raster']),
  uploadKey: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  remixOf: z.uuid().optional(),
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
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'בקשה לא תקינה', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const [userRow] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, user.id));
  const plan = userRow?.plan ?? 'free';

  const quota = await checkSaveQuota(user.id, plan);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `הגעת למכסת השמירות (${String(quota.limit)}) של תוכנית ${plan}`, quota },
      { status: 403 },
    );
  }

  const { shape, shapeHash, sourceType, uploadKey, title, remixOf } = parsed.data;
  const [project] = await db
    .insert(projects)
    .values({
      userId: user.id,
      shapeData: shape,
      shapeHash,
      sourceType,
      ...(uploadKey !== undefined && { uploadKey }),
      ...(title !== undefined && { title }),
    })
    .returning();
  if (!project) {
    throw new Error('יצירת פרויקט נכשלה — לא הוחזרה שורה');
  }

  await recordLedgerEntry(user.id, -1, 'project_save');

  if (sourceType !== 'drawing') {
    await db.insert(moderationQueue).values({ projectId: project.id, status: 'pending' });
  }

  if (remixOf) {
    const [parentRender] = await db.select().from(renders).where(eq(renders.id, remixOf));
    if (parentRender) {
      await db.insert(remixes).values({ parentRenderId: remixOf, childProjectId: project.id });
    }
  }

  return NextResponse.json({ project }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }

  const db = getDb();
  const myProjects = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, user.id), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt));

  return NextResponse.json({ projects: myProjects });
}
