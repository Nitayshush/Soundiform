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
 *
 * ⭐ 2026-08-22 (§11 item 7 — "ויראלי"): זוהר/glow + פרצי-אור לכל תו. glow בנוי דרך
 * BlurFilter המובנה ב-pixi.js core (לא pixi-filters — לא הוספנו תלות חדשה): שכבה שנייה
 * מציירת את אותם המלבנים, מטושטשת ובאיחוד-בהירות (blend 'add'), מתחת לשכבה החדה. פרצי-האור
 * וה"פעימת רקע" (לפי אנרגיה/velocity ברגע הנוכחי) רצים על app.ticker — אנימציה מתמשכת,
 * לא רק re-render לפי progress prop.
 *
 * ⭐ 2026-08-23 (§4.2 תיקון): הצורה המקורית מוקרנת עכשיו **לתוך אותה מערכת-צירים של סרגל
 * התווים עצמו** (X=זמן/Y=פובך, לא ריבוע ממורכז עצמאי כמו ב-2026-08-22) דרך @soundiform/
 * shared's shapeReveal.ts (projectShapeToStaff/revealedSegments) — כך שהצורה מופיעה איפה
 * שהתווים שהיא ייצרה נראים, לא במקום שרירותי. חשיפה לפי progress = מיקום-X מול קו הסורק
 * ("הסורק עובר"), לא לפי סדר-ציור — אותו מודול גיאומטריה בדיוק כמו
 * apps/worker/src/video/frameRenderer.ts ("פריוויו ≈ פלט סופי").
 */

'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Application, Graphics as PixiGraphics, BlurFilter } from 'pixi.js';
import {
  composeMusicalScore,
  geometryToMusic,
  TICKS_PER_BEAT,
  type MusicalScore,
  type Note,
  type TrackRole,
} from '@soundiform/core';
import { projectShapeToStaff, revealedSegments, type ShapePath } from '@soundiform/shared';
import type { GenrePack } from '@soundiform/genres';
import { useShapeStore } from '@/stores/shapeStore';
import { useGenreStore } from '@/stores/genreStore';
import { useGenrePacksStore } from '@/stores/genrePacksStore';
import { toCompositionConfig } from '@/lib/genreAdapter';

/** ⚠️ הסרגל על רקע לבן (studio/page.tsx) — כל הצבעים כאן כהים/רוויים, לא בהירים-על-כהה. */
const SCAN_LINE_COLOR = 0x211b4a;
const SCAN_LINE_WIDTH = 2;
const NOTE_BAR_MIN_HEIGHT = 4;
const NOTE_BAR_ALPHA = 0.85;
const GLOW_BLUR_STRENGTH = 10;
const GLOW_ALPHA = 0.55;
const BACKGROUND_PULSE_COLOR = 0x8b7cf6;
const BURST_LIFETIME_SECONDS = 0.45;
const BURST_MAX_RADIUS = 22;
const SHAPE_TRACE_COLOR = 0x6c5fc4; // = frameRenderer.ts SHAPE_TRACE_COLOR
const SHAPE_TRACE_LINE_WIDTH = 3;
const SHAPE_TRACE_ALPHA = 0.8;
const SHAPE_TRACE_GLOW_ALPHA = 0.5;

const ROLE_COLORS: Record<TrackRole, number> = {
  lead: 0x8b7cf6,
  bass: 0xf59e0b,
  pad: 0x34d399,
  drums: 0xe11d48,
  skank: 0xf472b6,
};

export interface ScoreStaffProps {
  /** מיקום נוכחי בלופ, 0–1. */
  progress: number;
}

interface StaffLayout {
  totalTicks: number;
  minPitch: number;
  pitchRange: number;
  barHeight: number;
  width: number;
  height: number;
}

interface Burst {
  x: number;
  y: number;
  color: number;
  bornAtSeconds: number;
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

function computeLayout(score: MusicalScore, width: number, height: number): StaffLayout | null {
  const totalTicks = score.durationBars * score.timeSignature[0] * TICKS_PER_BEAT;
  const allPitches = score.tracks.flatMap((track) => track.notes.map((note) => note.pitch));
  if (allPitches.length === 0) {
    return null;
  }
  const minPitch = Math.min(...allPitches);
  const maxPitch = Math.max(...allPitches);
  const pitchRange = Math.max(1, maxPitch - minPitch);
  const barHeight = Math.max(NOTE_BAR_MIN_HEIGHT, height / (pitchRange + 4));
  return { totalTicks, minPitch, pitchRange, barHeight, width, height };
}

function noteRect(
  note: Note,
  layout: StaffLayout,
): { x: number; y: number; width: number; height: number } {
  const x = (note.startTick / layout.totalTicks) * layout.width;
  const noteWidth = Math.max(2, (note.durationTicks / layout.totalTicks) * layout.width);
  const pitchNormalized = (note.pitch - layout.minPitch) / layout.pitchRange;
  const y = (1 - pitchNormalized) * (layout.height - layout.barHeight);
  return { x, y, width: noteWidth, height: layout.barHeight };
}

/** אנרגיה כוללת (סכום velocity) של כל התווים שמתנגנים ברגע tick נתון — משמש לפעימת הרקע. */
function energyAtTick(score: MusicalScore, tick: number): number {
  let energy = 0;
  for (const track of score.tracks) {
    for (const note of track.notes) {
      if (tick >= note.startTick && tick < note.startTick + note.durationTicks) {
        energy += note.velocity;
      }
    }
  }
  return energy;
}

export function ScoreStaff({ progress }: ScoreStaffProps) {
  const paths = useShapeStore((state) => state.paths);
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const genreId = useGenreStore((state) => state.genreId);
  const packs = useGenrePacksStore((state) => state.packs);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const shapeGlowLayerRef = useRef<PixiGraphics | null>(null);
  const shapeCrispLayerRef = useRef<PixiGraphics | null>(null);
  const backgroundPulseRef = useRef<PixiGraphics | null>(null);
  const glowLayerRef = useRef<PixiGraphics | null>(null);
  const notesLayerRef = useRef<PixiGraphics | null>(null);
  const burstsLayerRef = useRef<PixiGraphics | null>(null);
  const scanLineRef = useRef<PixiGraphics | null>(null);
  const scoreRef = useRef<MusicalScore | null>(null);
  const previousProgressRef = useRef(0);
  const burstsRef = useRef<Burst[]>([]);
  const pathsRef = useRef<ShapePath[]>(paths);
  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  const score = useMemo(
    () => computeScore(paths, shapeHash, genreId, packs),
    [paths, shapeHash, genreId, packs],
  );
  useEffect(() => {
    scoreRef.current = score;
    previousProgressRef.current = 0;
    burstsRef.current = [];
  }, [score]);

  // אתחול/פירוק אפליקציית Pixi — פעם אחת, לא תלוי בהתקדמות/score.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let disposed = false;

    void (async () => {
      const { Application, Graphics, BlurFilter: BlurFilterCtor } = await import('pixi.js');
      const app = new Application();
      await app.init({ backgroundAlpha: 0, resizeTo: container, antialias: true });
      if (disposed) {
        app.destroy(true);
        return;
      }
      container.appendChild(app.canvas);

      const shapeGlowLayer = new Graphics();
      const shapeCrispLayer = new Graphics();
      const backgroundPulse = new Graphics();
      const glowLayer = new Graphics();
      const notesLayer = new Graphics();
      const burstsLayer = new Graphics();
      const scanLine = new Graphics();

      const glowFilter: BlurFilter = new BlurFilterCtor({ strength: GLOW_BLUR_STRENGTH });
      shapeGlowLayer.filters = [glowFilter];
      shapeGlowLayer.blendMode = 'add';
      glowLayer.filters = [glowFilter];
      glowLayer.blendMode = 'add';
      backgroundPulse.filters = [glowFilter];
      backgroundPulse.blendMode = 'add';
      burstsLayer.blendMode = 'add';

      // shapeGlowLayer/shapeCrispLayer ראשונים — הצורה המקורית מצטיירת מתחת לסרגל התווים.
      app.stage.addChild(
        shapeGlowLayer,
        shapeCrispLayer,
        backgroundPulse,
        glowLayer,
        notesLayer,
        burstsLayer,
        scanLine,
      );
      appRef.current = app;
      shapeGlowLayerRef.current = shapeGlowLayer;
      shapeCrispLayerRef.current = shapeCrispLayer;
      backgroundPulseRef.current = backgroundPulse;
      glowLayerRef.current = glowLayer;
      notesLayerRef.current = notesLayer;
      burstsLayerRef.current = burstsLayer;
      scanLineRef.current = scanLine;

      // ⭐ לולאת אנימציה מתמשכת (לא רק re-render לפי progress prop) — פרצי-אור דועכים
      // ופעימת-רקע צריכים להתעדכן בין frame ל-frame גם אם progress עצמו לא זז (למשל בהשהיה).
      app.ticker.add(() => {
        const currentScore = scoreRef.current;
        const nowSeconds = performance.now() / 1000;

        burstsRef.current = burstsRef.current.filter(
          (burst) => nowSeconds - burst.bornAtSeconds < BURST_LIFETIME_SECONDS,
        );
        burstsLayer.clear();
        for (const burst of burstsRef.current) {
          const age = (nowSeconds - burst.bornAtSeconds) / BURST_LIFETIME_SECONDS;
          const radius = BURST_MAX_RADIUS * age;
          const alpha = Math.max(0, 1 - age);
          burstsLayer
            .circle(burst.x, burst.y, radius)
            .fill({ color: burst.color, alpha: alpha * 0.7 });
        }

        backgroundPulse.clear();
        if (currentScore) {
          const layout = computeLayout(currentScore, app.renderer.width, app.renderer.height);
          if (layout) {
            const currentTick = previousProgressRef.current * layout.totalTicks;
            const energy = energyAtTick(currentScore, currentTick);
            const normalizedEnergy = Math.min(1, energy / 3);
            if (normalizedEnergy > 0.02) {
              const centerX = previousProgressRef.current * layout.width;
              const radius = layout.height * (0.12 + normalizedEnergy * 0.18);
              backgroundPulse
                .circle(centerX, layout.height / 2, radius)
                .fill({ color: BACKGROUND_PULSE_COLOR, alpha: normalizedEnergy * 0.14 });
            }
          }
        }
      });
    })();

    return () => {
      disposed = true;
      shapeGlowLayerRef.current = null;
      shapeCrispLayerRef.current = null;
      backgroundPulseRef.current = null;
      glowLayerRef.current = null;
      notesLayerRef.current = null;
      burstsLayerRef.current = null;
      scanLineRef.current = null;
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, []);

  // ציור מחדש של כל התווים (+הזוהר שלהם) — רק כש-score משתנה (לא בכל פריים).
  useEffect(() => {
    const app = appRef.current;
    const notesLayer = notesLayerRef.current;
    const glowLayer = glowLayerRef.current;
    if (!app || !notesLayer || !glowLayer) {
      return;
    }
    notesLayer.clear();
    glowLayer.clear();
    if (!score) {
      return;
    }

    const layout = computeLayout(score, app.renderer.width, app.renderer.height);
    if (!layout) {
      return;
    }

    for (const track of score.tracks) {
      const color = ROLE_COLORS[track.role];
      for (const note of track.notes) {
        const rect = noteRect(note, layout);
        const alpha = NOTE_BAR_ALPHA * (0.5 + note.velocity * 0.5);
        notesLayer.rect(rect.x, rect.y, rect.width, rect.height).fill({ color, alpha });
        glowLayer
          .rect(rect.x, rect.y, rect.width, rect.height)
          .fill({ color, alpha: alpha * GLOW_ALPHA });
      }
    }
  }, [score]);

  // עדכון קו הסריקה + "שרטוט מסונכרן" של הצורה + זיהוי "חציית תו" (יורה burst) — על כל שינוי ב-progress.
  useEffect(() => {
    const app = appRef.current;
    const scanLine = scanLineRef.current;
    const shapeGlowLayer = shapeGlowLayerRef.current;
    const shapeCrispLayer = shapeCrispLayerRef.current;
    if (!app || !scanLine || !shapeGlowLayer || !shapeCrispLayer) {
      return;
    }
    scanLine.clear();
    shapeGlowLayer.clear();
    shapeCrispLayer.clear();

    const currentPaths = pathsRef.current;
    if (currentPaths.length > 0) {
      const shapeLayout = projectShapeToStaff(
        { version: '1.0.0', paths: currentPaths },
        { width: app.renderer.width, height: app.renderer.height },
      );
      for (const points of revealedSegments(shapeLayout, progress)) {
        const [first, ...rest] = points;
        if (!first) {
          continue;
        }
        shapeCrispLayer.moveTo(first.x, first.y);
        shapeGlowLayer.moveTo(first.x, first.y);
        for (const point of rest) {
          shapeCrispLayer.lineTo(point.x, point.y);
          shapeGlowLayer.lineTo(point.x, point.y);
        }
        shapeCrispLayer.stroke({
          width: SHAPE_TRACE_LINE_WIDTH,
          color: SHAPE_TRACE_COLOR,
          alpha: SHAPE_TRACE_ALPHA,
          join: 'round',
          cap: 'round',
        });
        shapeGlowLayer.stroke({
          width: SHAPE_TRACE_LINE_WIDTH,
          color: SHAPE_TRACE_COLOR,
          alpha: SHAPE_TRACE_ALPHA * SHAPE_TRACE_GLOW_ALPHA,
          join: 'round',
          cap: 'round',
        });
      }
    }

    if (!score) {
      previousProgressRef.current = progress;
      return;
    }
    const width = app.renderer.width;
    const x = progress * width;
    scanLine
      .moveTo(x, 0)
      .lineTo(x, app.renderer.height)
      .stroke({ width: SCAN_LINE_WIDTH, color: SCAN_LINE_COLOR, alpha: 0.9 });

    // ⭐ פרץ-אור לכל תו שהסורק "חצה" מאז ה-progress הקודם — רק תזוזה קדימה (לא loop-wrap).
    const previousProgress = previousProgressRef.current;
    if (progress > previousProgress) {
      const layout = computeLayout(score, width, app.renderer.height);
      if (layout) {
        const fromTick = previousProgress * layout.totalTicks;
        const toTick = progress * layout.totalTicks;
        const nowSeconds = performance.now() / 1000;
        for (const track of score.tracks) {
          const color = ROLE_COLORS[track.role];
          for (const note of track.notes) {
            if (note.startTick >= fromTick && note.startTick < toTick) {
              const rect = noteRect(note, layout);
              burstsRef.current.push({
                x: rect.x,
                y: rect.y + rect.height / 2,
                color,
                bornAtSeconds: nowSeconds,
              });
            }
          }
        }
      }
    }
    previousProgressRef.current = progress;
  }, [progress, score]);

  return <div ref={containerRef} className="pointer-events-none absolute inset-0" />;
}
