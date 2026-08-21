/**
 * @file        follows.ts
 * @description ⭐ עוקבים — (follower_id, following_id) composite PK, לפי אותה תבנית כמו
 *              likes.ts. מזין את הפיד (§11 "פיד בתוך האתר בלבד") ואת ספירת העוקבים בדף
 *              הפרופיל הציבורי (/u/[username]).
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: בניגוד ל-likes.ts (שם "האם אני אהבתי" הוא פרטי) — כאן SELECT ציבורי לגמרי
 * (to: 'public'), כי מי-עוקב-אחרי-מי הוא מידע ציבורי בכל רשת חברתית (ספירת עוקבים
 * מוצגת לכולם). בכוונה **אין** policy ל-INSERT/DELETE מהקליינט — עוקב/מבטל-מעקב עובר
 * תמיד דרך api/follows/route.ts (follower_id נלקח מה-session, לא מגוף הבקשה).
 */

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
    pgPolicy('follows_select_public', {
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ],
).enableRLS();
