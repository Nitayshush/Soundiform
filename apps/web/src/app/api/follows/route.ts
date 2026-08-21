/**
 * @file        route.ts
 * @description ⭐ עקוב/בטל-מעקב. follower_id נלקח תמיד מה-session המאומת — לעולם לא מגוף
 *              הבקשה (אחרת כל אחד היה יכול "לעקוב בשם" משתמש אחר). ראה follows.ts.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { follows, getDb } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';

const followBodySchema = z.object({
  followingId: z.uuid(),
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
  const parsed = followBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { followingId } = parsed.data;
  if (followingId === user.id) {
    return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });
  }

  const db = getDb();
  await db.insert(follows).values({ followerId: user.id, followingId }).onConflictDoNothing();

  return NextResponse.json({ following: true }, { status: 201 });
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
  const parsed = followBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { followingId } = parsed.data;
  const db = getDb();
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, user.id), eq(follows.followingId, followingId)));

  return NextResponse.json({ following: false });
}
