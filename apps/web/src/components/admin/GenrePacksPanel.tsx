/**
 * @file        GenrePacksPanel.tsx
 * @description ⭐ עריכת GenrePack ללא דיפלוי (§11 Sprint 9, פריט מרכזי) — is_active/sort_order/config.
 *              שינויים כאן משפיעים מיידית על GenreSelector/useAudioEngine/api/render (כולם
 *              נטענים מ-genre_packs ב-DB, ראה genrePacksStore.ts + api/genres/route.ts).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GenrePack } from '@soundiform/genres';

interface GenrePackRow {
  id: string;
  config: GenrePack;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'שגיאה';
}

async function patchGenrePack(body: {
  id: string;
  config?: GenrePack;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<GenrePackRow> {
  const response = await fetch('/api/admin/genre-packs', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json()) as { pack?: GenrePackRow; error?: string };
  if (!response.ok || !parsed.pack) {
    throw new Error(parsed.error ?? 'העדכון נכשל');
  }
  return parsed.pack;
}

function ConfigEditor({
  pack,
  onSaved,
}: {
  pack: GenrePackRow;
  onSaved: (row: GenrePackRow) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(pack.config, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(async (): Promise<void> => {
    setError(null);
    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(text);
    } catch {
      setError('JSON לא תקין');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await patchGenrePack({ id: pack.id, config: parsedConfig as GenrePack });
      onSaved(updated);
      setIsOpen(false);
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsSaving(false);
    }
  }, [pack.id, text, onSaved]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded border px-2 py-1 text-sm"
      >
        עריכת config
      </button>
    );
  }

  return (
    <div className="mt-2 w-full">
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        rows={16}
        className="w-full rounded border p-2 font-mono text-xs"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void save()}
          className="rounded border px-3 py-1 text-sm disabled:opacity-40"
        >
          {isSaving ? 'שומר…' : 'שמירה'}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded border px-3 py-1 text-sm"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

export function GenrePacksPanel() {
  const [packs, setPacks] = useState<GenrePackRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Promise-chain (לא async/await) בכוונה — ראה הערה זהה ב-ModerationPanel.tsx.
  const load = useCallback((): void => {
    fetch('/api/admin/genre-packs')
      .then((response) =>
        response.json().then((body: { packs?: GenrePackRow[]; error?: string }) => {
          if (!response.ok) {
            throw new Error(body.error ?? 'טעינה נכשלה');
          }
          setPacks(body.packs ?? []);
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

  const updateRow = useCallback((row: GenrePackRow) => {
    setPacks((current) => current.map((pack) => (pack.id === row.id ? row : pack)));
  }, []);

  const toggleActive = useCallback(
    (row: GenrePackRow) => {
      patchGenrePack({ id: row.id, isActive: !row.isActive })
        .then(updateRow)
        .catch((caughtError: unknown) => {
          setError(errorMessage(caughtError));
        });
    },
    [updateRow],
  );

  return (
    <div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}
      <ul className="flex flex-col gap-3">
        {packs.map((pack) => (
          <li key={pack.id} className="rounded border p-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => {
                  toggleActive(pack);
                }}
                className={`rounded border px-2 py-1 ${pack.isActive ? 'bg-foreground text-background' : ''}`}
              >
                {pack.isActive ? 'פעיל' : 'כבוי'}
              </button>
              <span className="font-mono">{pack.id}</span>
              <span className="text-muted-foreground">sort={pack.sortOrder}</span>
              <span>{pack.config.displayName?.he}</span>
              <ConfigEditor pack={pack} onSaved={updateRow} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
