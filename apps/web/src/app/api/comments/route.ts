/**
 * @file        route.ts
 * @description ⭐ 2026-08-22 (§11 גלריה): תגובות על render — GET (רשימה, ציבורי) + POST
 *              (יצירה, מחייב session). userId נלקח תמיד מה-session, לעולם לא מגוף הבקשה.
 *              ראה packages/db/src/schema/comments.ts.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { comments, getDb, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';

const MAX_COMMENT_LENGTH = 1000;

const querySchema = z.object({ renderId: z.uuid() });
const createCommentSchema = z.object({
  renderId: z.uuid(),
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
});

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ renderId: url.searchParams.get('renderId') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.renderId, parsed.data.renderId))
    .orderBy(desc(comments.createdAt));

  return NextResponse.json({ comments: rows });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const [comment] = await db
    .insert(comments)
    .values({ renderId: parsed.data.renderId, userId: user.id, body: parsed.data.body })
    .returning();
  if (!comment) {
    throw new Error('Failed to create comment — no row returned');
  }

  return NextResponse.json({ comment }, { status: 201 });
}
