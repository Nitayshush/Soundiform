/**
 * @file        creationSettingsSchema.ts
 * @description ⭐ 2026-08-31 (סבב א'): סכימת Zod יחידה ל-CreationSettings — הצלילים, המקצב
 *              והסולם שהמשתמש בחר.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **סכימה אחת, לא אחת לכל מסלול.** ההגדרות נכנסות מארבעה מקומות שונים (שמירת פרויקט,
 * שני מסלולי רינדור-לקוח, ורינדור-שרת) ויוצאות אל `toCompositionConfig` שנקרא מששה. אם כל
 * מסלול היה מגדיר ולידציה משלו, מסלול אחד היה מקבל סולם ואחר לא — והתוצאה היא ש**הלוח
 * מציג תווים שונים ממה שמתנגן**. זה כשל שקט שרק המשתמש שומע, ובדיוק סוג הבאג שרדפנו אחריו
 * סבבים שלמים. מקור-אמת יחיד מונע אותו מראש.
 *
 * ⚠️ §0 כלל 3 — ולידציית Zod על כל קלט חיצוני, בלי יוצא מן הכלל. ההגדרות מגיעות מהלקוח.
 */

import { z } from 'zod';
import { modeSchema, trackRoleSchema } from '@soundiform/core';

export const musicalKeySchema = z.object({
  /** 0=C … 11=B. */
  rootPitchClass: z.number().int().min(0).max(11),
  mode: modeSchema,
});

export const creationSettingsSchema = z.object({
  soundSelections: z.partialRecord(trackRoleSchema, z.array(z.string().min(1))).optional(),
  beatPatternId: z.string().min(1).max(64).optional(),
  key: musicalKeySchema.optional(),
});

export type CreationSettingsInput = z.infer<typeof creationSettingsSchema>;
