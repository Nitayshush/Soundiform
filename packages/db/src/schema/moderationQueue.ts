/**
 * @file        moderationQueue.ts
 * @description תור מודרציה — §8 שרשרת ההגנה על העלאות (שלב 5, אחרי svgo/sharp, לפני R2).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: SELECT רק על שורות של הפרויקטים של המשתמש עצמו — כדי שמשתמש יוכל לראות את סטטוס
 * ההעלאה שלו ("ממתין לבדיקה"), לא כדי לחשוף תור מודרציה מלא לקליינטים. אין policy ל-INSERT —
 * נכתב רק משרת (api/upload), אחרי שהקובץ עבר את שלבי הבדיקה האוטומטיים.
 */

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const MODERATION_STATUS_VALUES = ['pending', 'approved', 'rejected'] as const;
export type ModerationStatus = (typeof MODERATION_STATUS_VALUES)[number];

export const moderationQueue = pgTable(
  'moderation_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    status: text('status', { enum: MODERATION_STATUS_VALUES }).notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('moderation_queue_select_own', {
      for: 'select',
      to: 'authenticated',
      using: sql`exists (
        select 1 from projects p where p.id = ${table.projectId} and p.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();
