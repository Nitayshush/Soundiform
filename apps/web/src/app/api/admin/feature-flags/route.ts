/**
 * @file        route.ts
 * @description ⭐ עריכת feature flags מפאנל האדמין (§11 Sprint 9). כותב audit_log (§8 "חובה").
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { featureFlags, getDb, recordAuditLog } from '@soundiform/db';
import { getAdminUser } from '@/lib/adminAuth';

const patchSchema = z.object({
  key: z.string().min(1),
  value: z.boolean(),
});

export async function GET(): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const flags = await getDb().select().from(featureFlags);
  return NextResponse.json({ flags });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

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
    .insert(featureFlags)
    .values({ key: parsed.data.key, value: parsed.data.value })
    .onConflictDoUpdate({ target: featureFlags.key, set: { value: parsed.data.value } })
    .returning();

  await recordAuditLog({
    actorId: admin.id,
    action: 'feature_flag.update',
    target: `feature_flags:${parsed.data.key}`,
    metadata: { value: parsed.data.value },
  });

  return NextResponse.json({ flag: updated });
}
