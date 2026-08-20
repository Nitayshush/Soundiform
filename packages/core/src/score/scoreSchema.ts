/**
 * @file        scoreSchema.ts
 * @description ולידציית Zod ל-MusicalScore — כל MusicalScore שנשמר/נטען מה-DB עובר דרך הסכימה הזו.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה סכימה נפרדת מהטיפוסים ולא רק interface:
 * MusicalScore נשמר כ-JSONB ב-DB ונטען מחדש — צריך ולידציה בזמן ריצה, לא רק type-checking בזמן קומפילציה.
 */

import { z } from 'zod';

export const modeSchema = z.enum([
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
]);

export const trackRoleSchema = z.enum(['bass', 'lead', 'pad', 'drums', 'skank']);

export const articulationSchema = z.enum(['staccato', 'legato', 'accent', 'glissando']);

export const mixSettingsSchema = z.object({
  volume: z.number().min(0).max(1),
  pan: z.number().min(-1).max(1),
  reverbSend: z.number().min(0).max(1),
  delaySend: z.number().min(0).max(1),
});

export const noteSchema = z.object({
  startTick: z.number().int().nonnegative(),
  durationTicks: z.number().int().positive(),
  pitch: z.number().int().min(0).max(127),
  velocity: z.number().min(0).max(1),
  articulation: articulationSchema.optional(),
});

export const trackSchema = z.object({
  role: trackRoleSchema,
  instrumentId: z.string().min(1),
  notes: z.array(noteSchema),
  mixSettings: mixSettingsSchema,
});

export const sectionSchema = z.object({
  name: z.enum(['intro', 'loop', 'build', 'outro']),
  startBar: z.number().int().nonnegative(),
  lengthBars: z.number().int().positive(),
});

export const musicalScoreSchema = z.object({
  version: z.string().min(1),
  seed: z.string().min(1),
  tempo: z.number().positive(),
  timeSignature: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  key: z.object({
    root: z.number().int().min(0).max(11),
    mode: modeSchema,
  }),
  genreId: z.string().min(1),
  durationBars: z.number().int().positive(),
  tracks: z.array(trackSchema),
  sections: z.array(sectionSchema),
  metadata: z.object({
    avgNoteDensity: z.number().nonnegative(),
    dominantMode: modeSchema,
    rootFrequencyHz: z.number().positive(),
  }),
});
