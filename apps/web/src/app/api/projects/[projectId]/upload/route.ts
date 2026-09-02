/**
 * @file        route.ts
 * @description ⭐ 2026-09-02: מגיש בחזרה את **הקובץ המקורי** שהמשתמש העלה (`projects.upload_key`),
 *              כ-signed URL. זה מה שמאפשר להציג את התמונה שלו בדף השיתוף, בגלריה, ואחרי רענון.
 * @author      Soundiform
 * @created     2026-09-02
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **הגישה נקבעת לפי הפרויקט, לעולם לא לפי מפתח שהקליינט שולח.** המפתחות יושבים תחת
 * `uploads/<owner>/<uuid>.<ext>`, ונתיב שהיה מקבל מפתח מהקליינט היה מאפשר לקרוא העלאות של
 * אחרים ע"י ניחוש. לכן הקלט היחיד הוא `projectId`, וההרשאה נבדקת מולו — בדיוק כמו
 * `api/renders/[renderId]/download`.
 *
 * ⚠️ מדיניות הגישה זהה לזו של ה-render: **הבעלים**, או **כל מי שיש share** ליצירה. זה נכון
 * מהותית — התמונה המקורית ממילא מוצגת בכל מקום שבו היצירה מוצגת (§11 גלריה), ולכן הסתרתה
 * דווקא כאן הייתה חוסמת את התכונה בלי להוסיף שום הגנה.
 *
 * ⚠️ תמיד `inline` — זו תמונה שנטענת ל-<img src>, אף פעם לא "הורדה". אותה החלטה בדיוק כמו
 * `poster` בנתיב ההורדה של ה-renders.
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, projects, renders, shares } from '@soundiform/db';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { projectId } = await params;

  const db = getDb();
  const [project] = await db
    .select({ uploadKey: projects.uploadKey, ownerId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!project.uploadKey) {
    // ⚠️ 404 ולא 204: ליצירה מצוירת-ביד פשוט אין קובץ מקורי, וזה מצב תקין לחלוטין —
    // הקורא (דף השיתוף/הגלריה) פשוט לא מציג שכבת תמונה.
    return NextResponse.json({ error: 'No original file for this project' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id !== project.ownerId) {
    const [shareRow] = await db
      .select({ slug: shares.slug })
      .from(shares)
      .innerJoin(renders, eq(shares.renderId, renders.id))
      .where(eq(renders.projectId, projectId));
    if (!shareRow) {
      // ⚠️ 404 ולא 403 — לא מדליפים את עצם קיומו של פרויקט שאינו נגיש.
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  const storage = createR2ProviderFromEnv();
  const signedUrl = await storage.getDownloadUrl(project.uploadKey);
  return NextResponse.redirect(signedUrl);
}
