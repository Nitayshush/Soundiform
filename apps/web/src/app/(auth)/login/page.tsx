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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: authError } =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (authError) {
        setError(authError.message);
        return;
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
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
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
        <Logo className="text-xl" />
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'One sec…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            className="w-full"
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
