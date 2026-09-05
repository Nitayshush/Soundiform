/**
 * @file        page.tsx
 * @description הרשמה/התחברות — אימייל+סיסמה, וגם Google OAuth. ראה PROJECT.md §11 Sprint 7.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ next/autoSave: אחרי אימות מצליח מפנים ל-next (ברירת מחדל /studio) — אם autoSave=1
 * מגיע איתו, ה-studio page עצמו (לא כאן) יבצע את השמירה בפועל, כי localStorage/shapeStore
 * זמינים רק שם. ה-flow הזה זהה בין אימייל+סיסמה ל-Google (ראה auth/callback/route.ts).
 *
 * ⭐ 2026-09-06: agreedToTerms — checkbox חובה **רק** במצב הרשמה (מי שכבר יש לו חשבון כבר
 * הסכים בזמנו). חוסם גם את שליחת הטופס וגם את "Continue with Google". קבלת-התנאים בפועל
 * מתועדת בשני מסלולים שונים: (א) הרשמת אימייל+סיסמה עם session מיידי (אין אימות-מייל
 * בהמתנה) — נקרא כאן ישירות ל-api/account/accept-terms אחרי signUp; (ב) Google OAuth
 * *וגם* הרשמת אימייל עם אימות-מייל בהמתנה — שני אלה תמיד עוברים דרך auth/callback/route.ts
 * מאוחר יותר (לא נחתמים כאן בכלל), אז מסמנים acceptTerms=1 על ה-redirectTo/emailRedirectTo
 * וה-callback הוא זה שבאמת כותב את התאריך (ראה שם).
 */

'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/branding/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Mode = 'signin' | 'signup';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/studio';

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
          setError(authError.message);
          return;
        }
        router.push(next);
        return;
      }

      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&acceptTerms=1`;
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl },
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      // ⚠️ session קיים מיד רק כשאין אימות-מייל בהמתנה — אחרת data.session הוא null וה-
      // אישור יירשם מאוחר יותר ב-auth/callback/route.ts כשהמשתמש ילחץ על קישור-האימות.
      if (data.session) {
        await fetch('/api/account/accept-terms', { method: 'POST' });
      }
      router.push(next);
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const supabase = createClient();
      const acceptTermsParam = mode === 'signup' ? '&acceptTerms=1' : '';
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}${acceptTermsParam}`,
        },
      });
      if (authError) {
        setError(authError.message);
      }
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center blur-3xl"
      >
        <div className="h-[28rem] w-[28rem] rounded-full bg-primary/20" />
      </div>

      <Link href="/">
        <Logo className="h-9" />
      </Link>

      <Card className="w-full max-w-sm border-border/60">
        <CardHeader>
          <CardTitle className="text-xl">{mode === 'signin' ? 'Sign in' : 'Sign up'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
            <Input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === 'signup' && (
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/terms" target="_blank" className="underline hover:text-foreground">
                    Terms of Service
                  </Link>
                </span>
              </label>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={isSubmitting || (mode === 'signup' && !agreedToTerms)}
              className="w-full"
            >
              {isSubmitting ? 'One sec…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={mode === 'signup' && !agreedToTerms}
            onClick={() => void handleGoogleSignIn()}
          >
            Continue with Google
          </Button>

          <Button
            type="button"
            variant="link"
            className="mx-auto"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
