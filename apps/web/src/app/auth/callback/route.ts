/**
 * @file        route.ts
 * @description יעד ה-redirect אחרי OAuth (Google) ואחרי אימות מייל — מחליף את ה-code
 *              שחוזר מ-Supabase ל-session אמיתי, ואז מפנה חזרה לעמוד שהמשתמש בא ממנו.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-09-06: acceptTerms=1 — (auth)/login/page.tsx מוסיף את זה ל-next כשההרשמה (לא
 * התחברות) נעשית עם ה-checkbox מסומן. שני המסלולים שנוחתים כאן (Google OAuth, והרשמת
 * אימייל+סיסמה כשיש אימות-מייל בהמתנה) לא עוברים דרך handleSubmit ב-login/page.tsx אחרי
 * שה-session נוצר, אז זו הנקודה המשותפת היחידה לסמן בה קבלת-תנאים לשני המסלולים האלה.
 * נכתב ישירות דרך getDb() (כבר בצד שרת כאן) ולא ע"י קריאה ל-api/account/accept-terms —
 * אין טעם בסבב-HTTP נוסף מהשרת לעצמו.
 */

import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/studio';
  const acceptTerms = searchParams.get('acceptTerms') === '1';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (acceptTerms && data.user) {
        await getDb()
          .update(users)
          .set({ termsAcceptedAt: new Date() })
          .where(and(eq(users.id, data.user.id), isNull(users.termsAcceptedAt)));
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
