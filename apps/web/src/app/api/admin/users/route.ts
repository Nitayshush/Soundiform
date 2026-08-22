/**
 * @file        route.ts
 * @description ⭐ שינוי ידני של plan מפאנל האדמין (§11, תשתית תשלום — לפני שPayPal מחובר
 *              בפועל). כותב audit_log (§8 "חובה", כמו כל שאר נתיבי האדמין). planSource
 *              נכתב תמיד 'manual'/'founding_member' — לעולם לא 'paypal' מהנתיב הזה (זה
 *              שמור לאינטגרציה האמיתית, כשתחובר).
 *
 * ⭐ 2026-08-22: גישה חופשית זמנית — freeAccessUntil (תאריך) הופך שינוי-plan רגיל למענק
 * זמני: ה-plan/planSource הנוכחיים (אלא אם כבר יש מענק פעיל — אז שומרים את נקודת-ההחזרה
 * המקורית, לא "דורסים" אותה במענק-על-גבי-מענק) נשמרים ב-restorePlan/restorePlanSource,
 * וה-revert בפועל קורה lazy דרך resolveEffectivePlan (packages/db/src/planOverride.ts) —
 * לא cron. revertNow מבטל מענק פעיל מיד, ידנית.
 *
 * ⭐ 2026-08-22: query ריק → 30 המשתמשים האחרונים כברירת מחדל (לא רק תוצאות חיפוש) — נמצא
 * ע"י בדיקה חיה: החיפוש עצמו עבד תמיד נכון, אבל בלי query הפאנל הציג רשימה ריקה, מה שנראה
 * כאילו משתמש חדש "לא קיים" עד שמחפשים אותו בשמו/במייל שלו במפורש.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, or, ilike, desc } from 'drizzle-orm';
import { getDb, PLAN_VALUES, recordAuditLog, resolveEffectivePlan, users } from '@soundiform/db';
import { getAdminUser } from '@/lib/adminAuth';

const ADMIN_PLAN_SOURCE_VALUES = ['manual', 'founding_member'] as const;
const DEFAULT_LIST_LIMIT = 30;

const searchSchema = z.object({ query: z.string() });
const patchSchema = z.object({
  userId: z.uuid(),
  plan: z.enum(PLAN_VALUES).optional(),
  planSource: z.enum(ADMIN_PLAN_SOURCE_VALUES).optional(),
  /** ⭐ תאריך ISO — כשמוגדר, השינוי הוא מענק זמני שיחזור לבד אחרי התאריך הזה. */
  freeAccessUntil: z.string().optional(),
  /** ⭐ מבטל מיד מענק זמני פעיל (חוזר ל-restorePlan/restorePlanSource עכשיו, לא בתאריך). */
  revertNow: z.boolean().optional(),
});

const USER_LIST_COLUMNS = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  plan: users.plan,
  planSource: users.planSource,
  planOverrideExpiresAt: users.planOverrideExpiresAt,
  restorePlan: users.restorePlan,
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({ query: url.searchParams.get('query') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const query = parsed.data.query.trim();
  const db = getDb();
  const rows = query
    ? await db
        .select(USER_LIST_COLUMNS)
        .from(users)
        .where(or(ilike(users.email, `%${query}%`), ilike(users.username, `%${query}%`)))
        .orderBy(desc(users.createdAt))
        .limit(DEFAULT_LIST_LIMIT)
    : await db
        .select(USER_LIST_COLUMNS)
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(DEFAULT_LIST_LIMIT);

  // ⭐ מנקה בהזדמנות מענקים שכבר פגו (self-heal, ראה planOverride.ts) — כדי שהחיפוש עצמו
  // תמיד יציג plan עדכני, לא ערך-override שנשאר בטבלה אחרי שהתאריך עבר.
  const freshRows = await Promise.all(
    rows.map(async (row) => {
      const effective = await resolveEffectivePlan(row.id);
      return { ...row, plan: effective.plan, planSource: effective.planSource };
    }),
  );

  return NextResponse.json({ users: freshRows });
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

  const { userId, plan, planSource, freeAccessUntil, revertNow } = parsed.data;
  const db = getDb();

  if (revertNow) {
    // מבטל מענק זמני פעיל מיד — לא מחכה לתאריך. אם אין restorePlan (אין מענק פעיל), אין מה לעשות.
    const [current] = await db
      .select({ restorePlan: users.restorePlan, restorePlanSource: users.restorePlanSource })
      .from(users)
      .where(eq(users.id, userId));
    if (!current?.restorePlan) {
      return NextResponse.json({ error: 'No active temporary grant to revert' }, { status: 400 });
    }
    const [updated] = await db
      .update(users)
      .set({
        plan: current.restorePlan,
        planSource: current.restorePlanSource ?? 'free',
        planOverrideExpiresAt: null,
        restorePlan: null,
        restorePlanSource: null,
      })
      .where(eq(users.id, userId))
      .returning(USER_LIST_COLUMNS);
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    await recordAuditLog({
      actorId: admin.id,
      action: 'user.plan_override_reverted',
      target: `users:${userId}`,
      metadata: { plan: updated.plan, planSource: updated.planSource },
    });
    return NextResponse.json({ user: updated });
  }

  if (!plan) {
    return NextResponse.json({ error: 'plan is required' }, { status: 400 });
  }
  const resolvedPlanSource = planSource ?? 'manual';

  if (freeAccessUntil) {
    const expiresAt = new Date(freeAccessUntil);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'freeAccessUntil must be a future date' }, { status: 400 });
    }

    // ⭐ אם כבר יש מענק פעיל (restorePlan מוגדר), שומרים את נקודת-ההחזרה *המקורית* —
    // לא דורסים אותה עם ה-plan הנוכחי (שהוא כבר תוצאת המענק הקודם, לא ה-plan האמיתי).
    const [current] = await db
      .select({
        plan: users.plan,
        planSource: users.planSource,
        restorePlan: users.restorePlan,
        restorePlanSource: users.restorePlanSource,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!current) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const restorePlan = current.restorePlan ?? current.plan;
    const restorePlanSource = current.restorePlan ? current.restorePlanSource : current.planSource;

    const [updated] = await db
      .update(users)
      .set({
        plan,
        planSource: resolvedPlanSource,
        planOverrideExpiresAt: expiresAt,
        restorePlan,
        restorePlanSource,
      })
      .where(eq(users.id, userId))
      .returning(USER_LIST_COLUMNS);
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await recordAuditLog({
      actorId: admin.id,
      action: 'user.plan_override_temporary',
      target: `users:${userId}`,
      metadata: { plan, planSource: resolvedPlanSource, expiresAt: expiresAt.toISOString() },
    });
    return NextResponse.json({ user: updated });
  }

  // שינוי plan רגיל וקבוע — מנקה גם מענק זמני שהיה פעיל (עוקף אותו במכוון, ראה תיעוד למעלה).
  const [updated] = await db
    .update(users)
    .set({
      plan,
      planSource: resolvedPlanSource,
      planOverrideExpiresAt: null,
      restorePlan: null,
      restorePlanSource: null,
    })
    .where(eq(users.id, userId))
    .returning(USER_LIST_COLUMNS);

  if (!updated) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await recordAuditLog({
    actorId: admin.id,
    action: 'user.plan_override',
    target: `users:${userId}`,
    metadata: { plan, planSource: resolvedPlanSource },
  });

  return NextResponse.json({ user: updated });
}
