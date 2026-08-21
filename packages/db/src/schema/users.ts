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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  () => [
    pgPolicy('users_select_own', {
      for: 'select',
      to: 'authenticated',
      using: sql`auth.uid() = id`,
    }),
  ],
).enableRLS();
