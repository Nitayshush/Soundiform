/**
 * @file        shapeHash.test.ts
 * @description בדיקות יחידה לעקרון הדטרמיניזם (§1) — אותה צורה חייבת תמיד לייצר אותו hash.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { computeShapeHash } from './shapeHash';
import type { ShapeData } from './ShapeData';

function triangle(): ShapeData {
  return {
    version: '1.0.0',
    paths: [
      {
        closed: true,
        points: [
          { x: 0.5, y: 0.1 },
          { x: 0.9, y: 0.9 },
          { x: 0.1, y: 0.9 },
        ],
      },
    ],
  };
}

describe('computeShapeHash', () => {
  it('מחזיר את אותו hash עבור אותה צורה בדיוק', async () => {
    const hashA = await computeShapeHash(triangle());
    const hashB = await computeShapeHash(triangle());
    expect(hashA).toBe(hashB);
  });

  it('מחזיר hash שונה לצורה גאומטרית שונה', async () => {
    const square: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: true,
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.8, y: 0.2 },
            { x: 0.8, y: 0.8 },
            { x: 0.2, y: 0.8 },
          ],
        },
      ],
    };
    const hashTriangle = await computeShapeHash(triangle());
    const hashSquare = await computeShapeHash(square);
    expect(hashTriangle).not.toBe(hashSquare);
  });

  it('מתעלם מרעש תת-פיקסלי (עיגול ל-4 ספרות אחרי הנקודה)', async () => {
    const base = triangle();
    const [basePath] = base.paths;
    if (!basePath) {
      throw new Error('unreachable: triangle() always has one path');
    }
    const jittered: ShapeData = {
      version: '1.0.0',
      paths: [
        {
          closed: true,
          points: basePath.points.map((point) => ({
            x: point.x + 0.000001,
            y: point.y - 0.000001,
          })),
        },
      ],
    };
    const hashBase = await computeShapeHash(base);
    const hashJittered = await computeShapeHash(jittered);
    expect(hashBase).toBe(hashJittered);
  });

  it('מייצר hash הקסדצימלי באורך 64 תווים (SHA-256)', async () => {
    const hash = await computeShapeHash(triangle());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
