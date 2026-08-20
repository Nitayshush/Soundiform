/**
 * @file        useSaveProject.ts
 * @description ⭐ שמירת פרויקט + מימוש בפועל של "היצירה עוברת אוטומטית לחשבון" (§9).
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי: requestSave() אצל משתמש אנונימי לא שומר כלום — הוא מפנה ל-/login עם
 * next=/studio?autoSave=1, ה-shape עצמו כבר יושב ב-localStorage (shapeStore, מ-Sprint 1).
 * אחרי חזרה מהתחברות מוצלחת, ה-effect כאן מזהה autoSave=1+user מחובר ומשלים את השמירה
 * לבד — המשתמש לא צריך ללחוץ שוב, והיצירה לא הולכת לאיבוד (§9 "קריטי").
 *
 * ⭐ Sprint 8: remixOf ב-query params (מגיע מ-RemixButton) עובר אוטומטית לגוף בקשת השמירה —
 * זה מה שמאפשר ל-api/projects/route.ts לרשום שורת remixes.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toShapeData, useShapeStore } from '@/stores/shapeStore';
import { useSupabaseUser } from './useSupabaseUser';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'שמירה נכשלה';
}

export interface UseSaveProjectResult {
  requestSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  savedProjectId: string | null;
}

export function useSaveProject(): UseSaveProjectResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paths = useShapeStore((state) => state.paths);
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const sourceType = useShapeStore((state) => state.sourceType);
  const uploadKey = useShapeStore((state) => state.uploadKey);
  const { user, isLoading: isUserLoading } = useSupabaseUser();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const autoSaveAttempted = useRef(false);

  const save = useCallback(async (): Promise<void> => {
    if (!shapeHash || paths.length === 0) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const remixOf = searchParams.get('remixOf');
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shape: toShapeData(paths),
          shapeHash,
          sourceType,
          ...(uploadKey && { uploadKey }),
          ...(remixOf && { remixOf }),
        }),
      });
      const responseBody: unknown = await response.json();
      const parsed = responseBody as { project?: { id: string }; error?: string };
      if (!response.ok) {
        throw new Error(parsed.error ?? 'שמירה נכשלה');
      }
      setSavedProjectId(parsed.project?.id ?? null);
    } catch (caughtError) {
      setSaveError(errorMessage(caughtError));
    } finally {
      setIsSaving(false);
    }
  }, [paths, shapeHash, sourceType, uploadKey, searchParams]);

  const requestSave = useCallback(() => {
    if (!user) {
      const remixOf = searchParams.get('remixOf');
      const next = `/studio?autoSave=1${remixOf ? `&remixOf=${remixOf}` : ''}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    void save();
  }, [user, router, save, searchParams]);

  useEffect(() => {
    if (isUserLoading || autoSaveAttempted.current) {
      return;
    }
    if (searchParams.get('autoSave') === '1' && user && shapeHash) {
      autoSaveAttempted.current = true;
      // סנכרון חד-פעמי עם מצב חיצוני אמיתי (query param שחוזר מ-redirect אחרי התחברות, §9
      // "קריטי" — אסור לאבד את היצירה) — לא לולאת cascading render, ה-ref guard
      // (autoSaveAttempted) מבטיח ריצה יחידה.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void save().then(() => {
        router.replace('/studio');
      });
    }
  }, [isUserLoading, user, shapeHash, searchParams, save, router]);

  return { requestSave, isSaving, saveError, savedProjectId };
}
