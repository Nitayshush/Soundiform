/**
 * @file        drizzle.config.ts
 * @description קונפיגורציית drizzle-kit — generate/migrate. ראה PROJECT.md §6.
 * @author      Shape-to-Sound
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ DIRECT_URL (לא DATABASE_URL!) — migrations רצות DDL/prepared statements שלא
 * עובדים נכון מול ה-pooler במצב transaction (pgbouncer). ראה client.ts.
 */

import { defineConfig } from 'drizzle-kit';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error('DIRECT_URL חסר ב-.env — נדרש ל-drizzle-kit generate/migrate');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dbCredentials: { url: directUrl },
});
