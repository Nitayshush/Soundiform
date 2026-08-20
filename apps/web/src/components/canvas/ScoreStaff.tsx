/**
 * @file        ScoreStaff.tsx
 * @description ⭐ מחליף את Playhead.tsx (§11 עדכון 2026-08-20): במקום נקודה שרצה על קו הצורה,
 *              מציג את ה-MusicalScore עצמו כ"סרגל תווים" (piano-roll: X=זמן, Y=פובך) — כל
 *              הצורה מנוגנת יחד משמאל לימין — עם קו סורק שנע בזמן ניגון אמיתי.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה מחשבים score עצמאית (כמו RevealOverlay, לא תלוי ב-useAudioEngine):
 * הסרגל אמור להיראות גם *לפני* לחיצה על play (כמו RevealOverlay) — "ככה זה יישמע" לפני
 * שבאמת שומעים. geometryToMusic כבר ממפה Y-של-הצורה→pitch ו-X/אורך-קשת→זמן (§4.2) —
 * הסרגל הזה *הוא* אותה מיפוי בדיוק, רק מוצג כ-X/Y ליניארי במקום לאורך קו הצורה המקורי.
 */

'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Application, Graphics as PixiGraphics } from 'pixi.js';
import {
  composeMusicalScore,
  geometryToMusic,
  TICKS_PER_BEAT,
  type MusicalScore,
  type TrackRole,
} from '@soundiform/core';
import type { ShapePath } from '@soundiform/shared';
import type { GenrePack } from '@soundiform/genres';
import { useShapeStore } from '@/stores/shapeStore';
import { useGenreStore } from '@/stores/genreStore';
import { useGenrePacksStore } from '@/stores/genrePacksStore';
import { toCompositionConfig } from '@/lib/genreAdapter';

const SCAN_LINE_COLOR = 0xf5f3fc;
const SCAN_LINE_WIDTH = 2;
const NOTE_BAR_MIN_HEIGHT = 4;
const NOTE_BAR_ALPHA = 0.85;

const ROLE_COLORS: Record<TrackRole, number> = {
  lead: 0x8b7cf6,
  bass: 0xf59e0b,
  pad: 0x34d399,
  drums: 0xf5f3fc,
  skank: 0xf472b6,
};

export interface ScoreStaffProps {
  /** מיקום נוכחי בלופ, 0–1. */
  progress: number;
}

function computeScore(
  paths: ShapePath[],
  shapeHash: string | null,
  genreId: string,
  packs: GenrePack[],
): MusicalScore | null {
  if (paths.length === 0 || !shapeHash) {
    return null;
  }
  const genrePack = packs.find((pack) => pack.id === genreId);
  if (!genrePack) {
    return null;
  }
  const shape = { version: '1.0.0', paths };
  const intent = geometryToMusic(shape, shapeHash);
  return composeMusicalScore(intent, toCompositionConfig(genrePack));
}

export function ScoreStaff({ progress }: ScoreStaffProps) {
  const paths = useShapeStore((state) => state.paths);
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const genreId = useGenreStore((state) => state.genreId);
  const packs = useGenrePacksStore((state) => state.packs);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const notesLayerRef = useRef<PixiGraphics | null>(null);
  const scanLineRef = useRef<PixiGraphics | null>(null);

  const score = useMemo(
    () => computeScore(paths, shapeHash, genreId, packs),
    [paths, shapeHash, genreId, packs],
  );

  // אתחול/פירוק אפליקציית Pixi — פעם אחת, לא תלוי בהתקדמות/score.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let disposed = false;

    void (async () => {
      const { Application, Graphics } = await import('pixi.js');
      const app = new Application();
      await app.init({ backgroundAlpha: 0, resizeTo: container, antialias: true });
      if (disposed) {
        app.destroy(true);
        return;
      }
      container.appendChild(app.canvas);
      const notesLayer = new Graphics();
      const scanLine = new Graphics();
      app.stage.addChild(notesLayer);
      app.stage.addChild(scanLine);
      appRef.current = app;
      notesLayerRef.current = notesLayer;
      scanLineRef.current = scanLine;
    })();

    return () => {
      disposed = true;
      notesLayerRef.current = null;
      scanLineRef.current = null;
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, []);

  // ציור מחדש של כל התווים — רק כש-score משתנה (לא בכל פריים).
  useEffect(() => {
    const app = appRef.current;
    const notesLayer = notesLayerRef.current;
    if (!app || !notesLayer) {
      return;
    }
    notesLayer.clear();
    if (!score) {
      return;
    }

    const totalTicks = score.durationBars * score.timeSignature[0] * TICKS_PER_BEAT;
    const allPitches = score.tracks.flatMap((track) => track.notes.map((note) => note.pitch));
    const minPitch = Math.min(...allPitches);
    const maxPitch = Math.max(...allPitches);
    const pitchRange = Math.max(1, maxPitch - minPitch);

    const width = app.renderer.width;
    const height = app.renderer.height;
    const barHeight = Math.max(NOTE_BAR_MIN_HEIGHT, height / (pitchRange + 4));

    for (const track of score.tracks) {
      const color = ROLE_COLORS[track.role];
      for (const note of track.notes) {
        const x = (note.startTick / totalTicks) * width;
        const noteWidth = Math.max(2, (note.durationTicks / totalTicks) * width);
        const pitchNormalized = (note.pitch - minPitch) / pitchRange;
        const y = (1 - pitchNormalized) * (height - barHeight);
        notesLayer
          .rect(x, y, noteWidth, barHeight)
          .fill({ color, alpha: NOTE_BAR_ALPHA * (0.5 + note.velocity * 0.5) });
      }
    }
  }, [score]);

  // עדכון קו הסריקה — קורה על כל שינוי ב-progress, בלי לצייר מחדש את התווים.
  useEffect(() => {
    const app = appRef.current;
    const scanLine = scanLineRef.current;
    if (!app || !scanLine) {
      return;
    }
    scanLine.clear();
    if (!score) {
      return;
    }
    const x = progress * app.renderer.width;
    scanLine
      .moveTo(x, 0)
      .lineTo(x, app.renderer.height)
      .stroke({ width: SCAN_LINE_WIDTH, color: SCAN_LINE_COLOR, alpha: 0.9 });
  }, [progress, score]);

  return <div ref={containerRef} className="pointer-events-none absolute inset-0" />;
}
