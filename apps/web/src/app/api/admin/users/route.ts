/**
 * @file        route.ts
 * @description ⭐ שינוי ידני של plan מפאנל האדמין (§11, תשתית תשלום — לפני שPayPal מחובר
 *              בפועל). כותב audit_log (§8 "חובה", כמו כל שאר נתיבי האדמין). planSource
 *              נכתב תמיד 'manual'/'founding_member' — לעולם לא 'paypal' מהנתיב הזה (זה
 *              שמור לאינטגרציה האמיתית, כשתחובר).
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, or, ilike } from 'drizzle-orm';
import { getDb, PLAN_VALUES, recordAuditLog, users } from '@soundiform/db';
import { getAdminUser } from '@/lib/adminAuth';

const ADMIN_PLAN_SOURCE_VALUES = ['manual', 'founding_member'] as const;

const searchSchema = z.object({ query: z.string().min(1) });
const patchSchema = z.object({
  userId: z.uuid(),
  plan: z.enum(PLAN_VALUES),
  planSource: z.enum(ADMIN_PLAN_SOURCE_VALUES).default('manual'),
});

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({ query: url.searchParams.get('query') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  const term = `%${parsed.data.query}%`;
  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      plan: users.plan,
      planSource: users.planSource,
    })
    .from(users)
    .where(or(ilike(users.email, term), ilike(users.username, term)))
    .limit(20);

  return NextResponse.json({ users: rows });
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

  const { userId, plan, planSource } = parsed.data;
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ plan, planSource })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      plan: users.plan,
      planSource: users.planSource,
    });

  if (!updated) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await recordAuditLog({
    actorId: admin.id,
    action: 'user.plan_override',
    target: `users:${userId}`,
    metadata: { plan, planSource },
  });

  return NextResponse.json({ user: updated });
}
