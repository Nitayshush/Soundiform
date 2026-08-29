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
 *
 * ⭐ §11 stems (studio בלבד, data.stems כבר מסונן ל-plan==='studio' ב-apps/web, ראה
 * renderJob.ts): "stem" של track בודד הוא בדיוק אותה renderToBuffer, רק עם
 * `{ ...score, tracks: [track] }` — אפס לוגיקת רינדור חדשה. דטרמיניזם נשמר: אפיק-הריוורב
 * המשותף (sharedReverb.ts, ראה sharedScheduling.ts) הוא עדיין קונבולוציה דטרמיניסטית
 * (reverbSeed=`score.seed`, אחד ליצירה כולה עכשיו — לא per-track), ומערכת ליניארית (בלי
 * לולאת-משוב) — reverb(track) בלבד + reverb(track אחר) בלבד = reverb(שניהם ביחד) — אז ה-stem
 * עדיין זהה בדיוק לתרומת אותו track בתוך המיקס המלא, גם שהאפיק עצמו משותף.
 * ⭐ 2026-08-28 (שדרוג-תשתית): לפני זה, לכל track היה Convolver-ריוורב *נפרד* (seed נגזר
 * מ-role) — עכשיו כל הטראקים חולקים בדיוק את אותו "חלל" אקוסטי (ריאליסטי יותר, וזול יותר
 * ב-CPU — קונבולוציה אחת במקום N). ⚠️ ניסיון-ביניים להחליף את הקונבולוציה בריוורב-אלגוריתמי
 * (comb-filter feedback bank, זול יותר עוד) הופרך בבדיקה-חיה-ארוכה: חוסר-יציבות אמיתי
 * שגרם לשריקה-הולכת-ומתחזקת אחרי כ-15 שניות של ניגון-בלולאה — לא נחשף בבדיקות-קצרות. חזרנו
 * לקונבולוציה (יציבה מתמטית מבנייה, בלי לולאת-משוב) — ראה ההערה המלאה ב-sharedReverb.ts.
 *
 * ⭐ 2026-08-23: ENGINE_VERSION → v2 — geometryToMusic.ts's pitchContour עבר מדגימה לפי
 * אורך-קשת (סדר-ציור) לדגימה לפי מיקום-X (§4.2 "ציר X → זמן", ראה xAxisResample.ts) — אותה
 * צורה בדיוק מייצרת מלודיה שונה מעכשיו, דטרמיניסטית אבל לא זהה לגרסה הקודמת.
 */

import { renderToBuffer } from '@soundiform/audio/server';
import { normalizeToTargetLufs, type RenderJobData, type RenderJobResult } from '@soundiform/audio';
import type { TrackRole } from '@soundiform/core';
import { eq } from 'drizzle-orm';
import { getDb, renders } from '@soundiform/db';
import type { StorageProvider } from '@soundiform/storage';
import { encodeWav } from '../encoders/wav';
import { encodeMidi } from '../encoders/midi';
import { encodeMp3 } from '../encoders/mp3';
import { uploadBuffer } from '../storage/uploadBuffer';
import { runRenderVideoJob } from './renderVideo';

const ENGINE_VERSION = 'v2';

/**
 * מרנדר MusicalScore לקבצי WAV/MP3/MIDI (ואופציונלית וידאו) ומעלה ל-R2, כותב שורת renders.
 */
async function renderStems(
  score: RenderJobData['score'],
  audioConfig: RenderJobData['audioConfig'],
  storage: StorageProvider,
  keyPrefix: string,
): Promise<Partial<Record<TrackRole, string>>> {
  const stemKeys: Partial<Record<TrackRole, string>> = {};
  for (const track of score.tracks) {
    const stemRendered = await renderToBuffer({ ...score, tracks: [track] }, audioConfig);
    const stemChannels = normalizeToTargetLufs(stemRendered.channels);
    const stemWav = encodeWav({ sampleRate: stemRendered.sampleRate, channels: stemChannels });
    const stemKey = `${keyPrefix}/stems/${track.role}.wav`;
    await uploadBuffer(storage, stemKey, stemWav, 'audio/wav');
    stemKeys[track.role] = stemKey;
  }
  return stemKeys;
}

export async function runRenderAudioJob(
  data: RenderJobData,
  storage: StorageProvider,
): Promise<RenderJobResult> {
  const { projectId, score, audioConfig, shapeData, video, stems } = data;

  const rendered = await renderToBuffer(score, audioConfig);
  const normalizedChannels = normalizeToTargetLufs(rendered.channels);
  const wavBuffer = encodeWav({ sampleRate: rendered.sampleRate, channels: normalizedChannels });
  const midiBuffer = encodeMidi(score);
  const mp3Buffer = await encodeMp3(wavBuffer);

  const keyPrefix = `renders/${score.seed}/${score.genreId}`;
  const wavKey = `${keyPrefix}/output.wav`;
  const mp3Key = `${keyPrefix}/output.mp3`;
  const midiKey = `${keyPrefix}/output.mid`;

  const [, , , stemKeys] = await Promise.all([
    uploadBuffer(storage, wavKey, wavBuffer, 'audio/wav'),
    uploadBuffer(storage, mp3Key, mp3Buffer, 'audio/mpeg'),
    uploadBuffer(storage, midiKey, midiBuffer, 'audio/midi'),
    stems ? renderStems(score, audioConfig, storage, keyPrefix) : Promise.resolve(undefined),
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
      mp3Key,
      midiKey,
      ...(stemKeys && { stemKeys }),
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
  let posterKey: string | undefined;
  if (video) {
    const videoResult = await runRenderVideoJob(
      score,
      rendered.durationSeconds,
      wavBuffer,
      video,
      storage,
      keyPrefix,
      shapeData,
    );
    videoKey = videoResult.videoKey;
    posterKey = videoResult.posterKey;
    await db.update(renders).set({ videoKey, posterKey }).where(eq(renders.id, renderRow.id));
  }

  return {
    renderId: renderRow.id,
    wavKey,
    mp3Key,
    midiKey,
    ...(videoKey !== undefined && { videoKey }),
    ...(posterKey !== undefined && { posterKey }),
    ...(stemKeys && { stemKeys }),
  };
}
