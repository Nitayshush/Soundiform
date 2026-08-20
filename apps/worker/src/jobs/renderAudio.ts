/**
 * @file        renderAudio.ts
 * @description ⭐ רנדור אודיו בשרת מ-MusicalScore — אותו קוד כמו הפריוויו בדפדפן.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי: חייב להשתמש ב-packages/audio/src/render/serverRenderer.ts —
 * לעולם לא לוגיקת רנדור כפולה/נפרדת מהפריוויו. ראה PROJECT.md §11 Sprint 6 (בדיקה: פריוויו ≈ פלט סופי).
 *
 * זרימה: renderToBuffer (PCM) → normalizeToTargetLufs (§4.3, -14 LUFS) → קידוד WAV/MP3/MIDI
 * (encoders/*) → PUT ל-R2 → כתיבת שורת renders (§6) → אם video מבוקש: renderVideo.ts
 * (משתמש באותו wavBuffer, לא מרנדר מחדש) → PUT ל-R2 → עדכון video_key.
 *
 * ⚠️ קריטי — סדר ה-imports: '@soundiform/audio/server' *חייב* להיות לפני '@soundiform/audio'
 * הראשי בקובץ הזה. serverRenderer.ts (שם) מתקין polyfill ל-globalThis.window לפני ש-'tone'
 * נטען — וזה חייב לקרות לפני שכל קובץ אחר בתהליך נוגע ב-'tone' (כולל דרך הנתיב הראשי, למשל
 * בשביל normalizeToTargetLufs). ראה packages/audio/src/index.ts להסבר המלא.
 */

import { renderToBuffer } from '@soundiform/audio/server';
import { normalizeToTargetLufs, type RenderJobData, type RenderJobResult } from '@soundiform/audio';
import { eq } from 'drizzle-orm';
import { getDb, renders } from '@soundiform/db';
import type { StorageProvider } from '@soundiform/storage';
import { encodeWav } from '../encoders/wav';
import { encodeMidi } from '../encoders/midi';
import { encodeMp3 } from '../encoders/mp3';
import { runRenderVideoJob } from './renderVideo';

const ENGINE_VERSION = 'v1';

async function uploadBuffer(
  storage: StorageProvider,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const uploadUrl = await storage.getUploadUrl(key, { contentType });
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: { 'Content-Type': contentType },
  });
  if (!response.ok) {
    throw new Error(
      `העלאה ל-R2 נכשלה עבור ${key}: ${String(response.status)} ${response.statusText}`,
    );
  }
}

/**
 * מרנדר MusicalScore לקבצי WAV/MP3/MIDI (ואופציונלית וידאו) ומעלה ל-R2, כותב שורת renders.
 */
export async function runRenderAudioJob(
  data: RenderJobData,
  storage: StorageProvider,
): Promise<RenderJobResult> {
  const { projectId, score, audioConfig, shape, video } = data;

  const rendered = await renderToBuffer(score, audioConfig);
  const normalizedChannels = normalizeToTargetLufs(rendered.channels);
  const wavBuffer = encodeWav({ sampleRate: rendered.sampleRate, channels: normalizedChannels });
  const midiBuffer = encodeMidi(score);
  const mp3Buffer = await encodeMp3(wavBuffer);

  const keyPrefix = `renders/${score.seed}/${score.genreId}`;
  const wavKey = `${keyPrefix}/output.wav`;
  const mp3Key = `${keyPrefix}/output.mp3`;
  const midiKey = `${keyPrefix}/output.mid`;

  await Promise.all([
    uploadBuffer(storage, wavKey, wavBuffer, 'audio/wav'),
    uploadBuffer(storage, mp3Key, mp3Buffer, 'audio/mpeg'),
    uploadBuffer(storage, midiKey, midiBuffer, 'audio/midi'),
  ]);

  const db = getDb();
  const [renderRow] = await db
    .insert(renders)
    .values({
      projectId,
      genreId: score.genreId,
      score,
      engineVersion: ENGINE_VERSION,
      audioKey: wavKey,
      midiKey,
      durationSec: rendered.durationSeconds,
      status: 'completed',
      tempoBpm: score.tempo,
      rootFreqHz: score.metadata.rootFrequencyHz,
      avgNoteDensity: score.metadata.avgNoteDensity,
      dominantMode: score.metadata.dominantMode,
    })
    .returning();
  if (!renderRow) {
    throw new Error('כתיבת שורת renders נכשלה — לא הוחזרה שורה');
  }

  let videoKey: string | undefined;
  if (video && shape) {
    videoKey = await runRenderVideoJob(
      shape,
      rendered.durationSeconds,
      wavBuffer,
      video,
      storage,
      keyPrefix,
    );
    await db.update(renders).set({ videoKey }).where(eq(renders.id, renderRow.id));
  }

  return {
    renderId: renderRow.id,
    wavKey,
    mp3Key,
    midiKey,
    ...(videoKey !== undefined && { videoKey }),
  };
}
