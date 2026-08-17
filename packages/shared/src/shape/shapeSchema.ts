/**
 * @file        shapeSchema.ts
 * @description ולידציית Zod ל-ShapeData — כל צורה שנשמרת/נטענת מה-DB עוברת דרך הסכימה הזו.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { z } from 'zod';

export const shapePointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const shapePathSchema = z.object({
  points: z.array(shapePointSchema).min(2, 'מסלול חייב לפחות שתי נקודות'),
  closed: z.boolean(),
});

export const shapeDataSchema = z.object({
  version: z.string().min(1),
  paths: z.array(shapePathSchema).min(1, 'צורה חייבת לפחות מסלול אחד'),
});
