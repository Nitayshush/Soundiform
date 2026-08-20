/**
 * @file        renderQueue.ts
 * @description ⭐ צד ה-producer של תור הרינדור (BullMQ Queue.add) — apps/worker הוא ה-consumer,
 *              ראה apps/worker/src/queue/renderQueue.ts. שני הצדדים חולקים חוזה
 *              (RENDER_QUEUE_NAME, RenderJobData) דרך @soundiform/audio, בלי לייבא אחד
 *              את השני (§3: לא app תלוי ב-app).
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ נכתב אבל לא נבדק חי בסשן הזה — אין Redis מקומי/Upstash זמין לבדיקה (הוחלט מראש
 * כחלק מהיקף Sprint 6 המאושר). שרת בלבד — לא לייבא מקומפוננטת קליינט ('use client').
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { RENDER_QUEUE_NAME, type RenderJobData } from '@soundiform/audio';

let queueInstance: Queue<RenderJobData> | null = null;

function getRenderQueue(): Queue<RenderJobData> {
  if (queueInstance) {
    return queueInstance;
  }
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL חסר ב-.env — נדרש לחיבור BullMQ (ioredis)');
  }
  const connection = new IORedis(url, { maxRetriesPerRequest: null });
  queueInstance = new Queue<RenderJobData>(RENDER_QUEUE_NAME, { connection });
  return queueInstance;
}

/** מוסיף job לתור הרינדור, מחזיר את ה-job id (לפולינג/סטטוס בהמשך). */
export async function enqueueRenderJob(data: RenderJobData): Promise<string> {
  const job = await getRenderQueue().add('render', data);
  if (!job.id) {
    throw new Error('BullMQ לא החזיר job.id');
  }
  return job.id;
}
