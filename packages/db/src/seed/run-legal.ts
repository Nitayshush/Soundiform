/**
 * @file        run-legal.ts
 * @description נקודת כניסה ל-CLI — `pnpm run db:seed-legal`. ראה run.ts (הסקריפט המקביל
 *              ל-genre_packs) — קובץ נפרד ולא dispatcher משותף, כדי לא לגעת בסקריפט הקיים.
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { seedLegalPages } from './legalPages';

seedLegalPages()
  .then((count) => {
    console.error(`seedLegalPages: ${String(count)} pages נכתבו/עודכנו ב-legal_pages`);
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('seedLegalPages נכשל:', error);
    process.exit(1);
  });
