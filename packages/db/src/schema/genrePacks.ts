/**
 * @file        genrePacks.ts
 * @description ⭐ genre_packs — מקור האמת ל-GenrePacks בזמן ריצה (§11 Sprint 9: "עריכת GenrePack
 *              ללא דיפלוי"). קבצי ה-JSON הסטטיים ב-packages/genres נשארים רק כ-seed ראשוני.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ id הוא TEXT (למשל 'trance'), לא UUID — תואם למזהי הסגנון היציבים שכל שאר הקוד
 * (genreId ב-MusicalScore/renders, GenreSelector וכו') כבר משתמש בהם.
 *
 * ⚠️ RLS: SELECT ל-`public` (הקליינט חייב לקרוא סגנונות פעילים בלי חשבון). אין
 * policy ל-INSERT/UPDATE — עריכה עוברת שרת בלבד, דרך פאנל האדמין (בדיקת ADMIN_EMAILS
 * באפליקציה, לא ב-RLS — ראה api/admin/*).
 */

import { sql } from 'drizzle-orm';
import { integer, jsonb, pgPolicy, pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import type { GenrePack } from '@soundiform/genres';

export const genrePacks = pgTable(
  'genre_packs',
  {
    id: text('id').primaryKey(),
    config: jsonb('config').$type<GenrePack>().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('genre_packs_select_public', {
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ],
).enableRLS();
