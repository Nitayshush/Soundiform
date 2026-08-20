/**
 * @file        index.ts
 * @description נקודת הכניסה של שירות ה-worker — שרת Fastify + עיבוד תור BullMQ.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — import '@soundiform/audio/server' חייב להיות ה-import הראשון בקובץ הזה
 * (נקודת הכניסה האמיתית של כל תהליך ה-worker): מתקין polyfill ל-globalThis.window לפני
 * ש-'tone' נטען בכל מקום אחר בתהליך. הגנה כפולה מעבר לסדר הנכון ב-queue/renderQueue.ts —
 * ראה packages/audio/src/index.ts להסבר המלא (זה *לא* import שנכשל בשקט, הוא side-effect בלבד).
 *
 * ⚠️ process.loadEnvFile('.env.local') — בניגוד ל-Next.js, tsx לא טוען .env אוטומטית.
 * `tsx watch --env-file=...` נראה כמו פתרון, אבל ה-flag *לא* שורד את ה-respawn הפנימי של
 * watch mode על שינוי קובץ (נתפס בבדיקה חיה: קריסה על REDIS_URL חסר אחרי rerun ראשון) —
 * לכן הטעינה חייבת להיות בקוד עצמו, לא ב-CLI flag. .env.local כאן הוא hard link לשורש .env
 * (אותו דפוס בדיוק כמו apps/web, ראה docs/DECISIONS.md).
 */

import '@soundiform/audio/server';
process.loadEnvFile('.env.local');

import Fastify from 'fastify';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import { createRenderWorker } from './queue/renderQueue';

const server = Fastify({ logger: true });

server.get('/health', () => ({ status: 'ok' }));

const storage = createR2ProviderFromEnv();
const renderWorker = createRenderWorker(storage);

renderWorker.on('completed', (job) => {
  server.log.info({ jobId: job.id }, 'render job completed');
});
renderWorker.on('failed', (job, error) => {
  // ⚠️ המפתח חייב להיות 'err' (לא 'error') — pino מפעיל serializer מובנה ל-Error רק
  // עבור המפתח הזה בדיוק; אחרת message/stack נבלעים בשקט (JSON.stringify על Error → {}).
  server.log.error({ jobId: job?.id, err: error }, 'render job failed');
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
