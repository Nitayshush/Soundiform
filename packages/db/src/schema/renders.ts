/**
 * @file        renders.ts
 * @description טבלת renders — MusicalScore + מפתחות R2 של הפלטים. ראה PROJECT.md §6.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ RLS: בעלות נקבעת בעקיפין דרך projects.user_id (אין עמודת user_id ישירה כאן, לפי §6) —
 * ה-policy משתמשת ב-subquery. בכוונה רק SELECT מהקליינט; INSERT/UPDATE רק דרך שרת (service
 * role) — apps/worker כותב audio_key/video_key/midi_key/status אחרי רינדור בפועל.
 *
 * ⚠️ tempo_bpm/root_freq_hz/avg_note_density/dominant_mode: שדות ל-V2 (וולנס) — אל תסיר,
 * גם אם לא נצרכים עדיין ב-V1 (ראה MusicalScore.metadata, אותם שדות בדיוק).
 */

import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Mode, MusicalScore } from '@soundiform/core';
import { projects } from './projects';

export const RENDER_STATUS_VALUES = ['pending', 'processing', 'completed', 'failed'] as const;
export type RenderStatus = (typeof RENDER_STATUS_VALUES)[number];

export const renders = pgTable(
  'renders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    genreId: text('genre_id').notNull(),
    score: jsonb('score').$type<MusicalScore>().notNull(),
    engineVersion: text('engine_version').notNull(),
    audioKey: text('audio_key'),
    videoKey: text('video_key'),
    midiKey: text('midi_key'),
    durationSec: real('duration_sec'),
    status: text('status', { enum: RENDER_STATUS_VALUES }).notNull().default('pending'),
    tempoBpm: integer('tempo_bpm'),
    rootFreqHz: real('root_freq_hz'),
    avgNoteDensity: real('avg_note_density'),
    dominantMode: text('dominant_mode').$type<Mode>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy('renders_select_own', {
      for: 'select',
      to: 'authenticated',
      using: sql`exists (
        select 1 from projects p where p.id = project_id and p.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();
