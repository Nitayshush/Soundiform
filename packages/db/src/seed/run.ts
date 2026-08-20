/**
 * @file        run.ts
 * @description נקודת כניסה ל-CLI — `pnpm run db:seed-genres`.
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
