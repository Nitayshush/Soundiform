/**
 * @file        useDownload.ts
 * @description ⭐ 2026-08-22 (§11 item 8): הכפתור "Download" הראשון-אי-פעם בסטודיו — עד עכשיו
 *              לא היה שום נתיב ב-UI שמפעיל POST /api/render בכלל (רק בדיקות/scripts ישירים).
 *              וידאו כברירת מחדל (16:9, נגיש ל-YouTube), אודיו כאופציה משנית (DownloadLinks
 *              בדף השיתוף) — לפי בחירת Nitay.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מרכיב (composed) על useSaveProject.ts הקיים, לא כפילות: אותו requestSave/savedProjectId
 * משמשים גם כאן — "Download" תמיד דורש פרויקט שמור קודם (בדיוק כמו render, §9), אז אנונימי
 * מקבל בדיוק את אותו redirect-and-resume (autoSave=1) + דגל מקביל (autoDownload=1) שממשיך
 * לרינדור+הורדה ברגע שה-save (החדש או הישן) מסתיים, בלי ללחוץ שוב.
 *
 * ⚠️ קריטי: מקבל את תוצאת useSaveProject() כפרמטר (לא קורא לה כאן) — הקורא (studio/page.tsx)
 * חייב לקרוא ל-useSaveProject() פעם אחת בלבד ולהעביר את אותה תוצאה גם לכפתור Save וגם לכאן.
 * שתי קריאות עצמאיות ל-useSaveProject() היו יוצרות שני state instances נפרדים (savedProjectId
 * שונה בכל אחד) — autoSave=1 היה יכול לרוץ *פעמיים* במקביל ולשמור את אותו פרויקט כשתי שורות.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGenreStore } from '@/stores/genreStore';
import type { UseSaveProjectResult } from './useSaveProject';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // ~2 דקות — רינדור וידאו אמיתי יכול לקחת זמן.
const DEFAULT_VIDEO_ASPECT_RATIO = '16:9'; // ⭐ ברירת מחדל ל-YouTube (הבקשה המפורשת של Nitay).

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Download failed';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RenderStatusResponse {
  status: 'unknown' | 'waiting' | 'active' | 'completed' | 'failed';
  renderId?: string;
}

async function pollForRenderId(jobId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const response = await fetch(`/api/render/${jobId}/status`);
    const status = (await response.json()) as RenderStatusResponse;
    if (status.status === 'failed') {
      throw new Error('Render failed');
    }
    if (status.status === 'completed' && status.renderId) {
      return status.renderId;
    }
  }
  throw new Error('Render is taking longer than expected — try again in a moment');
}

export interface UseDownloadResult {
  requestDownload: () => void;
  isDownloading: boolean;
  downloadError: string | null;
  /** הודעת-התקדמות קריאה-לאדם ("Rendering your video…") — לא רק spinner. */
  statusMessage: string | null;
}

export function useDownload(saveProject: UseSaveProjectResult): UseDownloadResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const genreId = useGenreStore((state) => state.genreId);
  const { requestSave, savedProjectId, isSaving, saveError } = saveProject;

  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pendingDownloadRef = useRef(false);
  const autoDownloadAttemptedRef = useRef(false);
  // ⚠️ נלכד פעם אחת ב-mount, לא נקרא reactively מ-searchParams — useSaveProject's autoSave
  // effect עושה router.replace('/studio') אחרי השמירה (מוריד את ה-query params), אז קריאה
  // reactive הייתה עלולה "לפספס" את הדגל בגלל תזמון race מול אותו replace.
  const initialAutoDownload = useRef(searchParams.get('autoDownload') === '1');

  const renderAndDownload = useCallback(
    async (projectId: string): Promise<void> => {
      setIsRendering(true);
      setRenderError(null);
      try {
        setStatusMessage('Rendering your video…');
        const renderResponse = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            genreId,
            video: { aspectRatio: DEFAULT_VIDEO_ASPECT_RATIO },
          }),
        });
        const renderBody = (await renderResponse.json()) as { jobId?: string; error?: string };
        if (!renderResponse.ok || !renderBody.jobId) {
          throw new Error(renderBody.error ?? 'Render failed to start');
        }

        const renderId = await pollForRenderId(renderBody.jobId);

        setStatusMessage('Creating your share link…');
        const shareResponse = await fetch('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ renderId, visibility: 'public' }),
        });
        const shareBody = (await shareResponse.json()) as { slug?: string };

        setStatusMessage('Starting your download…');
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- זה לא ניווט-דף: /api/.../download מפנה (307) לקובץ חתום ב-R2 ומפעיל הורדה בדפדפן, לא render של עמוד Next.js. router.push() לא מתאים כאן.
        window.location.href = `/api/renders/${renderId}/download?type=video`;

        if (shareBody.slug) {
          router.push(`/s/${shareBody.slug}`);
        }
      } catch (caughtError) {
        setRenderError(errorMessage(caughtError));
      } finally {
        setIsRendering(false);
        setStatusMessage(null);
      }
    },
    [genreId, router],
  );

  const requestDownload = useCallback(() => {
    if (savedProjectId) {
      void renderAndDownload(savedProjectId);
      return;
    }
    // requestSave() עצמו מטפל בהפניית אנונימי ל-/login?next=/studio?autoSave=1 — כאן רק
    // מוסיפים autoDownload=1 (ראה למטה) ומחכים ל-savedProjectId להופיע כדי להמשיך.
    pendingDownloadRef.current = true;
    requestSave();
  }, [savedProjectId, requestSave, renderAndDownload]);

  // ⭐ ממשיך לרינדור+הורדה ברגע ש-savedProjectId מופיע, בין אם מ-requestDownload (משתמש מחובר,
  // שמירה ראשונה) ובין אם מ-autoSave=1 אחרי חזרה מהתחברות (הענף autoDownload למטה). סנכרון
  // חד-פעמי עם מצב חיצוני אמיתי (ref guard מבטיח ריצה יחידה) — לא cascading render, אותו
  // דפוס בדיוק כמו useSaveProject.ts's autoSave effect.
  useEffect(() => {
    if (pendingDownloadRef.current && savedProjectId) {
      pendingDownloadRef.current = false;
      void renderAndDownload(savedProjectId);
    }
  }, [savedProjectId, renderAndDownload]);

  useEffect(() => {
    if (autoDownloadAttemptedRef.current || !initialAutoDownload.current) {
      return;
    }
    if (savedProjectId) {
      autoDownloadAttemptedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void renderAndDownload(savedProjectId);
    }
  }, [savedProjectId, renderAndDownload]);

  return {
    requestDownload,
    isDownloading: isSaving || isRendering,
    downloadError: saveError ?? renderError,
    statusMessage,
  };
}
