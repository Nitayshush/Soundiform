/**
 * @file        route.ts
 * @description יוצר שיתוף ציבורי ל-render קיים — מייצר slug קצר. ראה PROJECT.md §11 Sprint 8, §9.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בעלות: לא מספיק ש-renderId קיים — חייבים לוודא שה-project שמאחוריו שייך למשתמש
 * המחובר (join renders→projects), אחרת כל אחד יכול לשתף render של מישהו אחר.
 */

import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { projects, renders, shares, SHARE_VISIBILITY_VALUES, getDb } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';

const createShareSchema = z.object({
  renderId: z.uuid(),
  visibility: z.enum(SHARE_VISIBILITY_VALUES).default('public'),
});

function generateSlug(): string {
  return randomBytes(6).toString('base64url');
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
  const parsed = createShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { renderId, visibility } = parsed.data;
  const db = getDb();
  const [row] = await db
    .select({ userId: projects.userId })
    .from(renders)
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(eq(renders.id, renderId));

  if (!row || row.userId !== user.id) {
    return NextResponse.json({ error: 'Render not found' }, { status: 404 });
  }

  const slug = generateSlug();
  const [share] = await db.insert(shares).values({ renderId, visibility, slug }).returning();
  if (!share) {
    throw new Error('Failed to create share — no row returned');
  }

  return NextResponse.json({ slug: share.slug }, { status: 201 });
}
