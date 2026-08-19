/**
 * @file        likes.ts
 * @description לייקים — (user_id, render_id) composite PK, לפי §6. ראה PROJECT.md §11 Sprint 8.
 * @author      Shape-to-Sound
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: בכוונה **לא** ציבורי — SELECT רק לשורה של המשתמש עצמו ("האם *אני* אהבתי את זה"),
 * לא מי-עוד-אהב. ספירת לייקים כוללת (לגלריה) מחושבת בשרת דרך Drizzle, שעוקף RLS ממילא.
 */

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { renders } from './renders';
import { users } from './users';

export const likes = pgTable(
  'likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    renderId: uuid('render_id')
      .notNull()
      .references(() => renders.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.renderId] }),
    pgPolicy('likes_select_own', {
      for: 'select',
      to: 'authenticated',
      using: sql`auth.uid() = user_id`,
    }),
  ],
).enableRLS();
