/**
 * @file        index.ts
 * @description נקודת הכניסה של שירות ה-worker — שרת Fastify + עיבוד תור BullMQ.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import Fastify from 'fastify';

// TODO(Sprint 6): רישום queue/renderQueue.ts, jobs/renderAudio.ts, אימות WORKER_SECRET,
// endpoint health-check, חיבור ל-Redis (Upstash).

const server = Fastify({ logger: true });

server.get('/health', () => ({ status: 'ok' }));

const port = Number(process.env.PORT ?? 3001);

server.listen({ port, host: '0.0.0.0' }).catch((error: unknown) => {
  server.log.error(error);
  process.exit(1);
});
