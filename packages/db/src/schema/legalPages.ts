/**
 * @file        legalPages.ts
 * @description ⭐ 2026-09-06: legal_pages — תוכן משפטי (תנאי שימוש, ובעתיד מדיניות פרטיות)
 *              עריך דרך פאנל האדמין בלי דיפלוי — אותה גישה בדיוק כמו genre_packs.
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ טבלה גנרית (slug, לא רק "terms") בכוונה — docs/PROJECT.md §"תאימות" מזכיר גם מדיניות
 * פרטיות כחובה עתידית (חוק הגנת הפרטיות תיקון 13 + GDPR); הוספתה כשתידרש היא שורה נוספת,
 * לא טבלה חדשה. content הוא טקסט רגיל (פסקאות מופרדות בשורה ריקה) — לא markdown, כדי לא
 * להוסיף תלות-רינדור חדשה בשביל מסמך פרוזה.
 *
 * ⚠️ RLS: SELECT ל-public (דף /terms נקרא בלי חשבון). אין policy ל-INSERT/UPDATE — עריכה
 * עוברת שרת בלבד, דרך api/admin/legal-pages (בדיקת getAdminUser, לא RLS).
 */

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const legalPages = pgTable(
  'legal_pages',
  {
    slug: text('slug').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('legal_pages_select_public', {
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ],
).enableRLS();
