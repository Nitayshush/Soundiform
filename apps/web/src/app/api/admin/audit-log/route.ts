/**
 * @file        route.ts
 * @description ⭐ צפייה ב-audit_log (§11 Sprint 9, §8 "audit_log לכל פעולת אדמין"). GET בלבד —
 *              audit_log הוא append-only, אין UPDATE/DELETE דרך ה-API הזה.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { auditLog, getDb, users } from '@soundiform/db';
import { getAdminUser } from '@/lib/adminAuth';

const PAGE_SIZE = 100;

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ offset: searchParams.get('offset') ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = getDb();
  const entries = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      target: auditLog.target,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt))
    .limit(PAGE_SIZE)
    .offset(parsed.data.offset);

  return NextResponse.json({ entries, pageSize: PAGE_SIZE });
}
