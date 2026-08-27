/**
 * @file        usePlayScore.ts
 * @description ⭐ ניגון MusicalScore *כבר-מוכן* (מ-render שמור) — לא מלכיד/מרכיב מחדש כמו
 *              useAudioEngine (שעובד על shapeStore/genreStore החיים בזמן ציור). נועד לדפי
 *              שיתוף/גלריה: אותו score, נגזר מחדש רק את ה-audioConfig מ-genreId (§4.5).
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserRendererHandle } from '@soundiform/audio';
import type { MusicalScore } from '@soundiform/core';
import { loadGenrePackById } from '@soundiform/genres';
import { toGenreAudioConfig } from '@/lib/genreAdapter';

export interface UsePlayScoreResult {
  isPlaying: boolean;
  isLoading: boolean;
  currentSeconds: number;
  durationSeconds: number;
  error: string | null;
  play: () => Promise<void>;
  stop: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown playback error';
}

export function usePlayScore(score: MusicalScore, genreId: string): UsePlayScoreResult {
  const rendererRef = useRef<BrowserRendererHandle | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stopPositionLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      stopPositionLoop();
    };
  }, [score, genreId, stopPositionLoop]);

  // ⭐ 2026-08-24: resumeIfSuspended() בכל frame + visibilitychange — אותו תיקון כמו
  // useAudioEngine.ts, נדרש גם כאן כי דפי שיתוף/גלריה הם בדיוק המקום שסביר שינוגן במובייל.
  const runPositionLoop = useCallback(function tick() {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    setCurrentSeconds(renderer.getCurrentSeconds());
    void renderer.resumeIfSuspended();
    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

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

  // ⭐ 2026-08-27 (לפי בקשה חיה: "בהתחלה עובד, אחר-כך מושתק, קפיצה מדי פעם" — מובייל, אותו
  // תיקון כמו useAudioEngine.ts): rAF עצמו לא רץ כשהמסך כבוי/הטאב ברקע, אז resumeIfSuspended
  // למעלה לא מקבל הזדמנות לרוץ בכלל עד שחוזרים ל-visible. context.resume() מתוך רגע-נגיעה
  // ממשי (לא rAF/visibilitychange) נחשב user-gesture אמיתי — הדרך הכי אמינה לשחרר-מחדש
  // context שדפדפן קפדני השעה ע"י מדיניות, לא רק חיסכון-חשמל.
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
    setError(null);
    try {
      if (!rendererRef.current) {
        setIsLoading(true);
        const genrePack = loadGenrePackById(genreId);
        if (!genrePack) {
          throw new Error(`Genre not found: ${genreId}`);
        }
        const { createBrowserRenderer } = await import('@soundiform/audio');
        rendererRef.current = await createBrowserRenderer(
          score,
          toGenreAudioConfig(genrePack, score.seed),
        );
        setDurationSeconds(rendererRef.current.durationSeconds);
        setIsLoading(false);
      }
      await rendererRef.current.play();
      setIsPlaying(true);
      runPositionLoop();
    } catch (caughtError) {
      setIsLoading(false);
      setError(errorMessage(caughtError));
    }
  }, [score, genreId, runPositionLoop]);

  const stop = useCallback(() => {
    rendererRef.current?.stop();
    stopPositionLoop();
    setIsPlaying(false);
    setCurrentSeconds(0);
  }, [stopPositionLoop]);

  // ⭐ 2026-08-27: Media Session API — ראה useAudioEngine.ts לתיעוד המלא. אותו תיקון כאן,
  // כי דפי שיתוף/גלריה הם בדיוק המקום שסביר שינוגן במובייל.
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

  return { isPlaying, isLoading, currentSeconds, durationSeconds, error, play, stop };
}
