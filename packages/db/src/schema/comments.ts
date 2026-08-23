/**
 * @file        comments.ts
 * @description ⭐ 2026-08-22 (§11 גלריה): תגובות על render — per-video, לא per-project (מספר
 *              renders של אותו project יכולים לקבל תגובות נפרדות, כל אחד עם ה-genre שלו).
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: select ציבורי (תגובה על יצירה ציבורית היא מידע ציבורי — אותו עיקרון כמו follows,
 * לא כמו likes). אין update/delete policy בכוונה — מחיקה היא server-side בלבד (תגובה עצמית,
 * או אדמין דרך getAdminUser()), לא policy — ראה api/comments/[id]/route.ts.
 *
 * ⭐ מודרציה מינימלית בכוונה ב-V1: הגבלת אורך (zod, בשרת) + מחיקה עצמית/אדמין. בלי תור-מודרציה
 * מקדים ובלי rate-limiter — נבנה רק אם וכאשר יתגלה ניצול לרעה בפועל, לא מראש.
 */

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { renders } from './renders';
import { users } from './users';

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    renderId: uuid('render_id')
      .notNull()
      .references(() => renders.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('comments_select_public', {
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ],
).enableRLS();
