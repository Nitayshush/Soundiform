/**
 * @file        FeatureFlagsPanel.tsx
 * @description ⭐ עריכת feature flags בלי דיפלוי (§11 Sprint 9). ⚠️ הפעלה/כיבוי של סגנון
 *              (כמו reggae) נעשה דרך GenrePacksPanel (genre_packs.is_active), לא כאן — הדגלים
 *              כאן מיועדים לטוגלים גלובליים שאינם קשורים לסגנון ספציפי.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

interface FeatureFlag {
  key: string;
  value: boolean;
  description: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error';
}

export function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');

  // Promise-chain (לא async/await) בכוונה — ראה הערה זהה ב-ModerationPanel.tsx.
  const load = useCallback((): void => {
    fetch('/api/admin/feature-flags')
      .then((response) =>
        response.json().then((body: { flags?: FeatureFlag[]; error?: string }) => {
          if (!response.ok) {
            throw new Error(body.error ?? 'Failed to load');
          }
          setFlags(body.flags ?? []);
          setError(null);
        }),
      )
      .catch((caughtError: unknown) => {
        setError(errorMessage(caughtError));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setFlag = useCallback(async (key: string, value: boolean): Promise<void> => {
    try {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const body = (await response.json()) as { flag?: FeatureFlag; error?: string };
      if (!response.ok || !body.flag) {
        throw new Error(body.error ?? 'Update failed');
      }
      const updatedFlag = body.flag;
      setFlags((current) => {
        const exists = current.some((flag) => flag.key === key);
        return exists
          ? current.map((flag) => (flag.key === key ? updatedFlag : flag))
          : [...current, updatedFlag];
      });
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    }
  }, []);

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <ul className="mb-4 flex flex-col gap-2">
        {flags.map((flag) => (
          <li key={flag.key} className="flex items-center gap-3 rounded border p-3 text-sm">
            <button
              type="button"
              onClick={() => void setFlag(flag.key, !flag.value)}
              className={`rounded border px-2 py-1 ${flag.value ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {flag.value ? 'On' : 'Off'}
            </button>
            <span className="font-mono">{flag.key}</span>
            {flag.description && (
              <span className="text-muted-foreground">— {flag.description}</span>
            )}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!newKey.trim()) return;
          void setFlag(newKey.trim(), false).then(() => {
            setNewKey('');
          });
        }}
        className="flex gap-2"
      >
        <input
          value={newKey}
          onChange={(event) => {
            setNewKey(event.target.value);
          }}
          placeholder="new key, e.g. signups.enabled"
          className="rounded border px-2 py-1 text-sm"
        />
        <button type="submit" className="rounded border px-3 py-1 text-sm">
          Add (off by default)
        </button>
      </form>
    </div>
  );
}
