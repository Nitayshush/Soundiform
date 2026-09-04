/**
 * @file        credits.ts
 * @description ⭐ אכיפת מכסות (§9: חינם=15 יצירות/חודש, 15 שמורות) מעל credits_ledger
 *              (append-only, §6). לעולם לא UPDATE על יתרה — רק שורות delta חדשות.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ פרשנות מכוונת של §9 (לא כתוב שם מפורשות, מתועד כאן כדי שיהיה קל לעדכן):
 * - "15 שמורות" נאכף כ-COUNT של פרויקטים פעילים (לא soft-deleted) — reason='project_save'/
 *   'project_delete' עם delta ±1, כך שהיתרה השלילה = מספר הפרויקטים השמורים כרגע. אין
 *   איפוס חודשי כאן (זה מכסת "כמה שמור בו-זמנית", לא צריכה תאריך).
 * - "15 יצירות/חודש" נאכף כ-COUNT ישיר של שורות reason='render' בחודש הקלנדרי הנוכחי
 *   (UTC) — לא ניתן לממש "מתחדש חודשית" עם SUM(delta) מצטבר-לנצח בלי גם לסנן לפי תאריך,
 *   אז משתמשים בלוג עצמו כמקור-אמת מסונן-תאריך במקום ביתרה גולמית.
 */

import { and, count, eq, gte, sql } from 'drizzle-orm';
import { getDb } from './client';
import { creditsLedger } from './schema';

export const FREE_MONTHLY_CREATIONS = 15;
export const FREE_SAVED_PROJECTS = 15;

export type LedgerReason = 'project_save' | 'project_delete' | 'render';

export async function recordLedgerEntry(
  userId: string,
  delta: number,
  reason: LedgerReason,
): Promise<void> {
  await getDb().insert(creditsLedger).values({ userId, delta, reason });
}

/** מספר הפרויקטים השמורים כרגע (delta=-1 בשמירה, +1 במחיקה — היתרה השלילה = הכמות הפעילה). */
export async function getSavedProjectCount(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${creditsLedger.delta}), 0)` })
    .from(creditsLedger)
    .where(and(eq(creditsLedger.userId, userId), eq(creditsLedger.reason, 'project_save')));
  return -(row?.total ?? 0);
}

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getMonthlyCreationCount(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ total: count() })
    .from(creditsLedger)
    .where(
      and(
        eq(creditsLedger.userId, userId),
        eq(creditsLedger.reason, 'render'),
        gte(creditsLedger.createdAt, startOfCurrentMonthUtc()),
      ),
    );
  return row?.total ?? 0;
}

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
}

/** ⚠️ תמיד לקרוא בצד שרת לפני שמירה/רינדור בפועל — לעולם לא לסמוך על בדיקה בצד קליינט (§0.3). */
export async function checkSaveQuota(
  userId: string,
  plan: 'free' | 'pro' | 'studio',
): Promise<QuotaCheckResult> {
  if (plan !== 'free') {
    return { allowed: true, current: 0, limit: Infinity };
  }
  const current = await getSavedProjectCount(userId);
  return { allowed: current < FREE_SAVED_PROJECTS, current, limit: FREE_SAVED_PROJECTS };
}

export async function checkCreationQuota(
  userId: string,
  plan: 'free' | 'pro' | 'studio',
): Promise<QuotaCheckResult> {
  if (plan !== 'free') {
    return { allowed: true, current: 0, limit: Infinity };
  }
  const current = await getMonthlyCreationCount(userId);
  return { allowed: current < FREE_MONTHLY_CREATIONS, current, limit: FREE_MONTHLY_CREATIONS };
}
