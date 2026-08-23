/**
 * @file        route.ts
 * @description ⭐ 2026-08-22 (§11 גלריה): מחיקת תגובה — בעל התגובה עצמו, או אדמין
 *              (getAdminUser(), אותו escape-hatch כמו נתיבי admin/moderation אחרים). אין
 *              policy למחיקה ב-RLS בכוונה (ראה comments.ts) — האכיפה כולה כאן, בצד שרת.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { comments, getDb } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/adminAuth';

const paramsSchema = z.object({ id: z.uuid() });

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { id } = parsedParams.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const db = getDb();
  const [comment] = await db
    .select({ userId: comments.userId })
    .from(comments)
    .where(eq(comments.id, id));
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  const isOwnComment = comment.userId === user.id;
  const admin = isOwnComment ? null : await getAdminUser();
  if (!isOwnComment && !admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  await db.delete(comments).where(eq(comments.id, id));
  return NextResponse.json({ deleted: true });
}
