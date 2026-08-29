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
import { useSoundSelectionStore } from '@/stores/soundSelectionStore';
import type { UseSaveProjectResult } from './useSaveProject';

const POLL_INTERVAL_MS = 2000;
// ⭐ 2026-08-22: 60 (2 דקות) היה קרוב-מדי-לגבול — בדיקה חיה מדדה רינדור וידאו אמיתי
// (720p, ~18 שניות מוזיקה) ב-~170-176 שניות. 150 (5 דקות) נותן שוליים אמיתיים, כולל
// לאיכויות/משכים גדולים יותר (pro/studio).
const MAX_POLL_ATTEMPTS = 150;
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

/**
 * ⚠️ מסלול ה-worker המקורי — **נשמר בכוונה ולא נמחק** (§0 כלל 2). מאז 2026-08-29 ההורדה
 * רצה במכשיר (ראה renderAndDownload למטה), כי ה-worker לא פרוס בשום מקום ובפועל רץ על
 * מחשב מקומי. אם יתברר שמכשירים מסוימים (בעיקר iOS) לא יכולים לקודד וידאו בדפדפן ונחליט
 * להקים worker אמיתי — זו הפונקציה שמחזירה את המסלול הזה לשירות, בלי לכתוב אותו מחדש.
 */
export async function renderViaWorkerQueue(
  projectId: string,
  genreId: string,
  aspectRatio: string,
  soundSelections?: Record<string, string[]>,
): Promise<string> {
  const renderResponse = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      genreId,
      video: { aspectRatio },
      ...(soundSelections && { soundSelections }),
    }),
  });
  const renderBody = (await renderResponse.json()) as { jobId?: string; error?: string };
  if (!renderResponse.ok || !renderBody.jobId) {
    throw new Error(renderBody.error ?? 'Render failed to start');
  }
  return pollForRenderId(renderBody.jobId);
}

export interface UseDownloadResult {
  requestDownload: () => void;
  isDownloading: boolean;
  downloadError: string | null;
  /** הודעת-התקדמות קריאה-לאדם ("Rendering your video…") — לא רק spinner. */
  statusMessage: string | null;
  /**
   * ⭐ 2026-08-29: הודעה למכשיר שלא יכול ליצור וידאו (אין WebCodecs). **לא שגיאה** —
   * היצירה נשמרה ונשתפת כרגיל, רק בלי קובץ mp4. ראה lib/video/webcodecsSupport.ts.
   */
  unsupportedNotice: string | null;
}

/** ⭐ 2026-08-29: טקסט לכל שלב ברינדור-במכשיר (lib/download/clientRender.ts). */
const STAGE_MESSAGES: Record<string, string> = {
  preparing: 'Preparing…',
  audio: 'Preparing your audio…',
  video: 'Creating your video…',
  uploading: 'Uploading…',
  saving: 'Saving your creation…',
};

export function useDownload(saveProject: UseSaveProjectResult): UseDownloadResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const genreId = useGenreStore((state) => state.genreId);
  // ⭐ 2026-08-24 (Area 1): נדרש כדי שהוידאו המורד ישקף את אותה בחירת-צליל של הפריוויו החי
  // (useAudioEngine.ts) — בלי זה, הרינדור הסופי היה תמיד ברירת-המחדל של הז'אנר.
  const soundSelections = useSoundSelectionStore((state) => state.selectionsByGenre[genreId]);
  const { requestSave, savedProjectId, isSaving, saveError } = saveProject;

  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [unsupportedNotice, setUnsupportedNotice] = useState<string | null>(null);
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
      setUnsupportedNotice(null);
      try {
        // ⭐⭐ 2026-08-29: הרינדור עבר **למכשיר**. ה-worker לא פרוס בשום מקום (רץ בפועל על
        // מחשב מקומי), ולכן ההורדה לקחה דקות; קידוד H.264 בדפדפן נמדד ב-2.13x מהזמן-אמת
        // באנדרואיד — מהר בסדר-גודל. ראה lib/download/clientRender.ts.
        const { runClientRender } = await import('@/lib/download/clientRender');
        const { renderId, hasVideo, downgradedTo, limitedCompatibility } = await runClientRender({
          projectId,
          genreId,
          aspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
          ...(soundSelections && { soundSelections }),
          onProgress: ({ stage, ratio }) => {
            setStatusMessage(
              stage === 'video' && ratio !== undefined
                ? `Creating your video… ${String(Math.round(ratio * 100))}%`
                : STAGE_MESSAGES[stage],
            );
          },
        });

        if (!hasVideo) {
          // ⚠️ לא שגיאה: היצירה נשמרה בגלריה וניתנת לשיתוף — רק בלי קובץ mp4. קורה כשאין
          // WebCodecs בכלל, או כשהקידוד נכשל בדפדפן הזה (בפועל: Firefox). ההודעה חייבת
          // לומר את שני הדברים שהמשתמש צריך לדעת: שהיצירה **לא אבדה**, ואיפה להוריד.
          setUnsupportedNotice(
            "Your video was saved to your gallery. This browser can't create the video file — open Soundiform in Chrome to download it.",
          );
        } else if (limitedCompatibility) {
          // ⚠️⚠️ נתפס בבדיקה חיה: הדפדפן הזה (בפועל Firefox, שלא מקודד AAC) מייצר MP4 עם
          // Opus. הוא מתנגן **באתר** — ולכן הוא כן מועלה ומשמש את דף השיתוף והגלריה — אבל
          // **לא נפתח** ב-Windows Media Player ובחלק מהאפליקציות. לכן במקרה הזה במכוון
          // *לא* מפעילים הורדה אוטומטית: עדיף להסביר מאשר להוריד קובץ שלא ייפתח.
          setUnsupportedNotice(
            'Your video was saved to your gallery. This browser could only use an audio format that many players reject, so open Soundiform in Chrome to download a file that plays everywhere.',
          );
        } else if (downgradedTo) {
          // ⚠️ פחות ממה שהמנוי מזכה בו — אומרים את זה במפורש ולא "משתיקים" את ההבדל.
          setUnsupportedNotice(
            `Your device couldn't encode the full resolution, so the video was created at ${downgradedTo}.`,
          );
        }

        setStatusMessage('Creating your share link…');
        const shareResponse = await fetch('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ renderId, visibility: 'public' }),
        });
        const shareBody = (await shareResponse.json()) as { slug?: string };

        // ⚠️ מורידים רק כשיש קובץ שבאמת ייפתח אצל המשתמש. בלי וידאו — אין מה להוריד;
        // ועם וידאו בתאימות-מוגבלת (Opus) — הורדה אוטומטית הייתה נותנת קובץ שלא נפתח,
        // ולכן מדלגים עליה במכוון ומסבירים למעלה. בשני המקרים ממשיכים לדף השיתוף,
        // שם היצירה כן מנוגנת ומשותפת.
        if (hasVideo && !limitedCompatibility) {
          setStatusMessage('Starting your download…');
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- זה לא ניווט-דף: /api/.../download מפנה (307) לקובץ חתום ב-R2 ומפעיל הורדה בדפדפן, לא render של עמוד Next.js. router.push() לא מתאים כאן.
          window.location.href = `/api/renders/${renderId}/download?type=video`;
        }

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
    [genreId, soundSelections, router],
  );

  const requestDownload = useCallback(() => {
    if (savedProjectId) {
      void renderAndDownload(savedProjectId);
      return;
    }
    // requestSave('autoDownload=1') מטפל בהפניית אנונימי ל-/login?next=/studio?autoSave=1
    // &autoDownload=1 — כאן רק מחכים ל-savedProjectId להופיע כדי להמשיך (ראה למטה).
    pendingDownloadRef.current = true;
    requestSave('autoDownload=1');
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
    unsupportedNotice,
  };
}
