/**
 * @file        Playhead.tsx
 * @description סמן הניגון המונפש מעל הקנבס, מסונכרן עם Tone.js. ראה PROJECT.md §11 Sprint 4.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה נקודה שנעה על הקונטור ולא פס-זמן ליניארי:
 * הזמן המוזיקלי כאן הוא מיקום לאורך הקשת של הצורה עצמה (§4.2 X axis) — נקודה שזזה
 * על קו הצורה שהמשתמש צייר מראה בפועל "איפה בצורה אנחנו עכשיו מוזיקלית", לא רק % גנרי.
 */

'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Application, Graphics as PixiGraphics } from 'pixi.js';
import { extractContour } from '@shape-sound/core';
import type { ShapePoint } from '@shape-sound/shared';
import { useShapeStore } from '@/stores/shapeStore';

const DOT_RADIUS = 6;
const DOT_COLOR = 0x6366f1;

export interface PlayheadProps {
  /** מיקום נוכחי בלופ, 0–1. */
  progress: number;
}

export function Playhead({ progress }: PlayheadProps) {
  const paths = useShapeStore((state) => state.paths);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const dotRef = useRef<PixiGraphics | null>(null);

  const contourPoints = useMemo<ShapePoint[] | null>(() => {
    if (paths.length === 0) {
      return null;
    }
    return extractContour({ version: '1.0.0', paths }).points;
  }, [paths]);

  // אתחול/פירוק אפליקציית Pixi — פעם אחת, לא תלוי בהתקדמות הניגון.
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
      const dot = new Graphics().circle(0, 0, DOT_RADIUS).fill(DOT_COLOR);
      dot.visible = false;
      app.stage.addChild(dot);
      appRef.current = app;
      dotRef.current = dot;
    })();

    return () => {
      disposed = true;
      dotRef.current = null;
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, []);

  // עדכון מיקום הנקודה — קורה על כל שינוי ב-progress (בעדיפות: לא מחשבים contour מחדש כאן).
  useEffect(() => {
    const app = appRef.current;
    const dot = dotRef.current;
    if (!app || !dot || !contourPoints || contourPoints.length === 0) {
      return;
    }
    const index = Math.min(contourPoints.length - 1, Math.floor(progress * contourPoints.length));
    const point = contourPoints[index];
    if (!point) {
      return;
    }
    dot.visible = true;
    dot.position.set(point.x * app.renderer.width, point.y * app.renderer.height);
  }, [progress, contourPoints]);

  return <div ref={containerRef} className="pointer-events-none absolute inset-0" />;
}
