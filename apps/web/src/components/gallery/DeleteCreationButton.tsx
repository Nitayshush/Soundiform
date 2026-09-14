/**
 * @file        DeleteCreationButton.tsx
 * @description ⭐ 2026-09-13 (לפי בקשה חיה): מחיקה מלאה של כרטיס-יצירה/טיוטה. מקבל את נתיב
 *              ה-DELETE כפרמטר — ב-My Gallery זה `/api/shares/[shareId]` (ברמת הכרטיס, לא
 *              ברמת הפרויקט — פרויקט אחד יכול לצבור כמה renders/shares, ראה ההסבר שם),
 *              וב-My Drafts זה `/api/projects/[projectId]` (מותר שם רק לטיוטה בלי renders —
 *              ראה ההסבר ב-api/projects/[projectId]/route.ts). אישור דו-שלבי (לחיצה ראשונה
 *              חושפת "Confirm?"), כי הפעולה בלתי-הפיכה — בלי דיאלוג-דפדפן (confirm()) כדי
 *              לא לחסום את ה-thread ולהתאים ל-Button הקיים.
 * @author      Soundiform
 * @created     2026-09-13
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface DeleteCreationButtonProps {
  deleteUrl: string;
}

export function DeleteCreationButton({ deleteUrl }: DeleteCreationButtonProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async (): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(deleteUrl, { method: 'DELETE' });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not delete this creation');
      }
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Could not delete this creation',
      );
      setIsConfirming(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isConfirming) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isDeleting}
          onClick={() => void confirmDelete()}
        >
          {isDeleting ? 'Deleting…' : 'Confirm delete'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDeleting}
          onClick={() => setIsConfirming(false)}
        >
          Cancel
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => setIsConfirming(true)}>
      Delete
    </Button>
  );
}
