/**
 * @file        LogoutButton.tsx
 * @description ⭐ 2026-09-03: יציאה מהחשבון מדף ניהול החשבון. עד עכשיו **לא הייתה שום דרך
 *              להתנתק** באתר — אפשר היה להיכנס ולא לצאת.
 * @author      Soundiform
 * @created     2026-09-03
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ אותה תבנית בדיוק כמו ההתחברות ב-(auth)/login: לקוח-דפדפן של Supabase + `useRouter`.
 * זה **לא** שרירותי — ה-session יושב ב-cookies שמנוהלים ע"י `createBrowserClient`, ולכן
 * `signOut()` מהדפדפן הוא מה שבאמת מוחק אותם.
 *
 * ⚠️ `router.refresh()` לפני ה-`push` הוא חובה ולא ניקיון: כל דפי החשבון/הגלריה הם Server
 * Components שה-Router Cache של Next שומר בזיכרון הלקוח. בלי refresh, ניווט חזרה היה מציג
 * HTML מרונדר-מראש של מישהו שעדיין מחובר — המשתמש מתנתק ורואה את עצמו מחובר.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async (): Promise<void> => {
    setError(null);
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signOut();
      if (authError) {
        // ⚠️ לא זורקים ולא מפנים: אם ה-signOut נכשל המשתמש **עדיין מחובר**, והפניה לדף
        // הבית הייתה משקרת לו שהוא יצא.
        setError(authError.message);
        return;
      }
      router.refresh();
      router.push('/');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not log out');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleLogout()}
        disabled={isSigningOut}
      >
        {isSigningOut ? 'Logging out…' : 'Log out'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
