/**
 * @file        vitest.config.ts
 * @description ⭐ 2026-08-31: קונפיג מינימלי ל-vitest של apps/web — **רק** כדי לפתור את
 *              הכינוי `@/`.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ עד היום לא היה כאן קונפיג כלל, ולכן בדיקות לא יכלו לייבא מודול שמשתמש ב-`@/` — כלומר
 * כמעט כל קוד האפליקציה. הבדיקות הקיימות עקפו את זה בכך שנגעו רק במודולים שמייבאים
 * מחבילות-workspace או בנתיבים יחסיים. זה עיקם את **מה שנבדק** לפי מגבלת-כלים, לא לפי
 * חשיבות. הכינוי מוגדר כאן פעם אחת, זהה ל-tsconfig, ושום התנהגות אחרת של vitest לא נוגעה.
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
