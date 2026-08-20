/**
 * @file        renderAudio.test.ts
 * @description בדיקת אינטגרציה אמיתית ל-runRenderAudioJob: renderToBuffer/normalize/encode
 *              אמיתיים לגמרי (node-web-audio-api אמיתי, ffmpeg אמיתי) — רק ה-PUT הרשתי ל-R2
 *              מזויף (StorageProvider מינימלי), כי אין credentials אמיתיים בסביבת הבדיקה.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — סדר ה-imports: './renderAudio' (שמייבא '@soundiform/audio/server' ראשון, ראה שם)
 * חייב להופיע לפני '@soundiform/audio' הראשי כאן — אחרת ה-polyfill מגיע מאוחר מדי. ראה
 * packages/audio/src/index.ts.
 *
 * ⚠️ Sprint 8: runRenderAudioJob כותב שורת renders אמיתית ל-DB (FK על projects.id) — הבדיקה
 * יוצרת פרויקט חד-פעמי אמיתי (setup) ומוחקת אותו + ה-render שנוצר (teardown), כדי לא להשאיר
 * שורות-בדיקה מצטברות בסביבת הפיתוח. דורש DATABASE_URL/DIRECT_URL אמיתיים (ראה vitest.config.ts).
 */

import { describe, expect, it, vi } from 'vitest';
import { composeMusicalScore, geometryToMusic, type CompositionConfig } from '@soundiform/core';
import { eq } from 'drizzle-orm';
import { getDb, projects, renders } from '@soundiform/db';
import { runRenderAudioJob } from './renderAudio';
import { DEFAULT_AUDIO_CONFIG } from '@soundiform/audio';
import type { StorageProvider } from '@soundiform/storage';

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
  it('מרנדר, מנרמל ל-LUFS, מקודד WAV/MP3/MIDI אמיתיים, מעלה כל אחד למפתח הנכון, וכותב שורת renders', async () => {
    const score = makeTestScore();
    const { storage, uploads } = createFakeStorage();
    const db = getDb();

    const [project] = await db
      .insert(projects)
      .values({
        userId: null,
        shapeData: { version: '1.0.0', paths: [] },
        shapeHash: 'render-job-test-seed',
        sourceType: 'drawing',
      })
      .returning();
    if (!project) {
      throw new Error('יצירת פרויקט-בדיקה נכשלה');
    }

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
      const result = await runRenderAudioJob(
        { projectId: project.id, score, audioConfig: DEFAULT_AUDIO_CONFIG },
        storage,
      );

      expect(result.wavKey).toBe(`renders/${score.seed}/${score.genreId}/output.wav`);
      expect(result.mp3Key).toBe(`renders/${score.seed}/${score.genreId}/output.mp3`);
      expect(result.midiKey).toBe(`renders/${score.seed}/${score.genreId}/output.mid`);
      expect(typeof result.renderId).toBe('string');

      const wavBuffer = uploads.get(result.wavKey);
      expect(wavBuffer).toBeDefined();
      expect(wavBuffer?.subarray(0, 4).toString('ascii')).toBe('RIFF');

      const mp3Buffer = uploads.get(result.mp3Key);
      expect(mp3Buffer).toBeDefined();
      expect(mp3Buffer?.length).toBeGreaterThan(0);

      const midiBuffer = uploads.get(result.midiKey);
      expect(midiBuffer).toBeDefined();
      expect(midiBuffer?.subarray(0, 4).toString('ascii')).toBe('MThd');

      const [renderRow] = await db.select().from(renders).where(eq(renders.id, result.renderId));
      expect(renderRow?.projectId).toBe(project.id);
      expect(renderRow?.status).toBe('completed');
      expect(renderRow?.audioKey).toBe(result.wavKey);
    } finally {
      fetchSpy.mockRestore();
      await db.delete(renders).where(eq(renders.projectId, project.id));
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  }, 30000);

  it('Sprint 8: כשמבקשים video, מרנדר MP4 אמיתי, מעלה אותו, וכותב video_key על שורת ה-render', async () => {
    const score = makeTestScore();
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
    const { storage, uploads } = createFakeStorage();
    const db = getDb();

    const [project] = await db
      .insert(projects)
      .values({
        userId: null,
        shapeData: shape,
        shapeHash: 'render-job-video-test-seed',
        sourceType: 'drawing',
      })
      .returning();
    if (!project) {
      throw new Error('יצירת פרויקט-בדיקה נכשלה');
    }

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
      const result = await runRenderAudioJob(
        {
          projectId: project.id,
          score,
          audioConfig: DEFAULT_AUDIO_CONFIG,
          shape,
          video: { aspectRatio: '9:16', quality: '720p', watermark: true },
        },
        storage,
      );

      expect(result.videoKey).toBe(`renders/${score.seed}/${score.genreId}/output.mp4`);
      const videoBuffer = uploads.get(result.videoKey ?? '');
      expect(videoBuffer).toBeDefined();
      expect(videoBuffer?.subarray(4, 8).toString('ascii')).toBe('ftyp');

      const [renderRow] = await db.select().from(renders).where(eq(renders.id, result.renderId));
      expect(renderRow?.videoKey).toBe(result.videoKey);
    } finally {
      fetchSpy.mockRestore();
      await db.delete(renders).where(eq(renders.projectId, project.id));
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  }, 60000);
});
