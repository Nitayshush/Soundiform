/**
 * @file        route.ts
 * @description יעד ה-redirect אחרי OAuth (Google) ואחרי אימות מייל — מחליף את ה-code
 *              שחוזר מ-Supabase ל-session אמיתי, ואז מפנה חזרה לעמוד שהמשתמש בא ממנו.
 * @author      Shape-to-Sound
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/studio';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
