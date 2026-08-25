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

export interface UseAudioEngineResult {
  isPlaying: boolean;
  isLoading: boolean;
  currentSeconds: number;
  durationSeconds: number;
  error: string | null;
  canPlay: boolean;
  play: () => Promise<void>;
  stop: () => void;
}

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
  // ⭐ 2026-08-24 (Area 1): נבחר-רה-אקטיבית לפי genreId — משתנה זהות בכל selectSound,
  // ולכן משתתף בתלויות ה-useEffect למטה בדיוק כמו shapeHash/genreId (renderer ישן שייך
  // לבחירת-צליל הקודמת, לא ניתן להמשיך להשתמש בו).
  const soundSelections = useSoundSelectionStore((state) => state.selectionsByGenre[genreId]);

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

  // הצורה, הסגנון, או בחירת-הצליל השתנו — ה-renderer הישן שייך לקומבינציה הקודמת, לא ניתן
  // להמשיך להשתמש בו.
  useEffect(() => {
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      stopPositionLoop();
      setIsPlaying(false);
      setCurrentSeconds(0);
      setDurationSeconds(0);
      setError(null);
    };
  }, [shapeHash, genreId, soundSelections, stopPositionLoop]);

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

  const play = useCallback(async () => {
    if (!shapeHash || paths.length === 0) {
      return;
    }
    setError(null);
    try {
      if (!rendererRef.current) {
        setIsLoading(true);
        const genrePack = useGenrePacksStore.getState().packs.find((pack) => pack.id === genreId);
        if (!genrePack) {
          throw new Error(`Genre not found: ${genreId}`);
        }
        const shape = toShapeData(paths);
        const intent = geometryToMusic(shape, shapeHash);
        const score = composeMusicalScore(intent, toCompositionConfig(genrePack));
        const { createBrowserRenderer } = await import('@soundiform/audio');
        rendererRef.current = await createBrowserRenderer(
          score,
          toGenreAudioConfig(genrePack, intent.seed, soundSelections),
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
  }, [paths, shapeHash, genreId, soundSelections, runPositionLoop]);

  const stop = useCallback(() => {
    rendererRef.current?.stop();
    stopPositionLoop();
    setIsPlaying(false);
    setCurrentSeconds(0);
  }, [stopPositionLoop]);

  return {
    isPlaying,
    isLoading,
    currentSeconds,
    durationSeconds,
    error,
    canPlay: paths.length > 0 && shapeHash !== null,
    play,
    stop,
  };
}
