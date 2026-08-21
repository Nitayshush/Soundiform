/**
 * @file        route.ts
 * @description ⭐ עריכת פרופיל (username/display_name/avatar_url) — הנתיב היחיד שמותר לו
 *              לעדכן שורת users, בדיוק כפי שדורש ההערה ב-users.ts: RLS בכוונה בלי UPDATE
 *              policy למשתמש, כי plan לא יכול להיות client-writable. getDb() כאן עוקף RLS
 *              (השרת הוא הצד המורשה, ראה api/projects/route.ts), אבל ה-UPDATE הזה עצמו
 *              מוגבל בקוד לשלוש עמודות בטוחות בלבד — לעולם לא plan/email.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';

/** אותיות קטנות/ספרות/קו-תחתון בלבד — תואם לנתיב /u/[username] בלי צורך ב-URL-encoding. */
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const updateAccountSchema = z.object({
  username: z.string().regex(USERNAME_PATTERN).optional(),
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.url().optional(),
});

interface PostgresUniqueViolation {
  code: '23505';
}

function isUniqueViolation(error: unknown): error is PostgresUniqueViolation {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const db = getDb();
  const [userRow] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, user.id));

  return NextResponse.json({ user: userRow ?? null });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { username, displayName, avatarUrl } = parsed.data;
  if (username === undefined && displayName === undefined && avatarUrl === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = getDb();
  try {
    const [updated] = await db
      .update(users)
      .set({
        ...(username !== undefined && { username }),
        ...(displayName !== undefined && { displayName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      })
      .where(eq(users.id, user.id))
      .returning({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      });

    return NextResponse.json({ user: updated });
  } catch (caughtError) {
    if (isUniqueViolation(caughtError)) {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 });
    }
    throw caughtError;
  }
}
