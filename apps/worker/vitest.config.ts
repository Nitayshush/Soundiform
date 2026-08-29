/**
 * @file        vitest.config.ts
 * @description ⭐ Vitest, בניגוד ל-Next.js dev server, לא טוען .env/.env.local אוטומטית ל-process.env.
 *              בלי זה, בדיקות אינטגרציה שצריכות DATABASE_URL אמיתי (למשל renderAudio.test.ts,
 *              שכותב שורת renders אמיתית) נכשלות בשקט עם "undefined".
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: loadEnv('', process.cwd(), ''),
    // ⚠️ 2026-08-29 (נתפס כבדיקה שנכשלה לסירוגין): `pnpm run build` פולט את כל הקוד —
    // כולל קבצי הבדיקה — לתיקיית dist כ-JS מהודר. בלי החרגה מפורשת, vitest אסף גם את
    // קבצי הבדיקה המהודרים שם, הריץ כל בדיקה **פעמיים** (36 במקום 33), ושתי הרצות של
    // videoEncoder (ffmpeg + קבצים זמניים) במקביל נפלו לסירוגין. ה-CI לא נפגע כי הוא לא
    // בונה לפני הבדיקות — אבל מקומית, אחרי build, זה נראה כמו באג אקראי במוצר.
    // ⚠️ להשאיר כהערת-שורה: דפוס glob עם כוכבית-לוכסן סוגר הערת-בלוק באמצע.
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
