/**
 * @file        projects.ts
 * @description טבלת projects — הצורה, נשמרת כווקטור (JSONB) לא כתמונה. ראה PROJECT.md §6.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: רק SELECT (השורות של המשתמש עצמו). בכוונה **אין** policy ל-INSERT/UPDATE
 * מהקליינט — כתיבה עוברת תמיד דרך route בצד שרת (service role, עוקף RLS), כי היצירה
 * דורשת אכיפת מכסה (credits_ledger) שלא ניתן לממש ברמת row-ownership בלבד.
 * user_id NULLABLE לפי §6 ("NULL = אנונימי") — בפועל אין ליצור שורה כזו מהאפליקציה
 * (§9: יצירה אנונימית חיה רק ב-localStorage, נכתבת ל-DB רק ברגע ההרשמה/הורדה, עם user_id אמיתי).
 *
 * ⭐ Sprint 9: upload_key (nullable) — מפתח R2 של הקובץ המקורי-הנקי (uploads/{userId}/{id}.{ext},
 * ראה api/upload/route.ts + PROJECT.md §7 "מבנה מפתחות"), רק ל-sourceType 'svg'/'raster'.
 * זה מה שמאפשר לאדמין ב-moderation queue לראות את הקובץ שהמשתמש בפועל העלה, לא רק את
 * ה-ShapeData הנגזר ממנו.
 */

import { sql } from 'drizzle-orm';
import { jsonb, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { ShapeData } from '@soundiform/shared';
import { users } from './users';

export const SOURCE_TYPE_VALUES = ['drawing', 'svg', 'raster'] as const;
export type SourceType = (typeof SOURCE_TYPE_VALUES)[number];

/**
 * ⭐ 2026-08-31: ההגדרות שנשמרות יחד עם הציור. ⚠️ מוגדר כאן ולא מיובא מ-apps/web — packages
 * לא יכולות לתלות באפליקציה (§3). הצורה חייבת להישאר תואמת ל-CreationSettings שם, ולכן
 * שני הצדדים מאומתים מול אותה סכימת Zod במסלול השמירה.
 */
export interface ProjectCreationSettings {
  soundSelections?: Record<string, string[]>;
  beatPatternId?: string;
  key?: { rootPitchClass: number; mode: string };
}

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    title: text('title'),
    shapeData: jsonb('shape_data').$type<ShapeData>().notNull(),
    shapeHash: text('shape_hash').notNull(),
    sourceType: text('source_type', { enum: SOURCE_TYPE_VALUES }).notNull(),
    thumbnailKey: text('thumbnail_key'),
    uploadKey: text('upload_key'),
    /**
     * ⭐ 2026-08-31 (סבב א'): ההגדרות שהמשתמש בחר ליצירה — צלילים, מקצב וסולם.
     *
     * ⚠️ עד עכשיו הן חיו ב-localStorage בלבד, ולכן יצירה שנפתחה במכשיר אחר קיבלה צלילים
     * אחרים. עם בורר-הסולם זה נעשה חמור בהרבה: אותה יצירה הייתה מתנגנת **בסולם אחר לגמרי**.
     * הציור לבדו כבר לא מגדיר את היצירה — ההגדרות הן חלק ממנה, ולכן הן נשמרות איתה.
     *
     * nullable: פרויקטים שנוצרו לפני התאריך הזה ממשיכים לעבוד, ונופלים לברירות-מחדל הסגנון.
     */
    creationSettings: jsonb('creation_settings').$type<ProjectCreationSettings>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  () => [
    pgPolicy('projects_select_own', {
      for: 'select',
      to: 'authenticated',
      using: sql`auth.uid() = user_id`,
    }),
  ],
).enableRLS();
