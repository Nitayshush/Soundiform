/**
 * @file        route.ts
 * @description ⭐ תור מודרציה — רשימת פרויקטים ממתינים/מטופלים (§11 Sprint 9). GET בלבד;
 *              אישור/דחייה דרך api/admin/moderation/[id]/route.ts.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { MODERATION_STATUS_VALUES, getDb, moderationQueue, projects, users } from '@soundiform/db';
import { getAdminUser } from '@/lib/adminAuth';

const querySchema = z.object({
  status: z.enum(MODERATION_STATUS_VALUES).default('pending'),
});

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ status: searchParams.get('status') ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: moderationQueue.id,
      status: moderationQueue.status,
      reason: moderationQueue.reason,
      createdAt: moderationQueue.createdAt,
      project: {
        id: projects.id,
        title: projects.title,
        sourceType: projects.sourceType,
        uploadKey: projects.uploadKey,
        shapeData: projects.shapeData,
      },
      ownerEmail: users.email,
    })
    .from(moderationQueue)
    .innerJoin(projects, eq(projects.id, moderationQueue.projectId))
    .leftJoin(users, eq(users.id, projects.userId))
    .where(eq(moderationQueue.status, parsed.data.status))
    .orderBy(desc(moderationQueue.createdAt));

  return NextResponse.json({ items: rows });
}
