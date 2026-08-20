/**
 * @file        AuditLogPanel.tsx
 * @description ⭐ צפייה ב-audit_log (§8 "audit_log לכל פעולת אדמין", §11 Sprint 9). קריאה בלבד.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

interface AuditLogEntry {
  id: string;
  action: string;
  target: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorEmail: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error';
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Promise-chain (לא async/await) בכוונה — ראה הערה זהה ב-ModerationPanel.tsx.
  const load = useCallback((): void => {
    fetch(`/api/admin/audit-log?offset=${String(offset)}`)
      .then((response) =>
        response
          .json()
          .then((body: { entries?: AuditLogEntry[]; pageSize?: number; error?: string }) => {
            if (!response.ok) {
              throw new Error(body.error ?? 'Failed to load');
            }
            setEntries(body.entries ?? []);
            setPageSize(body.pageSize ?? 100);
            setError(null);
          }),
      )
      .catch((caughtError: unknown) => {
        setError(errorMessage(caughtError));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [offset]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded border p-2 text-sm">
            <span className="font-mono">{entry.action}</span>
            {' → '}
            <span className="font-mono text-muted-foreground">{entry.target}</span>
            <div className="text-xs text-muted-foreground">
              {entry.actorEmail ?? '?'} · {new Date(entry.createdAt).toLocaleString('en-US')}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset((current) => Math.max(0, current - pageSize))}
          className="rounded border px-3 py-1 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={entries.length < pageSize}
          onClick={() => setOffset((current) => current + pageSize)}
          className="rounded border px-3 py-1 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
