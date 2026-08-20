/**
 * @file        ModerationPanel.tsx
 * @description ⭐ תור מודרציה — אישור/דחייה של פרויקטי SVG/raster שהועלו (§8, §11 Sprint 9).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ShapePath } from '@soundiform/shared';

type ModerationStatus = 'pending' | 'approved' | 'rejected';

interface ModerationItem {
  id: string;
  status: ModerationStatus;
  reason: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string | null;
    sourceType: 'drawing' | 'svg' | 'raster';
    uploadKey: string | null;
    shapeData: { paths: ShapePath[] };
  };
  ownerEmail: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error';
}

function ShapePreview({ paths }: { paths: ShapePath[] }) {
  return (
    <svg viewBox="0 0 100 100" className="h-16 w-16 shrink-0 rounded border bg-white">
      {paths
        .filter((path) => path.points.length >= 2)
        .map((path, index) => {
          const d = path.points
            .map(
              (point, pointIndex) =>
                `${pointIndex === 0 ? 'M' : 'L'} ${(point.x * 100).toFixed(1)} ${(point.y * 100).toFixed(1)}`,
            )
            .join(' ');
          return (
            <path
              key={index}
              d={`${d}${path.closed ? ' Z' : ''}`}
              fill="none"
              stroke="#111827"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
    </svg>
  );
}

export function ModerationPanel() {
  const [status, setStatus] = useState<ModerationStatus>('pending');
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  // Promise-chain (לא async/await) בכוונה: setState לפני ה-await הראשון ב-async function
  // נחשב "סינכרוני בתוך effect" ע"י react-hooks/set-state-in-effect (ראה useSupabaseUser.ts
  // לתבנית זהה) — כל עדכון state כאן קורה רק בתוך .then/.catch/.finally, גבול אסינכרוני אמיתי.
  const load = useCallback((): void => {
    fetch(`/api/admin/moderation?status=${status}`)
      .then((response) =>
        response.json().then((body: { items?: ModerationItem[]; error?: string }) => {
          if (!response.ok) {
            throw new Error(body.error ?? 'Failed to load');
          }
          setItems(body.items ?? []);
          setError(null);
        }),
      )
      .catch((caughtError: unknown) => {
        setError(errorMessage(caughtError));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (id: string, nextStatus: 'approved' | 'rejected'): Promise<void> => {
      setPendingActionId(id);
      try {
        const response = await fetch(`/api/admin/moderation/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? 'Action failed');
        }
        setItems((current) => current.filter((item) => item.id !== id));
      } catch (caughtError) {
        setError(errorMessage(caughtError));
      } finally {
        setPendingActionId(null);
      }
    },
    [],
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setStatus(option);
            }}
            className={`rounded border px-3 py-1 text-sm ${status === option ? 'bg-primary text-primary-foreground' : ''}`}
          >
            {option}
          </button>
        ))}
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No items.</p>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 rounded border p-3">
            <ShapePreview paths={item.project.shapeData.paths} />
            <div className="flex-1 text-sm">
              <p className="font-medium">{item.project.title ?? '(Untitled)'}</p>
              <p className="text-muted-foreground">
                {item.project.sourceType} · {item.ownerEmail ?? 'Anonymous'} ·{' '}
                {new Date(item.createdAt).toLocaleString('en-US')}
              </p>
            </div>
            {status === 'pending' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pendingActionId === item.id}
                  onClick={() => void act(item.id, 'approved')}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pendingActionId === item.id}
                  onClick={() => void act(item.id, 'rejected')}
                  className="rounded border px-3 py-1 text-sm text-destructive disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
