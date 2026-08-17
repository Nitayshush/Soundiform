/**
 * @file        shapeSchema.test.ts
 * @description בדיקות יחידה לולידציית Zod של ShapeData.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { shapeDataSchema } from './shapeSchema';

describe('shapeDataSchema', () => {
  it('מקבל צורה תקינה', () => {
    const result = shapeDataSchema.safeParse({
      version: '1.0.0',
      paths: [
        {
          closed: false,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('דוחה צורה בלי אף מסלול', () => {
    const result = shapeDataSchema.safeParse({ version: '1.0.0', paths: [] });
    expect(result.success).toBe(false);
  });

  it('דוחה מסלול עם פחות משתי נקודות', () => {
    const result = shapeDataSchema.safeParse({
      version: '1.0.0',
      paths: [{ closed: false, points: [{ x: 0.5, y: 0.5 }] }],
    });
    expect(result.success).toBe(false);
  });

  it('דוחה קואורדינטה מחוץ לטווח 0–1', () => {
    const result = shapeDataSchema.safeParse({
      version: '1.0.0',
      paths: [
        {
          closed: false,
          points: [
            { x: -0.1, y: 0.5 },
            { x: 0.5, y: 1.2 },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
