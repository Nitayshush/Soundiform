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
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, projects, renders, shares } from '@soundiform/db';
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
