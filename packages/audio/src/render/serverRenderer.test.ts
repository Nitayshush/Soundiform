/**
 * @file        serverRenderer.test.ts
 * @description בדיקת רינדור אמיתית — לא מוק. מרנדרת MusicalScore אמיתי דרך node-web-audio-api
 *              ובודקת שהתוצאה היא אודיו PCM אמיתי (לא שקט, משך נכון, sample rate נכון).
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { composeMusicalScore, geometryToMusic, type CompositionConfig } from '@shape-sound/core';
import { renderToBuffer } from './serverRenderer';

const TEST_CONFIG: CompositionConfig = {
  genreId: 'test',
  tempoBpm: 120,
  mode: 'aeolian',
  gridSubdivision: 16,
  swingAmount: 0,
};

function makeTestScore() {
  const shape = {
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
  const intent = geometryToMusic(shape, 'server-renderer-test-seed');
  return composeMusicalScore(intent, TEST_CONFIG);
}

function rms(samples: Float32Array): number {
  let sumSquares = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
}

describe('renderToBuffer', () => {
  it('מרנדר אודיו אמיתי, לא שקט, באורך ובקצב-דגימה הנכונים', async () => {
    const score = makeTestScore();
    const rendered = await renderToBuffer(score);

    expect(rendered.sampleRate).toBe(44100);
    expect(rendered.channels).toHaveLength(2);

    const expectedSamples = Math.ceil(rendered.durationSeconds * rendered.sampleRate);
    for (const channel of rendered.channels) {
      expect(channel.length).toBeCloseTo(expectedSamples, -2); // בטולרנס של כמה samples
      expect(rms(channel)).toBeGreaterThan(0);
    }
  }, 20000);

  it('דטרמיניזם: אותו score מרונדר תמיד לאותו PCM בדיוק', async () => {
    const score = makeTestScore();
    const renderedA = await renderToBuffer(score);
    const renderedB = await renderToBuffer(score);

    expect(renderedA.channels[0]).toEqual(renderedB.channels[0]);
    expect(renderedA.channels[1]).toEqual(renderedB.channels[1]);
  }, 30000);
});
