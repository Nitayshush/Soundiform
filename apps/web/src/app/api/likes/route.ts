/**
 * @file        route.ts
 * @description ⭐ 2026-08-22 (§11 גלריה): לייק/ביטול-לייק. userId נלקח תמיד מה-session
 *              המאומת — לעולם לא מגוף הבקשה (אותו עיקרון בדיוק כמו api/follows/route.ts).
 *              ראה packages/db/src/schema/likes.ts.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { likes, getDb } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';

const likeBodySchema = z.object({
  renderId: z.uuid(),
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
  const parsed = likeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { renderId } = parsed.data;
  const db = getDb();
  await db.insert(likes).values({ userId: user.id, renderId }).onConflictDoNothing();

  return NextResponse.json({ liked: true }, { status: 201 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = likeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { renderId } = parsed.data;
  const db = getDb();
  await db.delete(likes).where(and(eq(likes.userId, user.id), eq(likes.renderId, renderId)));

  return NextResponse.json({ liked: false });
}
