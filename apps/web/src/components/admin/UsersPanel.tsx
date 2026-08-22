/**
 * @file        UsersPanel.tsx
 * @description ⭐ חיפוש משתמש + שינוי plan ידני (§11, תשתית תשלום — עד שPayPal יחובר).
 *
 * ⭐ 2026-08-22: גישה חופשית זמנית — שדה תאריך + "Grant free access" הופכים שינוי-plan
 * לזמני (חוזר לבד ל-plan האמיתי אחרי התאריך, ראה packages/db/src/planOverride.ts). שורה
 * עם מענק פעיל מציגה "Free access until X, will revert to Y" + כפתור "Revert now".
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

const PLAN_OPTIONS = ['free', 'pro', 'studio'] as const;
type PlanOption = (typeof PLAN_OPTIONS)[number];

interface AdminUserRow {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  plan: PlanOption;
  planSource: string;
  planOverrideExpiresAt: string | null;
  restorePlan: PlanOption | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error';
}

export function UsersPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserRow[]>([]);
  // ⭐ true כברירת מחדל — הטעינה הראשונית (useEffect למטה) לא יכולה לקרוא setIsSearching(true)
  // בעצמה (react-hooks/set-state-in-effect, ראה תיעוד ב-fetchUsers).
  const [isSearching, setIsSearching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [freeAccessDates, setFreeAccessDates] = useState<Record<string, string>>({});

  // Promise-chain בלי setState סינכרוני לפני ה-.then הראשון בכוונה: הפונקציה הזו נקראת גם
  // מתוך useEffect (טעינה ראשונית), ו-react-hooks/set-state-in-effect אוסר setState סינכרוני
  // בכל פונקציה שנקראת ישירות מ-effect (ראה ModerationPanel.tsx לתבנית זהה) — קוראים ל-Search/
  // Clear מגדירים isSearching/error בעצמם *לפני* קריאה ל-fetchUsers, כי הם לא בתוך effect.
  const fetchUsers = useCallback((searchQuery: string): void => {
    fetch(`/api/admin/users?query=${encodeURIComponent(searchQuery.trim())}`)
      .then((response) =>
        response.json().then((body: { users?: AdminUserRow[]; error?: string }) => {
          if (!response.ok) {
            throw new Error(body.error ?? 'Search failed');
          }
          setResults(body.users ?? []);
          setError(null);
        }),
      )
      .catch((caughtError: unknown) => {
        setError(errorMessage(caughtError));
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, []);

  // ⭐ 2026-08-22: query ריק בטעינה ראשונה טוען את 30 המשתמשים האחרונים (ראה route.ts) —
  // בלי זה הפאנל מתחיל ריק וייראה כאילו משתמש חדש "לא קיים" עד שמחפשים אותו במפורש.
  useEffect(() => {
    fetchUsers('');
  }, [fetchUsers]);

  const search = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setIsSearching(true);
    setError(null);
    fetchUsers(query);
  };

  const setPlan = async (userId: string, plan: PlanOption): Promise<void> => {
    setSavingId(userId);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan, planSource: 'manual' }),
      });
      const body = (await response.json()) as { user?: AdminUserRow; error?: string };
      if (!response.ok || !body.user) {
        throw new Error(body.error ?? 'Update failed');
      }
      const updatedUser = body.user;
      setResults((current) =>
        current.map((row) => (row.id === userId ? { ...row, ...updatedUser } : row)),
      );
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setSavingId(null);
    }
  };

  const grantFreeAccess = async (userId: string, plan: PlanOption): Promise<void> => {
    const dateValue = freeAccessDates[userId];
    if (!dateValue) {
      setError('Pick a date first');
      return;
    }
    setSavingId(userId);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          plan,
          planSource: 'manual',
          // ⭐ 2026-08-22: input type="date" נותן "YYYY-MM-DD" — new Date() על זה מתפרש כחצות
          // UTC, כלומר "היום" תמיד ייפסל כ"עבר" ו"מחר" עלול ליפול מוקדם מהצפוי במזרח ל-UTC.
          // הוספת שעה הופכת את הפירוש ל-local time — סוף היום שנבחר, לפי הלוח של האדמין עצמו.
          freeAccessUntil: new Date(`${dateValue}T23:59:59`).toISOString(),
        }),
      });
      const body = (await response.json()) as { user?: AdminUserRow; error?: string };
      if (!response.ok || !body.user) {
        throw new Error(body.error ?? 'Grant failed');
      }
      const updatedUser = body.user;
      setResults((current) =>
        current.map((row) => (row.id === userId ? { ...row, ...updatedUser } : row)),
      );
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setSavingId(null);
    }
  };

  const revertNow = async (userId: string): Promise<void> => {
    setSavingId(userId);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, revertNow: true }),
      });
      const body = (await response.json()) as { user?: AdminUserRow; error?: string };
      if (!response.ok || !body.user) {
        throw new Error(body.error ?? 'Revert failed');
      }
      const updatedUser = body.user;
      setResults((current) =>
        current.map((row) => (row.id === userId ? { ...row, ...updatedUser } : row)),
      );
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <form onSubmit={search} className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email or username"
          className="rounded border px-2 py-1 text-sm"
        />
        <button type="submit" disabled={isSearching} className="rounded border px-3 py-1 text-sm">
          {isSearching ? 'Searching…' : 'Search'}
        </button>
        {query && (
          <button
            type="button"
            disabled={isSearching}
            onClick={() => {
              setQuery('');
              setIsSearching(true);
              setError(null);
              fetchUsers('');
            }}
            className="rounded border px-3 py-1 text-sm"
          >
            Clear
          </button>
        )}
      </form>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">{isSearching ? 'Loading…' : 'No results.'}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 rounded border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p>
                    {row.email}{' '}
                    {row.username && <span className="text-muted-foreground">@{row.username}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">source: {row.planSource}</p>
                  {row.restorePlan && row.planOverrideExpiresAt && (
                    <p className="text-xs text-amber-600">
                      Free access until {new Date(row.planOverrideExpiresAt).toLocaleString()}, will
                      revert to {row.restorePlan}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  {PLAN_OPTIONS.map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => void setPlan(row.id, plan)}
                      className={`rounded border px-2 py-1 text-xs capitalize ${
                        row.plan === plan ? 'bg-primary text-primary-foreground' : ''
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t pt-2">
                <input
                  type="date"
                  value={freeAccessDates[row.id] ?? ''}
                  onChange={(event) =>
                    setFreeAccessDates((current) => ({ ...current, [row.id]: event.target.value }))
                  }
                  className="rounded border px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  disabled={savingId === row.id}
                  onClick={() => void grantFreeAccess(row.id, 'studio')}
                  className="rounded border px-2 py-1 text-xs"
                >
                  Grant free access until date
                </button>
                {row.restorePlan && (
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() => void revertNow(row.id)}
                    className="rounded border px-2 py-1 text-xs text-destructive"
                  >
                    Revert now
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
