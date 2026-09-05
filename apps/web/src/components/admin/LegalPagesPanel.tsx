/**
 * @file        LegalPagesPanel.tsx
 * @description ⭐ 2026-09-06: עריכת תוכן משפטי (תנאי שימוש) בלי דיפלוי — אותה תבנית בדיוק
 *              כמו GenrePacksPanel.tsx. שינוי כאן משפיע מיידית על /terms (Server Component
 *              שקורא legal_pages ישירות ב-getDb(), ראה app/(marketing)/terms/page.tsx).
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ רק slug='terms' בממשק כרגע — הטבלה עצמה גנרית (ראה packages/db/src/schema/legalPages.ts),
 * אבל אין עדיין דף/צורך שני (למשל מדיניות פרטיות) שמצדיק בורר-slug בממשק.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

const SLUG = 'terms';

interface LegalPageRow {
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error';
}

async function patchLegalPage(body: LegalPageRow): Promise<LegalPageRow> {
  const response = await fetch('/api/admin/legal-pages', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: body.slug, title: body.title, content: body.content }),
  });
  const parsed = (await response.json()) as { page?: LegalPageRow; error?: string };
  if (!response.ok || !parsed.page) {
    throw new Error(parsed.error ?? 'Save failed');
  }
  return parsed.page;
}

export function LegalPagesPanel() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Promise-chain (לא async/await) בכוונה — ראה הערה זהה ב-ModerationPanel.tsx/GenrePacksPanel.tsx.
  const load = useCallback((): void => {
    fetch('/api/admin/legal-pages')
      .then((response) =>
        response.json().then((body: { pages?: LegalPageRow[]; error?: string }) => {
          if (!response.ok) {
            throw new Error(body.error ?? 'Failed to load');
          }
          const page = (body.pages ?? []).find((row) => row.slug === SLUG);
          if (page) {
            setTitle(page.title);
            setContent(page.content);
            setUpdatedAt(page.updatedAt);
          }
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

  const save = useCallback((): void => {
    setError(null);
    setSaved(false);
    setIsSaving(true);
    patchLegalPage({ slug: SLUG, title, content, updatedAt: '' })
      .then((row) => {
        setUpdatedAt(row.updatedAt);
        setSaved(true);
      })
      .catch((caughtError: unknown) => {
        setError(errorMessage(caughtError));
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [title, content]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Editing <span className="font-mono">/terms</span>
        {updatedAt && ` — last saved ${new Date(updatedAt).toLocaleString('en-US')}`}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Content (blank line = new paragraph)
        <textarea
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
          }}
          rows={20}
          className="w-full rounded border p-2 font-mono text-xs"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isSaving || !title || !content}
          onClick={save}
          className="rounded border px-3 py-1 text-sm disabled:opacity-40"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-muted-foreground">Saved ✓</span>}
      </div>
    </div>
  );
}
