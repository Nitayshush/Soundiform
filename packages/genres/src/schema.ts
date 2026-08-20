/**
 * @file        schema.ts
 * @description סכימת Zod של GenrePack — ראה PROJECT.md §5.1.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מגבלת V1 מתועדת: `rhythmPatterns` ו-`arrangement` מוגדרים בצורה אמיתית (לא unknown) כדי
 * שקבצי ה-JSON יוכלו לבטא נתונים משמעותיים — אבל **אף אחד מהם עדיין לא נצרך בפועל**
 * ב-harmonyEngine.ts. תבניות תופים אמיתיות (step sequencer) ומבנה intro/build/outro
 * דורשים שינוי ארכיטקטוני נפרד ב-core, לא בהיקף Sprint 5 (תופים כבר נדחו ב-Sprint 3).
 * `synthMap`/`mixChain` הם כן צרכניים בפועל החל מ-Sprint 5, אך מפושטים בכוונה —
 * "supersaw + sidechain" וכו' מ-§5.2 מתורגמים ל-oscillator/envelope/reverb/delay סבירים,
 * לא לדיזיין-סאונד אמיתי (unison detuning, sidechain ducking) שנדחה לעתיד.
 */

import { z } from 'zod';
import { modeSchema, trackRoleSchema } from '@soundiform/core';

export const oscillatorTypeSchema = z.enum(['sine', 'triangle', 'sawtooth', 'square']);

export const envelopeSchema = z.object({
  attack: z.number().min(0),
  decay: z.number().min(0),
  sustain: z.number().min(0).max(1),
  release: z.number().min(0),
});

export const synthPresetSchema = z.object({
  oscillatorType: oscillatorTypeSchema,
  envelope: envelopeSchema,
  /** האם הקול הזה מתנגן פוליפונית (טריאדה בו-זמנית) — בדרך כלל true ל-pad/skank. */
  polyphonic: z.boolean(),
});

export const mixChainConfigSchema = z.object({
  reverbDecaySeconds: z.number().positive(),
  /** בתחביר זמן של Tone.js, למשל "8n". */
  delayTime: z.string().min(1),
  delayFeedback: z.number().min(0).max(1),
});

/** ⚠️ לא נצרך ב-V1 — ראה תיעוד למעלה. מוגדר עכשיו כדי שנתוני ה-JSON יהיו משמעותיים מהיום הראשון. */
export const patternSchema = z.object({
  name: z.string().min(1),
  stepsPerBar: z.union([z.literal(8), z.literal(16), z.literal(32)]),
  /** וולוסיטי לכל step, 0 = שקט (rest). */
  hits: z.array(z.number().min(0).max(1)),
});

/** ⚠️ לא נצרך ב-V1 — ראה תיעוד למעלה. */
export const arrangementTemplateSchema = z.object({
  sectionOrder: z.array(z.enum(['intro', 'loop', 'build', 'outro'])).min(1),
});

export const genrePackSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ he: z.string().min(1), en: z.string().min(1) }),
  tempo: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
    default: z.number().positive(),
  }),
  grid: z.object({
    subdivision: z.union([z.literal(8), z.literal(16), z.literal(32)]),
    swingAmount: z.number().min(0).max(1),
  }),
  allowedModes: z.array(modeSchema).min(1),
  defaultMode: modeSchema,
  harmonicTendency: z.enum(['diatonic', 'modal', 'extended']),
  roles: z.array(trackRoleSchema).min(1),
  // partialRecord ולא record: pack מגדיר רק את ה-roles שהוא בפועל משתמש בהם (roles למעלה),
  // לא נדרש filler-data מלאכותי לתפקידים שלא רלוונטיים לסגנון (למשל skank בז'אנרים לא-רגאיי).
  rhythmPatterns: z.partialRecord(trackRoleSchema, z.array(patternSchema)),
  synthMap: z.partialRecord(trackRoleSchema, synthPresetSchema),
  mixChain: mixChainConfigSchema,
  arrangement: arrangementTemplateSchema,
  requiresSamples: z.boolean(), // ⚠️ true → מושבת ב-V1
});

export type GenrePack = z.infer<typeof genrePackSchema>;
