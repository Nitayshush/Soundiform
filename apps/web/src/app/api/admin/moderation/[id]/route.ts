/**
 * @file        route.ts
 * @description ⭐ אישור/דחייה של שורת מודרציה בודדת (§11 Sprint 9). כותב audit_log (§8 "חובה").
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, moderationQueue, recordAuditLog } from '@soundiform/db';
import { getAdminUser } from '@/lib/adminAuth';

const patchSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const [updated] = await db
    .update(moderationQueue)
    .set({
      status: parsed.data.status,
      reviewedBy: admin.id,
      ...(parsed.data.reason !== undefined && { reason: parsed.data.reason }),
    })
    .where(eq(moderationQueue.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Moderation entry not found' }, { status: 404 });
  }

  await recordAuditLog({
    actorId: admin.id,
    action: `moderation.${parsed.data.status}`,
    target: `moderation_queue:${id}`,
    metadata: { projectId: updated.projectId, reason: parsed.data.reason },
  });

  return NextResponse.json({ item: updated });
}
