/**
 * @file        auditLog.ts
 * @description ⭐ audit_log לכל פעולת אדמין (§8 "רשימת חובה"). append-only, לא נגיש לקליינט.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: אין אף policy — טבלה זו לא נגישה כלל מהקליינט (גם לא ל-authenticated). קריאה/כתיבה
 * רק משרת (Drizzle, עוקף RLS) אחרי בדיקת ADMIN_EMAILS באפליקציה. RLS עדיין מופעל (§0.3
 * "RLS על כל טבלה") — deny-by-default הוא ההתנהגות הרצויה כאן, לא חריג.
 */

import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  target: text('target').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ip: text('ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
