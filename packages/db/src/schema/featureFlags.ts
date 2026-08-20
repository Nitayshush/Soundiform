/**
 * @file        featureFlags.ts
 * @description feature_flags — טוגלים בסיסיים, ניתנים לעריכה מפאנל האדמין בלי דיפלוי.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: SELECT ל-`public` — הקליינט חייב לדעת אילו features פעילים (למשל: האם reggae
 * מוצג ב-GenreSelector) בלי חשבון. אין policy ל-INSERT/UPDATE — עריכה רק דרך פאנל האדמין.
 */

import { sql } from 'drizzle-orm';
import { boolean, pgPolicy, pgTable, text } from 'drizzle-orm/pg-core';

export const featureFlags = pgTable(
  'feature_flags',
  {
    key: text('key').primaryKey(),
    value: boolean('value').notNull().default(false),
    description: text('description'),
  },
  () => [
    pgPolicy('feature_flags_select_public', {
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ],
).enableRLS();
