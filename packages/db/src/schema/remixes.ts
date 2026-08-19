/**
 * @file        remixes.ts
 * @description ⭐ עץ הרמיקסים — כל צופה הופך ליוצר בקליק (§9 "מנוע הצמיחה"). ראה PROJECT.md §11 Sprint 8.
 * @author      Shape-to-Sound
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: SELECT ל-`public` — עץ הרמיקסים חלק מהתצוגה הציבורית (כמה רמיקסים יש ל-render).
 * אין policy ל-INSERT מהקליינט — נכתב בשרת כשילד בפועל נשמר.
 */

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { renders } from './renders';

export const remixes = pgTable(
  'remixes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentRenderId: uuid('parent_render_id')
      .notNull()
      .references(() => renders.id),
    childProjectId: uuid('child_project_id')
      .notNull()
      .references(() => projects.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('remixes_select_public', {
      for: 'select',
      to: 'public',
      using: sql`true`,
    }),
  ],
).enableRLS();
