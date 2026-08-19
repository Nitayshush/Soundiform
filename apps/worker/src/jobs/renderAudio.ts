/**
 * @file        renderAudio.ts
 * @description ⭐ רנדור אודיו בשרת מ-MusicalScore — אותו קוד כמו הפריוויו בדפדפן.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי: חייב להשתמש ב-packages/audio/src/render/serverRenderer.ts —
 * לעולם לא לוגיקת רנדור כפולה/נפרדת מהפריוויו. ראה PROJECT.md §11 Sprint 6 (בדיקה: פריוויו ≈ פלט סופי).
 *
 * זרימה: renderToBuffer (PCM) → normalizeToTargetLufs (§4.3, -14 LUFS) → קידוד WAV/MP3/MIDI
 * (encoders/*) → PUT ל-R2 דרך presigned URL (StorageProvider לא חושף put ישיר בכוונה —
 * §7 "גישה לאחסון רק דרך presigned URLs").
 *
 * ⚠️ קריטי — סדר ה-imports: '@shape-sound/audio/server' *חייב* להיות לפני '@shape-sound/audio'
 * הראשי בקובץ הזה. serverRenderer.ts (שם) מתקין polyfill ל-globalThis.window לפני ש-'tone'
 * נטען — וזה חייב לקרות לפני שכל קובץ אחר בתהליך נוגע ב-'tone' (כולל דרך הנתיב הראשי, למשל
 * בשביל normalizeToTargetLufs). ראה packages/audio/src/index.ts להסבר המלא.
 */

import { renderToBuffer } from '@shape-sound/audio/server';
import {
  normalizeToTargetLufs,
  type RenderJobData,
  type RenderJobResult,
} from '@shape-sound/audio';
import type { StorageProvider } from '@shape-sound/storage';
import { encodeWav } from '../encoders/wav';
import { encodeMidi } from '../encoders/midi';
import { encodeMp3 } from '../encoders/mp3';

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
 * מרנדר MusicalScore לקבצי WAV/MP3/MIDI סופיים ומעלה ל-R2. מחזיר את המפתחות (keys) שהועלו.
 */
export async function runRenderAudioJob(
  data: RenderJobData,
  storage: StorageProvider,
): Promise<RenderJobResult> {
  const { score, audioConfig } = data;

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

  return { wavKey, mp3Key, midiKey };
}
