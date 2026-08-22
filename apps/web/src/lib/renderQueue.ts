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
 * ⭐ 2026-08-22 (§11 item 8): getRenderJobStatus נוסף — עד עכשיו jobId הוחזר מ-enqueueRenderJob
 * אבל שום קוד לא קרא אותו בחזרה (אין polling endpoint), אז לא הייתה דרך אמיתית לדעת מתי
 * render הסתיים. משתמש ב-BullMQ Job.getState()/returnvalue הקיימים — לא נדרש מנגנון חדש,
 * רק לחשוף אותו דרך route (ראה api/render/[jobId]/status/route.ts).
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { RENDER_QUEUE_NAME, type RenderJobData, type RenderJobResult } from '@soundiform/audio';

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

export interface RenderJobStatus {
  status: 'unknown' | 'waiting' | 'active' | 'completed' | 'failed';
  /** מוגדר רק כש-status === 'completed' — מ-job.returnvalue (בדיוק ה-RenderJobResult שהוחזר). */
  renderId?: string;
}

/**
 * בודק סטטוס job קיים. לא רגיש (לא חושף שום דבר מעבר ל"מה השלב") — קבצי הפלט עצמם
 * מוגנים דרך api/renders/[renderId]/download, לא כאן, אז אין צורך באימות-בעלות על הקריאה הזו.
 */
export async function getRenderJobStatus(jobId: string): Promise<RenderJobStatus> {
  const job = await getRenderQueue().getJob(jobId);
  if (!job) {
    return { status: 'unknown' };
  }
  const state = await job.getState();
  if (state === 'completed') {
    const result = job.returnvalue as RenderJobResult | undefined;
    return { status: 'completed', ...(result?.renderId && { renderId: result.renderId }) };
  }
  if (state === 'failed') {
    return { status: 'failed' };
  }
  if (state === 'active') {
    return { status: 'active' };
  }
  return { status: 'waiting' };
}
