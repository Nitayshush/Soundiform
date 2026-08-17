/**
 * @file        schema.ts
 * @description סכימת Zod של GenrePack — ראה PROJECT.md §5.1.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { z } from 'zod';
import { modeSchema, trackRoleSchema } from '@shape-sound/core';

// TODO(Sprint 5): להגדיר במדויק Pattern, SynthPreset, MixChainConfig, ArrangementTemplate
// כשיתחיל המימוש בפועל של הסגנונות — כרגע unknown שמורחב בהמשך כדי לא "לנחש" צורה.

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
  rhythmPatterns: z.record(trackRoleSchema, z.array(z.unknown())),
  synthMap: z.record(trackRoleSchema, z.unknown()),
  mixChain: z.unknown(),
  arrangement: z.unknown(),
  requiresSamples: z.boolean(), // ⚠️ true → מושבת ב-V1
});

export type GenrePack = z.infer<typeof genrePackSchema>;
