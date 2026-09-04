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
 *
 * ⭐ 2026-09-04 (מקצה שדרוגים — כפתור פרסום/הסתרה בגלריה הפרטית): נוסף ערך `'private'`,
 * וההחלטה התיעודית הקודמת ("אין ערך private בכוונה") בוטלה במפורש. עד עכשיו: לא רוצים
 * לשתף = פשוט לא יוצרים שורת share, וזו הייתה כל המשמעות של visibility. עכשיו יש הבדל בין
 * "לא נוצרה עדיין" לבין "המשתמש הסתיר יצירה שכבר פורסמה" — וצריך שהשורה **תישאר** (כדי
 * שהיא עדיין תופיע ב-My Gallery, ה-slug/viewCount לא יאבדו כשמפרסמים בחזרה), רק תיחסם
 * מהגלריה הציבורית ומהעמוד הישיר.
 *
 * ⚠️⚠️ קריטי: policy יחיד עם `using: sql\`true\`` היה הופך `private` לחסר-משמעות ברמת
 * ה-DB — כל הקריאות בפועל באפליקציה עוברות דרך Drizzle בשרת (עוקף RLS, "השרת הוא הצד
 * המורשה"), אבל ה-anon key **ציבורי** ב-.env, ומאפשר גישה ישירה ל-PostgREST של Supabase
 * בלי לעבור דרך האפליקציה בכלל — RLS הוא קו ההגנה האמיתי היחיד מול זה. לכן שני policies
 * נפרדים: 1) ציבור/anon רואים רק public/unlisted (בדיוק ההתנהגות הישנה, לא השתנתה).
 * 2) הבעלים (authenticated, subquery בדיוק כמו renders.ts) רואה גם את ה-private שלו.
 */

import { sql } from 'drizzle-orm';
import { integer, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { renders } from './renders';

export const SHARE_VISIBILITY_VALUES = ['public', 'unlisted', 'private'] as const;
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
    pgPolicy('shares_select_public', {
      for: 'select',
      to: 'public',
      using: sql`visibility <> 'private'`,
    }),
    pgPolicy('shares_select_own_private', {
      for: 'select',
      to: 'authenticated',
      using: sql`visibility = 'private' and exists (
        select 1 from renders r join projects p on p.id = r.project_id
        where r.id = render_id and p.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();
