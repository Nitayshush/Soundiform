/**
 * @file        CommentSection.tsx
 * @description ⭐ 2026-08-22 (§11 גלריה): רשימת תגובות + טופס הוספה, לעמוד השיתוף. V1 מינימלי
 *              בכוונה — בלי pagination/rate-limit, ראה comments.ts. Promise-chain (לא
 *              async/await) בפונקציית הטעינה בכוונה: היא נקראת גם מתוך useEffect (טעינה
 *              ראשונית), ו-react-hooks/set-state-in-effect אוסר setState סינכרוני בפונקציה
 *              שנקראת ישירות מ-effect (ראה ModerationPanel.tsx/UsersPanel.tsx לתבנית זהה).
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { Button } from '@/components/ui/button';

interface CommentRow {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error';
}

export interface CommentSectionProps {
  renderId: string;
}

export function CommentSection({ renderId }: CommentSectionProps) {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [commentsList, setCommentsList] = useState<CommentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback((): void => {
    fetch(`/api/comments?renderId=${renderId}`)
      .then((response) =>
        response.json().then((body: { comments?: CommentRow[]; error?: string }) => {
          if (!response.ok) {
            throw new Error(body.error ?? 'Failed to load comments');
          }
          setCommentsList(body.comments ?? []);
        }),
      )
      .catch((caughtError: unknown) => {
        setError(errorMessage(caughtError));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [renderId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renderId, body: draft.trim() }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const responseBody = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(responseBody.error ?? 'Failed to post comment');
      }
      setDraft('');
      loadComments();
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (commentId: string): Promise<void> => {
    setError(null);
    try {
      const response = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (!response.ok) {
        const responseBody = (await response.json()) as { error?: string };
        throw new Error(responseBody.error ?? 'Failed to delete comment');
      }
      setCommentsList((current) => current.filter((comment) => comment.id !== commentId));
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {isLoading ? 'Comments…' : `${String(commentsList.length)} comments`}
      </h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a comment…"
          maxLength={1000}
          rows={2}
          className="w-full resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !draft.trim()}
          className="self-end"
        >
          {isSubmitting ? 'Posting…' : 'Post'}
        </Button>
      </form>
      <ul className="flex flex-col gap-3">
        {commentsList.map((comment) => (
          <li key={comment.id} className="flex items-start gap-2 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar host varies (signed-redirect route or external OAuth CDN) */}
            <img
              src={comment.avatarUrl ?? '/icon.svg'}
              alt=""
              className="size-6 shrink-0 rounded-full border border-border/60 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-medium">
                  {comment.displayName ?? `@${comment.username ?? 'unknown'}`}
                </span>{' '}
                <span className="whitespace-pre-wrap break-words text-muted-foreground">
                  {comment.body}
                </span>
              </p>
            </div>
            {user?.id === comment.userId && (
              <button
                type="button"
                onClick={() => void remove(comment.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
