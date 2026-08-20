/**
 * @file        proxy.ts
 * @description ⭐ מרענן את ה-session של Supabase בכל בקשה — תבנית מתועדת. בלי זה, session
 *              תפוגה לא תתעדכן ב-cookies, ומשתמש יתנתק "באמצע" בלי סיבה נראית לעין.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ getUser() (לא getSession()) — getUser מאמת את ה-JWT מול Supabase Auth server בפועל,
 * getSession רק קורא cookie מקומי בלי אימות. תיעוד Supabase מדגיש את זה כקריטי לאבטחה.
 *
 * ⚠️ שם הקובץ/הפונקציה: Next.js 16 שינה את השם מ-middleware.ts ל-proxy.ts (ראה
 * next.config docs, "Middleware is deprecated and renamed to Proxy" — v16.0.0).
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
