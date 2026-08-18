/**
 * @file        quantize.test.ts
 * @description בדיקות יחידה לקוונטיזציה — §4.3 כלל קשיח "הכל מקוונטז לגריד".
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { isOnGrid, quantizeToGrid, ticksPerGridUnit, TICKS_PER_BEAT } from './quantize';

describe('ticksPerGridUnit', () => {
  it('subdivision=16 שווה לרבע מ-TICKS_PER_BEAT (תו שש-עשרה)', () => {
    expect(ticksPerGridUnit(16)).toBe(TICKS_PER_BEAT / 4);
  });
});

describe('quantizeToGrid + isOnGrid', () => {
  it('מצמיד tick גולמי לגריד הקרוב ביותר', () => {
    const quantized = quantizeToGrid(37, 16);
    expect(isOnGrid(quantized, 16)).toBe(true);
  });

  it('tick שכבר על הגריד נשאר ללא שינוי', () => {
    const gridUnit = ticksPerGridUnit(16);
    expect(quantizeToGrid(gridUnit * 3, 16)).toBe(gridUnit * 3);
  });

  it('כל ערך אקראי בטווח סביר, אחרי קוונטיזציה, מזוהה כעל-הגריד', () => {
    for (let raw = 0; raw < 2000; raw += 17) {
      expect(isOnGrid(quantizeToGrid(raw, 16), 16)).toBe(true);
    }
  });
});
