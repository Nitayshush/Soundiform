/**
 * @file        useAudioEngine.ts
 * @description ⭐ Hook לניהול מנוע האודיו בדפדפן — עוטף את packages/audio (browserRenderer).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ Sprint 9: הסגנון נלקח מ-genrePacksStore.getState() (DB, נטען כבר ע"י GenreSelector) —
 * לא מ-@soundiform/genres הסטטי — ראה genrePacksStore.ts.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserRendererHandle } from '@soundiform/audio';
import { geometryToMusic, composeMusicalScore } from '@soundiform/core';
import { useShapeStore, toShapeData } from '@/stores/shapeStore';
import { useGenreStore } from '@/stores/genreStore';
import { useGenrePacksStore } from '@/stores/genrePacksStore';
import { useSoundSelectionStore } from '@/stores/soundSelectionStore';
import { toCompositionConfig, toGenreAudioConfig } from '@/lib/genreAdapter';
import { useCompositionOverrides } from '@/hooks/useCompositionOverrides';
import { getRenderSecondsPerAudioSecond, recordRenderSpeed } from '@/lib/renderSpeedMemory';

export interface UseAudioEngineResult {
  isPlaying: boolean;
  isLoading: boolean;
  currentSeconds: number;
  durationSeconds: number;
  /** ⭐ 2026-09-01: האורך המוזיקלי (בלי זנב-הריוורב) — הבסיס למיקום קו-הסריקה. */
  musicalDurationSeconds: number;
  error: string | null;
  canPlay: boolean;
  play: () => Promise<void>;
  stop: () => void;
  /** ⭐ 2026-08-29: שניות שחלפו מאז שהרינדור-מראש התחיל (0 כשלא מרנדרים). */
  renderElapsedSeconds: number;
  /**
   * הערכת התקדמות הרינדור ב-[0,1], או null כשאין עדיין מדידת-מהירות למכשיר הזה
   * (הרינדור הראשון אי-פעם). ראה renderSpeedMemory.ts — עדיף בלי אחוז מאשר אחוז שקרי.
   */
  renderProgress: number | null;
}

/** קצב עדכון מונה-ההמתנה. 100ms מספיק חלק לעין ולא מעמיס בזמן שהמכשיר עסוק ברינדור. */
const RENDER_TICK_MS = 100;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown playback error';
}

/**
 * מריץ פריוויו חי: paths מה-shapeStore + genreId מה-genreStore → geometryToMusic →
 * composeMusicalScore → createBrowserRenderer (Tone.js). ה-renderer נוצר עצל (רק בלחיצה
 * על play — Tone.js דורש מחוות משתמש אמיתית) ונהרס כשהצורה **או** הסגנון משתנים, כי הוא
 * בנוי סביב score קבוע (§4.5: הצורה קובעת תוכן, הסגנון קובע לבוש — שינוי בכל אחד מהם מייצר score אחר).
 */
export function useAudioEngine(): UseAudioEngineResult {
  const paths = useShapeStore((state) => state.paths);
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const genreId = useGenreStore((state) => state.genreId);
  // ⚠️ חייב להשתתף בתלויות של play/useEffect: שינוי סולם או מקצב מייצר score אחר לגמרי,
  // ולכן renderer שנבנה לפני השינוי כבר לא תקף — בדיוק כמו שינוי צורה או סגנון.
  const overrides = useCompositionOverrides();
  // ⭐ 2026-08-24 (Area 1): נבחר-רה-אקטיבית לפי genreId — משתנה זהות בכל selectSound,
  // ולכן משתתף בתלויות ה-useEffect למטה בדיוק כמו shapeHash/genreId (renderer ישן שייך
  // לבחירת-צליל הקודמת, לא ניתן להמשיך להשתמש בו).
  const soundSelections = useSoundSelectionStore((state) => state.selectionsByGenre[genreId]);

  const rendererRef = useRef<BrowserRendererHandle | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // ⭐ 2026-08-28 (לפי בקשה חיה: "חירחורי-סאונד בנייד בכל הסגנונות" — root-cause אמיתי, לא
  // תלוי-סגנון): play() הוא async עם await אמיתי (createBrowserRenderer, כולל
  // startAudioContext() שיכול לחכות זמן ממשי בנייד). בלי הגנת-דור, אם צורה/סגנון/בחירת-צליל
  // משתנים *בזמן* שה-await הזה עדיין תלוי, ה-effect למטה מנקה כש-rendererRef.current עדיין
  // null (לא עושה כלום), ואז ה-renderer-הישן-בפועל שסוף-סוף נפתר נשמר ב-ref בלי בדיקה —
  // ה-Tone.Part שלו כבר מתחיל לנגן על ה-Transport הגלובלי ברגע היצירה עצמה (לא רק ב-.play()),
  // כך שהוא מצטרף בפועל למיקס ומצטבר עם כל החלפה נוספת בסשן ארוך. אותו דפוס generation-
  // counter בדיוק שכבר תיקן את אותה בעיה ב-usePreviewSound.ts.
  const rendererGenerationRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  // ⭐ 2026-09-01: האורך עד התו האחרון, בלי זנב-הריוורב. זה מה שקו-הסריקה נמדד מולו —
  // ראה computeMusicalDurationSeconds ב-@soundiform/audio.
  const [musicalDurationSeconds, setMusicalDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [renderElapsedSeconds, setRenderElapsedSeconds] = useState(0);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const renderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ⭐ 2026-08-29: מונה-ההמתנה לרינדור-מראש. הרינדור עצמו אטום (OfflineAudioContext לא מדווח
  // התקדמות), אז ההתקדמות מוערכת ממהירות-הרינדור שנמדדה במכשיר הזה בפעם הקודמת — ראה
  // renderSpeedMemory.ts. הערכה נעצרת ב-99% כדי לא להראות "100%" בזמן שעדיין מחכים.
  const stopRenderTimer = useCallback(() => {
    if (renderTimerRef.current !== null) {
      clearInterval(renderTimerRef.current);
      renderTimerRef.current = null;
    }
    setRenderElapsedSeconds(0);
    setRenderProgress(null);
  }, []);

  const startRenderTimer = useCallback((estimatedTotalSeconds: number | null) => {
    const startedAt = Date.now();
    setRenderElapsedSeconds(0);
    setRenderProgress(estimatedTotalSeconds === null ? null : 0);
    renderTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setRenderElapsedSeconds(elapsed);
      if (estimatedTotalSeconds !== null && estimatedTotalSeconds > 0) {
        setRenderProgress(Math.min(0.99, elapsed / estimatedTotalSeconds));
      }
    }, RENDER_TICK_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (renderTimerRef.current !== null) {
        clearInterval(renderTimerRef.current);
      }
    };
  }, []);

  const stopPositionLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // הצורה, הסגנון, או בחירת-הצליל השתנו — ה-renderer הישן שייך לקומבינציה הקודמת, לא ניתן
  // להמשיך להשתמש בו.
  useEffect(() => {
    return () => {
      // ⭐ מעלה את הדור בכל הרצה (לא רק כשיש renderer קיים) — כך שגם יצירה-בתהליך (עדיין
      // בתוך ה-await ב-play(), rendererRef.current עדיין null) מזוהה כמיושנת ברגע שהתלות
      // משתנה, בלי תלות בתזמון-מדויק בין ה-effect לבין פתרון ה-await.
      rendererGenerationRef.current += 1;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      stopPositionLoop();
      setIsPlaying(false);
      setCurrentSeconds(0);
      setDurationSeconds(0);
      setError(null);
    };
  }, [shapeHash, genreId, soundSelections, overrides, stopPositionLoop]);

  // פונקציה בשם (function tick) ולא arrow — כדי שהקריאה הרקורסיבית תפנה לזהות המקומית של
  // עצמה (tick), לא לבינדינג runPositionLoop-של-הרינדור-הזה (שESLint מסמן כבעייתי לגישה).
  // ⭐ 2026-08-24: resumeIfSuspended() בכל frame — זול (no-op כש-state כבר 'running'), ותופס
  // השעיה של ה-AudioContext (בעיקר iOS Safari, ראה browserRenderer.ts) תוך כדי ניגון פעיל.
  const runPositionLoop = useCallback(function tick() {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    setCurrentSeconds(renderer.getCurrentSeconds());
    void renderer.resumeIfSuspended();
    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // ⭐ 2026-08-24: מכסה את המקרה שבו ה-rAF loop עצמו הושהה ברקע (מובייל, טאב לא-פעיל/מסך
  // נעול) — visibilitychange ממשיך לירות גם אז, אז זו נקודת-ההתאוששות האמיתית כשחוזרים.
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void rendererRef.current?.resumeIfSuspended();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ⭐ 2026-08-27 (לפי בקשה חיה: "בהתחלה עובד, אחר-כך מושתק, קפיצה מדי פעם" — מובייל): הדפוס
  // הזה תואם בדיוק AudioContext auto-suspend של הדפדפן/המערכת (לא CPU-underrun כמו הקטיעות
  // הקודמות) — rAF *עצמו* לא רץ כשהמסך כבוי/הטאב ברקע, אז resumeIfSuspended (למעלה) לא מקבל
  // הזדמנות לרוץ בכלל עד שחוזרים ל-visible. בנוסף, context.resume() שנקרא מתוך rAF/
  // visibilitychange (לא user-gesture אמיתי) עלול להידחות ע"י דפדפנים קפדניים ברגע שה-context
  // *באמת* הושעה ע"י מדיניות (לא רק חיסכון-חשמל) — נגיעה ממשית היא user-gesture אמיתי,
  // הדרך הכי אמינה לשחרר-מחדש. מאזין תמיד פעיל (לא רק ב-isPlaying) כדי לתפוס גם את הרגע
  // שבו המשתמש נוגע כדי ללחוץ Play אחרי שה-context כבר נוצר-אך-מושהה מסבב קודם.
  useEffect(() => {
    const handleUserInteraction = (): void => {
      void rendererRef.current?.resumeIfSuspended();
    };
    document.addEventListener('pointerdown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  const play = useCallback(async () => {
    if (!shapeHash || paths.length === 0) {
      return;
    }
    setError(null);
    try {
      if (!rendererRef.current) {
        // ⭐ מעלה כאן גם, לא רק ב-effect הניקוי (למעלה) — כך שגם שתי קריאות play() חופפות
        // עבור אותה קומבינציה בדיוק (למשל לחיצה כפולה) לא ייצרו renderer כפול שנשאר תקוע;
        // רק הבנייה האחרונה-שבאמת-הסתיימה-כשהיא-עדיין-עדכנית תיכנס ל-ref.
        const myGeneration = (rendererGenerationRef.current += 1);
        setIsLoading(true);
        const genrePack = useGenrePacksStore.getState().packs.find((pack) => pack.id === genreId);
        if (!genrePack) {
          throw new Error(`Genre not found: ${genreId}`);
        }
        const shape = toShapeData(paths);
        const intent = geometryToMusic(shape, shapeHash);
        const score = composeMusicalScore(intent, toCompositionConfig(genrePack, overrides));
        const {
          createBrowserRenderer,
          computeDurationSeconds,
          computeMusicalDurationSeconds,
          getRendererDiagnostics,
        } = await import('@soundiform/audio');
        const audioConfig = toGenreAudioConfig(genrePack, intent.seed, soundSelections);

        // ⭐ 2026-08-29: מעריכים כמה זמן הרינדור-מראש ייקח *לפני* שמתחילים, מתוך מהירות
        // המכשיר שנמדדה בפעם הקודמת — כך שהמשתמש רואה התקדמות אמיתית ולא רק מספר עולה.
        const audioSeconds = computeDurationSeconds(score, audioConfig);
        const secondsPerAudioSecond = getRenderSecondsPerAudioSecond();
        startRenderTimer(
          secondsPerAudioSecond === null ? null : audioSeconds * secondsPerAudioSecond,
        );

        const renderer = await createBrowserRenderer(score, audioConfig);
        stopRenderTimer();
        // ⭐ מודדים כמה הרינדור באמת לקח, כדי שההערכה בפעם הבאה תהיה מדויקת יותר. מדלגים
        // כשהבאפר הגיע מהמטמון (אז renderMilliseconds הוא של המדידה המקורית, לא של עכשיו).
        const diagnostics = getRendererDiagnostics();
        if (!diagnostics.lastRenderFromCache && diagnostics.lastRenderMilliseconds !== null) {
          recordRenderSpeed(diagnostics.lastRenderMilliseconds, renderer.durationSeconds);
        }
        if (rendererGenerationRef.current !== myGeneration) {
          // ⭐ צורה/סגנון/בחירת-צליל השתנו בזמן שה-renderer הזה נבנה — הוא כבר לא רלוונטי.
          // משמידים מיד ולא נוגעים ב-rendererRef.current (ששייך עכשיו לקומבינציה חדשה,
          // או שעדיין null אם קריאת-play העדכנית טרם השלימה).
          renderer.dispose();
          setIsLoading(false);
          return;
        }
        rendererRef.current = renderer;
        setDurationSeconds(renderer.durationSeconds);
        setMusicalDurationSeconds(computeMusicalDurationSeconds(score));
        setIsLoading(false);
      }
      await rendererRef.current.play();
      setIsPlaying(true);
      runPositionLoop();
    } catch (caughtError) {
      stopRenderTimer();
      setIsLoading(false);
      setError(errorMessage(caughtError));
    }
  }, [
    paths,
    shapeHash,
    genreId,
    soundSelections,
    overrides,
    runPositionLoop,
    startRenderTimer,
    stopRenderTimer,
  ]);

  const stop = useCallback(() => {
    rendererRef.current?.stop();
    stopPositionLoop();
    setIsPlaying(false);
    setCurrentSeconds(0);
  }, [stopPositionLoop]);

  // ⭐ 2026-08-27: Media Session API — מסמן למערכת-ההפעלה (בעיקר אנדרואיד/iOS) שזו הפעלת-
  // מדיה לגיטימית וממושכת, לא רק "טאב ברקע" — בלי זה, דפדפני-מובייל נוטים להשעות את
  // ה-AudioContext הרבה יותר אגרסיבית גם כשהטאב עצמו עדיין גלוי/פעיל (בדיוק "עובד בהתחלה,
  // אחר-כך מושתק" שדווח). action handlers (play/pause) מחוברים לאותן play/stop כמו כפתורי-
  // ה-UI, כדי שגם בקרת-המדיה של המכשיר (מסך-נעילה וכו') תעבוד נכון, לא רק שתירשם. playbackState
  // מתעדכן ל-'none' כשהניגון נעצר, כדי לא להשאיר "רפאים" בבקרת-המדיה.
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Soundiform' });
    navigator.mediaSession.setActionHandler('play', () => void play());
    navigator.mediaSession.setActionHandler('pause', () => stop());
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'none';
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    };
  }, [isPlaying, play, stop]);

  return {
    isPlaying,
    isLoading,
    currentSeconds,
    durationSeconds,
    musicalDurationSeconds,
    error,
    canPlay: paths.length > 0 && shapeHash !== null,
    play,
    stop,
    renderElapsedSeconds,
    renderProgress,
  };
}
