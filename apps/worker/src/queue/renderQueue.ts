/**
 * @file        renderQueue.ts
 * @description ⭐ צד ה-consumer של תור הרינדור (BullMQ Worker) — apps/web הוא ה-producer
 *              (Queue.add), ראה apps/web/src/lib/renderQueue.ts. שני הצדדים חולקים חוזה
 *              (RENDER_QUEUE_NAME, RenderJobData) דרך @shape-sound/audio/render/renderJob —
 *              בלי לייבא אחד את השני (§3: לא app תלוי ב-app).
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ נכתב אבל לא נבדק חי בסשן הזה — אין Redis מקומי/Upstash זמין לבדיקה (הוחלט מראש
 * כחלק מהיקף Sprint 6 המאושר).
 */

import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { RENDER_QUEUE_NAME, type RenderJobData, type RenderJobResult } from '@shape-sound/audio';
import type { StorageProvider } from '@shape-sound/storage';
import { runRenderAudioJob } from '../jobs/renderAudio';

function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL חסר ב-.env — נדרש לחיבור BullMQ (ioredis)');
  }
  // ⚠️ maxRetriesPerRequest: null — דרישה מתועדת של BullMQ (פקודות blocking מתנגשות
  // עם retry-logic ברירת המחדל של ioredis).
  return new IORedis(url, { maxRetriesPerRequest: null });
}

/** יוצר ומפעיל את ה-BullMQ Worker שצורך jobs מהתור ומרנדר אודיו בפועל. */
export function createRenderWorker(
  storage: StorageProvider,
): Worker<RenderJobData, RenderJobResult> {
  const connection = createRedisConnection();
  return new Worker<RenderJobData, RenderJobResult>(
    RENDER_QUEUE_NAME,
    async (job: Job<RenderJobData>) => runRenderAudioJob(job.data, storage),
    { connection },
  );
}
