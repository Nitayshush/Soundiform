/**
 * @file        shares.ts
 * @description טבלת shares — שיתוף ציבורי ליצירה בודדת (§6, §9 "מנוע הצמיחה"). ראה PROJECT.md §11 Sprint 8.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: SELECT ל-`public` (גם 'anon', לא רק 'authenticated') — זו כל המהות של שיתוף:
 * דף `/s/[slug]` חייב להיות קריא בלי חשבון. עדיין אין policy ל-INSERT/UPDATE מהקליינט —
 * יצירת share עוברת שרת (בדיקת בעלות על ה-render לפני יצירת slug).
 */

import { sql } from 'drizzle-orm';
import { integer, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { renders } from './renders';

export const SHARE_VISIBILITY_VALUES = ['public', 'unlisted'] as const;
export type ShareVisibility = (typeof SHARE_VISIBILITY_VALUES)[number];

export const shares = pgTable(
  'shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    renderId: uuid('render_id')
      .notNull()
      .references(() => renders.id),
    slug: text('slug').notNull().unique(),
    visibility: text('visibility', { enum: SHARE_VISIBILITY_VALUES }).notNull().default('public'),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    // כל שורת shares היא, במובן הזה, ציבורית בכוונה (אין ערך 'private' ב-enum — אם לא רוצים
    // לשתף, פשוט לא יוצרים share). visibility מבדיל public/unlisted רק לצורך הגלריה (§9).
    pgPolicy('shares_select_public', {
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ],
).enableRLS();
