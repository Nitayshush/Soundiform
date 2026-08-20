/**
 * @file        client.ts
 * @description לקוח Drizzle מחובר ל-Supabase Postgres, לפי DATABASE_URL (§10).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ DATABASE_URL הוא ה-pooler של Supabase במצב transaction (pgbouncer=true, פורט 6543) —
 * מצב הזה לא תומך prepared statements, לכן `prepare: false` חובה כאן (לא רק אופטימיזציה).
 * ל-migrations יש לקוח נפרד (drizzle.config.ts) שמשתמש ב-DIRECT_URL (חיבור ישיר, פורט 5432).
 *
 * lazy client בכוונה — אין חיבור בזמן import, רק כשמישהו קורא בפועל ל-getDb().
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL חסר ב-.env — נדרש לחיבור ל-Supabase Postgres');
  }
  const sql = postgres(url, { prepare: false });
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}
