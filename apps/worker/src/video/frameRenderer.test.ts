/**
 * @file        frameRenderer.test.ts
 * @description בדיקות ל-renderVideoFrame/renderPosterFrame — במיוחד "שרטוט מסונכרן" (§11
 *              2026-08-22): הפריים ב-progress=0 שונה מהפריים ב-progress=1 (הצורה מצטיירת
 *              בהדרגה), ופריים ריק ב-progress=0 שונה מפריים עם shape data.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { composeMusicalScore, geometryToMusic, type CompositionConfig } from '@soundiform/core';
import type { ShapeData } from '@soundiform/shared';
import { renderPosterFrame, renderVideoFrame } from './frameRenderer';

const TEST_CONFIG: CompositionConfig = {
  genreId: 'test',
  tempoBpm: 120,
  mode: 'aeolian',
  gridSubdivision: 16,
  swingAmount: 0,
  chordProgression: [0, 5, 3, 4],
  extendedChords: false,
};

const TEST_SHAPE: ShapeData = {
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

const EMPTY_SHAPE: ShapeData = { version: '1.0.0', paths: [{ closed: false, points: [] }] };

function makeTestScore() {
  const intent = geometryToMusic(TEST_SHAPE, 'frame-renderer-test-seed');
  return composeMusicalScore(intent, TEST_CONFIG);
}

const DIMENSIONS = { width: 320, height: 180 };

describe('renderVideoFrame — שרטוט מסונכרן', () => {
  it('הפריים ב-progress=0 שונה מהפריים ב-progress=1 (הצורה מצטיירת בהדרגה)', async () => {
    const score = makeTestScore();
    const frameAtStart = await renderVideoFrame(score, 0, DIMENSIONS, false, TEST_SHAPE);
    const frameAtEnd = await renderVideoFrame(score, 1, DIMENSIONS, false, TEST_SHAPE);
    expect(frameAtStart.equals(frameAtEnd)).toBe(false);
  });

  it('פריים עם צורה שונה מפריים בלי צורה (אותו progress)', async () => {
    const score = makeTestScore();
    const withShape = await renderVideoFrame(score, 0.5, DIMENSIONS, false, TEST_SHAPE);
    const withoutShape = await renderVideoFrame(score, 0.5, DIMENSIONS, false, EMPTY_SHAPE);
    expect(withShape.equals(withoutShape)).toBe(false);
  });

  it('מחזיר PNG תקין (magic bytes)', async () => {
    const score = makeTestScore();
    const frame = await renderVideoFrame(score, 0.3, DIMENSIONS, false, TEST_SHAPE);
    expect(frame.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});

describe('renderPosterFrame', () => {
  it('מחזיר JPEG תקין (magic bytes)', async () => {
    const score = makeTestScore();
    const poster = await renderPosterFrame(score, DIMENSIONS, false, TEST_SHAPE);
    expect(poster.subarray(0, 2).toString('hex')).toBe('ffd8');
  });
});
