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
 */

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const PLAN_VALUES = ['free', 'pro', 'studio'] as const;
export type Plan = (typeof PLAN_VALUES)[number];

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    plan: text('plan', { enum: PLAN_VALUES }).notNull().default('free'),
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
