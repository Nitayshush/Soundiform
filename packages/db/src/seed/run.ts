/**
 * @file        run.ts
 * @description נקודת כניסה ל-CLI — `pnpm run db:seed-genres`.
 *
 * ⚠️ 2026-09-02: הסקריפט ב-package.json מריץ `tsx --env-file=.env`. בלי הדגל הזה
 * `getDb()` נופל מיד על "DATABASE_URL חסר" — שום דבר בשרשרת הזו לא טוען .env בעצמו,
 * בניגוד ל-apps/web שבו Next עושה את זה. נתפס בהרצה אמיתית מול הפרודקשן.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { seedGenrePacks } from './genrePacks';

seedGenrePacks()
  .then((count) => {
    console.error(`seedGenrePacks: ${String(count)} packs נכתבו/עודכנו ב-genre_packs`);
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('seedGenrePacks נכשל:', error);
    process.exit(1);
  });
