/**
 * @file        renderAudio.test.ts
 * @description בדיקת אינטגרציה אמיתית ל-runRenderAudioJob: renderToBuffer/normalize/encode
 *              אמיתיים לגמרי (node-web-audio-api אמיתי, ffmpeg אמיתי) — רק ה-PUT הרשתי ל-R2
 *              מזויף (StorageProvider מינימלי), כי אין credentials אמיתיים בסביבת הבדיקה.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — סדר ה-imports: './renderAudio' (שמייבא '@shape-sound/audio/server' ראשון, ראה שם)
 * חייב להופיע לפני '@shape-sound/audio' הראשי כאן — אחרת ה-polyfill מגיע מאוחר מדי. ראה
 * packages/audio/src/index.ts.
 */

import { describe, expect, it, vi } from 'vitest';
import { composeMusicalScore, geometryToMusic, type CompositionConfig } from '@shape-sound/core';
import { runRenderAudioJob } from './renderAudio';
import { DEFAULT_AUDIO_CONFIG } from '@shape-sound/audio';
import type { StorageProvider } from '@shape-sound/storage';

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
  const intent = geometryToMusic(shape, 'render-job-test-seed');
  return composeMusicalScore(intent, TEST_CONFIG);
}

/** מזייף רק את הצד הרשתי (PUT ל-R2) — getUploadUrl מחזיר URL מקומי, fetch נתפס ומאושר תמיד. */
function createFakeStorage(): { storage: StorageProvider; uploads: Map<string, Buffer> } {
  const uploads = new Map<string, Buffer>();
  const storage: StorageProvider = {
    id: 'fake',
    getUploadUrl: (key) => Promise.resolve(`http://fake-upload.local/${key}`),
    getDownloadUrl: (key) => Promise.resolve(`http://fake-download.local/${key}`),
    deleteObject: () => Promise.resolve(),
    headObject: () => Promise.resolve(null),
  };
  return { storage, uploads };
}

describe('runRenderAudioJob', () => {
  it('מרנדר, מנרמל ל-LUFS, מקודד WAV/MP3/MIDI אמיתיים, ומעלה כל אחד למפתח הנכון', async () => {
    const score = makeTestScore();
    const { storage, uploads } = createFakeStorage();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const key = url.replace('http://fake-upload.local/', '');
      const body = init?.body;
      if (body instanceof Uint8Array) {
        uploads.set(key, Buffer.from(body));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    try {
      const result = await runRenderAudioJob({ score, audioConfig: DEFAULT_AUDIO_CONFIG }, storage);

      expect(result).toEqual({
        wavKey: `renders/${score.seed}/${score.genreId}/output.wav`,
        mp3Key: `renders/${score.seed}/${score.genreId}/output.mp3`,
        midiKey: `renders/${score.seed}/${score.genreId}/output.mid`,
      });

      const wavBuffer = uploads.get(result.wavKey);
      expect(wavBuffer).toBeDefined();
      expect(wavBuffer?.subarray(0, 4).toString('ascii')).toBe('RIFF');

      const mp3Buffer = uploads.get(result.mp3Key);
      expect(mp3Buffer).toBeDefined();
      expect(mp3Buffer?.length).toBeGreaterThan(0);

      const midiBuffer = uploads.get(result.midiKey);
      expect(midiBuffer).toBeDefined();
      expect(midiBuffer?.subarray(0, 4).toString('ascii')).toBe('MThd');
    } finally {
      fetchSpy.mockRestore();
    }
  }, 30000);
});
