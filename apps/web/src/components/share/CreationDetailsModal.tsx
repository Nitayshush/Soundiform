/**
 * @file        CreationDetailsModal.tsx
 * @description ⭐ 2026-09-12: נשאל מיד אחרי שהרינדור/שיתוף הסתיימו, לפני הניווט לדף השיתוף
 *              (ראה useDownload.ts) — "תן שם ליצירה שלך, כדי שאחרים ימצאו אותה". התוכן
 *              שנכתב כאן מוצג בפועל בדף השיתוף (title/description) ומשמש למטא-תגיות SEO
 *              (generateMetadata ב-app/s/[shareId]/page.tsx) — לא רק קישוט.
 * @author      Soundiform
 * @created     2026-09-12
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ Portal ל-document.body — אותה סיבה בדיוק כמו EmojiPickerButton.tsx: מודאל ממורכז-מסך,
 * לא כפוף ל-overflow של שום container אב.
 *
 * ⚠️ ניתן-לדילוג בכוונה, לא חובה — חסימת הניווט עד שלושה שדות מלאים הייתה ממקסמת תוכן,
 * אבל מוסיפה חיכוך ממש ברגע "היצירה שלך מוכנה!", שעלול לפגוע בדיוק במה שגורם לשימוש חוזר.
 *
 * ⭐ 2026-09-13: variant='edit' — אותו מודאל בדיוק, נפתח מ-My Gallery (EditDetailsButton.tsx)
 * לעריכת יצירה קיימת. ההבדל היחיד הוא הטקסט (כותרת/כפתורים) והשדות מתחילים מהערכים
 * הקיימים, לא ריקים — אין סיבה לכפול קומפוננטה שלמה על הבדל-ניסוח בלבד.
 *
 * ⭐⭐ 2026-09-13 (נתפס בבדיקה חיה): variant='draft' — נפתח גם אחרי Save-הפשוט (studio/page.tsx),
 * לא רק אחרי Download. ⚠️ קריטי: הטקסט **חייב** להיות שונה מ-'create' — Save לא יוצר וידאו/
 * share בכלל (ראה useSaveProject.ts/useDownload.ts), אז "Name your creation… when you share
 * it" היה מטעה: המשתמש חשב שהיצירה "נשמרה ושותפה" בפועל, בעוד שרק הציור עצמו נשמר כטיוטה.
 */

'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

export interface CreationDetails {
  title: string;
  description: string;
  keywords: string;
}

export interface CreationDetailsModalProps {
  projectId: string;
  defaultTitle: string;
  initialDescription?: string;
  initialKeywords?: string;
  /**
   * ברירת מחדל 'create' (הזרימה אחרי Download — יש כבר וידאו+share אמיתיים).
   * 'edit' — נפתח מ-My Gallery ליצירה קיימת. 'draft' — נפתח אחרי Save-פשוט, בלי וידאו/share.
   */
  variant?: 'create' | 'edit' | 'draft';
  onDone: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not save details';
}

export function CreationDetailsModal({
  projectId,
  defaultTitle,
  initialDescription = '',
  initialKeywords = '',
  variant = 'create',
  onDone,
}: CreationDetailsModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(initialDescription);
  const [keywords, setKeywords] = useState(initialKeywords);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveAndContinue = async (): Promise<void> => {
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || defaultTitle,
          description: description.trim(),
          keywords: keywords.trim(),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not save details');
      }
      onDone();
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-card p-5 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold">
            {variant === 'edit'
              ? 'Edit creation details'
              : variant === 'draft'
                ? 'Add details (optional)'
                : 'Name your creation'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {variant === 'draft'
              ? "Saved as a draft — this isn't a shareable video yet. Click Download to render and share it."
              : 'This helps people find and recognize it when you share it.'}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            maxLength={200}
            className="rounded-lg border border-border/60 bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description <span className="text-muted-foreground">(optional)</span>
          <textarea
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            rows={3}
            maxLength={2000}
            className="rounded-lg border border-border/60 bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Keywords <span className="text-muted-foreground">(optional, comma-separated)</span>
          <input
            type="text"
            value={keywords}
            onChange={(event) => {
              setKeywords(event.target.value);
            }}
            placeholder="trance, logo, blue"
            maxLength={500}
            className="rounded-lg border border-border/60 bg-background px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={onDone}
            disabled={isSaving}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            {variant === 'create' ? 'Skip' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void saveAndContinue()}
            disabled={isSaving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : variant === 'create' ? 'Save & continue' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
