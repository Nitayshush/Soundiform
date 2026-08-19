/**
 * @file        vitest.config.ts
 * @description ⭐ Vitest, בניגוד ל-Next.js dev server, לא טוען .env/.env.local אוטומטית ל-process.env.
 *              בלי זה, בדיקות אינטגרציה שצריכות DATABASE_URL אמיתי (למשל renderAudio.test.ts,
 *              שכותב שורת renders אמיתית) נכשלות בשקט עם "undefined".
 * @author      Shape-to-Sound
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: loadEnv('', process.cwd(), ''),
  },
});
