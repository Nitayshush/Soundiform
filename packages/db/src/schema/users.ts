/**
 * @file        users.ts
 * @description ⭐ טבלת users — מקבילה ל-auth.users הפנימית של Supabase. id זהה בכוונה
 *              (לא FK מנוהל-Drizzle, כי auth.* לא בסכימה שלנו) — מאוכלס אוטומטית דרך
 *              trigger על auth.users (ראה migrations/0001_auth_user_sync.sql).
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: רק SELECT על השורה של המשתמש עצמו. בכוונה **אין** UPDATE policy למשתמש —
 * `plan` הוא שדה שקובע הרשאות/מכסות ולא ניתן לחשוף אותו ל-UPDATE ישיר מהקליינט (גם לא
 * לעדכון display_name/avatar_url — עריכת פרופיל, אם תתווסף, צריכה לעבור route בצד שרת
 * שמעדכן רק את העמודות הבטוחות, לא UPDATE גורף מהקליינט).
 *
 * ⭐ עדכון פרופיל ציבורי: `username` הוא הבסיס לדפי פרופיל ציבוריים (`/u/[username]`,
 * ראה api/account/route.ts + app/u/[username]/page.tsx). ה-RLS הקיים (SELECT רק על השורה
 * העצמית) *לא* מונע דפי פרופיל של משתמשים אחרים — אלה נקראים תמיד דרך getDb() בצד שרת
 * (עוקף RLS, ראה api/projects/route.ts להסבר העקרוני), שחייב להקפיד לבחור רק עמודות
 * בטוחות-לפרסום (username/display_name/avatar_url) ולעולם לא email.
 *
 * ⭐ תשתית תשלום (§11, סיבוב עתידי לחיבור PayPal אמיתי): planSource מבחין בין "אדמין
 * שינה ידנית" ("manual"), "Founding Member" (§9, 500 הראשונים), ו-"paypal" (עתידי) —
 * כדי שכשPayPal יחובר בפועל לא נאבד את ההבחנה למה למשתמש יש את התוכנית שיש לו.
 *
 * ⭐ 2026-08-22: גישה חופשית זמנית (מפאנל האדמין) — planOverrideExpiresAt+restorePlan/
 * restorePlanSource מייצגים "עד תאריך X, plan הוא מענק זמני; אחרי זה, לחזור ל-plan/
 * planSource שהיו שמורים כאן". אין job/cron ייעודי לתפוגה — packages/db/src/planOverride.ts's
 * resolveEffectivePlan נקרא בכל נקודת-שער-הרשאות (quota/render/download) ומבצע את ההחזרה
 * בעצמו (lazy, on-access) אם התאריך כבר עבר — פשוט יותר מתשתית cron חדשה, ותמיד נכון
 * ברגע שמישהו בפועל בודק את ה-plan (לא רק "מתישהו ברקע").
 *
 * ⭐ 2026-09-06: termsAcceptedAt — nullable בכוונה. נכתב פעם אחת ב-api/account/accept-terms
 * מיד אחרי הרשמה מוצלחת (ראה (auth)/login/page.tsx + auth/callback/route.ts). משתמשים
 * שנרשמו *לפני* שהתכונה הזו קיימת נשארים null לצמיתות — זה לא באג, זה תיעוד כן של המצב
 * בפועל (לא מבקשים רטרואקטיבית מהם לאשר). אין כאן "גרסת תנאים" — אם התנאים ישתנו מהותית
 * בעתיד, זו תוספת נפרדת.
 */

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const PLAN_VALUES = ['free', 'pro', 'studio'] as const;
export type Plan = (typeof PLAN_VALUES)[number];

export const PLAN_SOURCE_VALUES = ['free', 'manual', 'paypal', 'founding_member'] as const;
export type PlanSource = (typeof PLAN_SOURCE_VALUES)[number];

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    username: text('username').unique(),
    plan: text('plan', { enum: PLAN_VALUES }).notNull().default('free'),
    planSource: text('plan_source', { enum: PLAN_SOURCE_VALUES }).notNull().default('free'),
    paypalSubscriptionId: text('paypal_subscription_id'),
    /** ⭐ 2026-08-22: מוגדר רק כשיש מענק-גישה זמני פעיל — ראה תיעוד למעלה. */
    planOverrideExpiresAt: timestamp('plan_override_expires_at', { withTimezone: true }),
    restorePlan: text('restore_plan', { enum: PLAN_VALUES }),
    restorePlanSource: text('restore_plan_source', { enum: PLAN_SOURCE_VALUES }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  },
  () => [
    pgPolicy('users_select_own', {
      for: 'select',
      to: 'authenticated',
      using: sql`auth.uid() = id`,
    }),
  ],
).enableRLS();
