/**
 * @file        env.ts
 * @description קריאת משתני הסביבה של Supabase, עם שגיאה מפורשת אם חסרים — לעולם לא ליפול
 *              בשקט על credentials חסרים (§0.3, אותו דפוס כמו R2Provider.createR2ProviderFromEnv).
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL חסר ב-.env');
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY חסר ב-.env');
  }
  return key;
}
