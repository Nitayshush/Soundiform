/**
 * @file        route.ts
 * @description ⭐ 2026-09-06: מסמן שהמשתמש המחובר קיבל את תנאי השימוש — נקרא פעם אחת מיד
 *              אחרי הרשמה מוצלחת. שני מקומות קוראים לזה: (auth)/login/page.tsx (הרשמת
 *              אימייל+סיסמה, כשיש session מיידי — אין אימות-מייל בהמתנה), ו-auth/callback/
 *              route.ts (Google OAuth, וגם הרשמת אימייל כשיש אימות-מייל בהמתנה — שני
 *              המסלולים האלה נוחתים שם אחרי שה-session כבר קיים).
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ אידמפוטנטי בכוונה (WHERE terms_accepted_at IS NULL) — אם נקרא פעמיים (למשל המשתמש
 * רענן את דף ה-callback), לא דורס תאריך-קבלה אמיתי בתאריך-קריאה-חוזרת.
 */

import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  await getDb()
    .update(users)
    .set({ termsAcceptedAt: new Date() })
    .where(and(eq(users.id, user.id), isNull(users.termsAcceptedAt)));

  return NextResponse.json({ ok: true });
}
