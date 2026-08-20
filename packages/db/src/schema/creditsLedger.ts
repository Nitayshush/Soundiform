/**
 * @file        creditsLedger.ts
 * @description ⭐ יומן מכסות — append-only! לעולם לא UPDATE על יתרה, רק שורות delta חדשות.
 *              יתרה = SUM(delta). ראה PROJECT.md §6, §9.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: רק SELECT ללקוח (לבדוק יתרה/היסטוריה). בכוונה **אין** policy ל-INSERT מהקליינט —
 * אם היה קיים, משתמש היה יכול "להעניק לעצמו" קרדיטים ישירות מול ה-DB. רק שרת (service role,
 * עוקף RLS) כותב שורות, תמיד אחרי אכיפת מכסה אמיתית בקוד (§0.3: "לעולם לא לסמוך על קליינט
 * למכסות").
 */

import { sql } from 'drizzle-orm';
import { integer, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const creditsLedger = pgTable(
  'credits_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('credits_ledger_select_own', {
      for: 'select',
      to: 'authenticated',
      using: sql`auth.uid() = user_id`,
    }),
  ],
).enableRLS();
