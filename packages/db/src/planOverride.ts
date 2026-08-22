/**
 * @file        planOverride.ts
 * @description ⭐ 2026-08-22 — גישה חופשית זמנית (מפאנל האדמין, §11): resolveEffectivePlan
 *              הוא נקודת-הכניסה היחידה שצריך לקרוא לה בכל מקום שבודק plan של משתמש לצורך
 *              מכסות/הרשאות (api/projects, api/render, api/renders/[id]/download) — במקום
 *              select ישיר של users.plan. ראה תיעוד מלא ב-schema/users.ts.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ lazy revert, לא cron: אם planOverrideExpiresAt כבר עבר, הפונקציה הזו מחזירה את
 * plan/planSource ל-restorePlan/restorePlanSource *וגם* כותבת את זה בחזרה ל-DB (מנקה את
 * שדות ה-override) — כך שברגע שמישהו בפועל בודק את ה-plan (המשתמש עצמו, או אדמין שמחפש
 * אותו), המצב מתקן את עצמו. אין תלות בתשתית cron/scheduled-job חדשה.
 */

import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { users, type Plan, type PlanSource } from './schema';

export interface EffectivePlan {
  plan: Plan;
  planSource: PlanSource;
}

/**
 * מחזיר את ה-plan/planSource שבאמת חלים על המשתמש כרגע — מבצע reversion אוטומטי אם יש
 * מענק-זמני שכבר פג. מחזיר `{plan:'free', planSource:'free'}` אם המשתמש לא נמצא (לא אמור
 * לקרות בפועל בנקודות-הקריאה, אבל בטוח יותר מלזרוק).
 */
export async function resolveEffectivePlan(userId: string): Promise<EffectivePlan> {
  const db = getDb();
  const [row] = await db
    .select({
      plan: users.plan,
      planSource: users.planSource,
      planOverrideExpiresAt: users.planOverrideExpiresAt,
      restorePlan: users.restorePlan,
      restorePlanSource: users.restorePlanSource,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!row) {
    return { plan: 'free', planSource: 'free' };
  }

  const isExpired =
    row.planOverrideExpiresAt !== null && row.planOverrideExpiresAt.getTime() <= Date.now();
  if (!isExpired || !row.restorePlan) {
    return { plan: row.plan, planSource: row.planSource };
  }

  const reverted: EffectivePlan = {
    plan: row.restorePlan,
    planSource: row.restorePlanSource ?? 'free',
  };
  await db
    .update(users)
    .set({
      plan: reverted.plan,
      planSource: reverted.planSource,
      planOverrideExpiresAt: null,
      restorePlan: null,
      restorePlanSource: null,
    })
    .where(eq(users.id, userId));
  return reverted;
}
