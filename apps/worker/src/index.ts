/**
 * @file        index.ts
 * @description נקודת הכניסה של שירות ה-worker — שרת Fastify + עיבוד תור BullMQ.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import Fastify from 'fastify';
import { createR2ProviderFromEnv } from '@shape-sound/storage';
import { createRenderWorker } from './queue/renderQueue';

// ⚠️ נכתב אבל לא נבדק חי בסשן הזה — אין Redis מקומי/Upstash זמין (הוחלט מראש כחלק
// מהיקף Sprint 6 המאושר). /health לא דורש WORKER_SECRET בכוונה — infra health-check ציבורי;
// אין כרגע endpoint HTTP נוסף שדורש אימות (הרינדור מגיע דרך BullMQ/Redis, לא HTTP).

const server = Fastify({ logger: true });

server.get('/health', () => ({ status: 'ok' }));

const storage = createR2ProviderFromEnv();
const renderWorker = createRenderWorker(storage);

renderWorker.on('completed', (job) => {
  server.log.info({ jobId: job.id }, 'render job completed');
});
renderWorker.on('failed', (job, error) => {
  server.log.error({ jobId: job?.id, error }, 'render job failed');
});

const port = Number(process.env.PORT ?? 3001);

server.listen({ port, host: '0.0.0.0' }).catch((error: unknown) => {
  server.log.error(error);
  process.exit(1);
});

async function shutdown(): Promise<void> {
  await renderWorker.close();
  await server.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
