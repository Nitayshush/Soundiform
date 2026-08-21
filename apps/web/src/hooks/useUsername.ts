/**
 * @file        useUsername.ts
 * @description ⭐ username של המשתמש המחובר (לקישור Header ל-/u/[username]). קורא ל-
 *              GET /api/account, לא ל-Supabase ישירות — כמו כל שאר הקוד בפרויקט (§0.3),
 *              שאילתות DB מהקליינט תמיד עוברות route בצד שרת, אף פעם לא ישירות מהדפדפן.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useEffect, useState } from 'react';
import { useSupabaseUser } from './useSupabaseUser';

export function useUsername(): string | null {
  const { user } = useSupabaseUser();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      // סנכרון חד-פעמי עם מצב חיצוני אמיתי (logout) — לא cascading render, ה-guard
      // (!user) מבטיח שזה קורה רק במעבר בפועל, לא בכל render (כמו useSaveProject.ts).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername(null);
      return;
    }
    let cancelled = false;
    fetch('/api/account')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (cancelled) {
          return;
        }
        const parsed = body as { user?: { username: string | null } } | null;
        setUsername(parsed?.user?.username ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setUsername(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return username;
}
