/**
 * @file        server.ts
 * @description לקוח Supabase לצד שרת (Server Components / Route Handlers) — קורא/כותב
 *              cookies של session. תבנית מתועדת של Supabase ל-Next.js App Router.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ Server Component לא יכול לכתוב cookies (קריאה בלבד) — setAll נכשל בשקט שם בכוונה;
 * הרענון בפועל של ה-session קורה ב-middleware.ts. ראה תיעוד Supabase.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component — צפוי, ראה הערה למעלה.
        }
      },
    },
  });
}
