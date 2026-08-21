/**
 * @file        UsersPanel.tsx
 * @description ⭐ חיפוש משתמש + שינוי plan ידני (§11, תשתית תשלום — עד שPayPal יחובר).
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useState } from 'react';

const PLAN_OPTIONS = ['free', 'pro', 'studio'] as const;
type PlanOption = (typeof PLAN_OPTIONS)[number];

interface AdminUserRow {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  plan: PlanOption;
  planSource: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error';
}

export function UsersPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const search = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?query=${encodeURIComponent(query.trim())}`);
      const body = (await response.json()) as { users?: AdminUserRow[]; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'Search failed');
      }
      setResults(body.users ?? []);
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsSearching(false);
    }
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

  return (
    <div>
      <form onSubmit={(event) => void search(event)} className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email or username"
          className="rounded border px-2 py-1 text-sm"
        />
        <button type="submit" disabled={isSearching} className="rounded border px-3 py-1 text-sm">
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No results.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded border p-3 text-sm"
            >
              <div>
                <p>
                  {row.email}{' '}
                  {row.username && <span className="text-muted-foreground">@{row.username}</span>}
                </p>
                <p className="text-xs text-muted-foreground">source: {row.planSource}</p>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
