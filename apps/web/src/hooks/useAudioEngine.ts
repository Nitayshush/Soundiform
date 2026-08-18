/**
 * @file        useAudioEngine.ts
 * @description ⭐ Hook לניהול מנוע האודיו בדפדפן — עוטף את packages/audio (browserRenderer).
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserRendererHandle } from '@shape-sound/audio';
import { geometryToMusic, composeMusicalScore } from '@shape-sound/core';
import { useShapeStore, toShapeData } from '@/stores/shapeStore';

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
  return error instanceof Error ? error.message : 'שגיאה לא ידועה בניגון';
}

/**
 * מריץ פריוויו חי: paths מה-shapeStore → geometryToMusic → composeMusicalScore →
 * createBrowserRenderer (Tone.js). ה-renderer נוצר עצל (רק בלחיצה על play — Tone.js
 * דורש מחוות משתמש אמיתית) ונהרס כשהצורה משתנה, כי הוא בנוי סביב score קבוע.
 */
export function useAudioEngine(): UseAudioEngineResult {
  const paths = useShapeStore((state) => state.paths);
  const shapeHash = useShapeStore((state) => state.shapeHash);

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

  // הצורה השתנתה — ה-renderer הישן שייך לצורה הקודמת, לא ניתן להמשיך להשתמש בו.
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
  }, [shapeHash, stopPositionLoop]);

  // פונקציה בשם (function tick) ולא arrow — כדי שהקריאה הרקורסיבית תפנה לזהות המקומית של
  // עצמה (tick), לא לבינדינג runPositionLoop-של-הרינדור-הזה (שESLint מסמן כבעייתי לגישה).
  const runPositionLoop = useCallback(function tick() {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    setCurrentSeconds(renderer.getCurrentSeconds());
    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(async () => {
    if (!shapeHash || paths.length === 0) {
      return;
    }
    setError(null);
    try {
      if (!rendererRef.current) {
        setIsLoading(true);
        const shape = toShapeData(paths);
        const intent = geometryToMusic(shape, shapeHash);
        const score = composeMusicalScore(intent);
        const { createBrowserRenderer } = await import('@shape-sound/audio');
        rendererRef.current = await createBrowserRenderer(score);
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
  }, [paths, shapeHash, runPositionLoop]);

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
