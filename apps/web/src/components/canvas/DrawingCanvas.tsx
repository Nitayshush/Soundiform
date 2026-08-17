/**
 * @file        DrawingCanvas.tsx
 * @description ⭐ קנבס הציור הראשי — לכידת צורה מעכבר/מגע. ליבת חוויית הקלט.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ShapePoint } from '@shape-sound/shared';
import { useShapeCapture } from '@/hooks/useShapeCapture';

const STROKE_COLOR = '#111827';
const ACTIVE_STROKE_COLOR = '#6366f1';
const LINE_WIDTH = 2;

function toNormalizedPoint(event: PointerEvent, canvas: HTMLCanvasElement): ShapePoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

function drawStroke(
  context: CanvasRenderingContext2D,
  points: ShapePoint[],
  width: number,
  height: number,
  color: string,
): void {
  if (points.length < 2) {
    return;
  }
  context.strokeStyle = color;
  context.lineWidth = LINE_WIDTH;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.beginPath();
  const [first, ...rest] = points;
  context.moveTo(first.x * width, first.y * height);
  for (const point of rest) {
    context.lineTo(point.x * width, point.y * height);
  }
  context.stroke();
}

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { paths, activeStrokePoints, isDrawing, beginStroke, extendStroke, endStroke } =
    useShapeCapture();
  /** מבטיח שרק מגע/עכבר אחד מצייר בכל רגע — נגיעה שנייה בזמן ציור (למשל כף יד בטעות) מתעלמת ממנה. */
  const activePointerIdRef = useRef<number | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const path of paths) {
      drawStroke(context, path.points, canvas.width, canvas.height, STROKE_COLOR);
    }
    drawStroke(context, activeStrokePoints, canvas.width, canvas.height, ACTIVE_STROKE_COLOR);
  }, [paths, activeStrokePoints]);

  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  // עדכון גודל ה-backing store כשגודל התצוגה משתנה (מריץ פעם אחת — לא תלוי במסלולים).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handleResize = (): void => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      redrawRef.current();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas);
    handleResize();

    return () => {
      observer.disconnect();
    };
  }, []);

  // ציור מחדש כשהמסלולים משתנים, בלי לגעת בגודל ה-canvas.
  useEffect(() => {
    redraw();
  }, [redraw]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || activePointerIdRef.current !== null) {
        return;
      }
      activePointerIdRef.current = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      beginStroke(toNormalizedPoint(event.nativeEvent, canvas));
    },
    [beginStroke],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !isDrawing || event.pointerId !== activePointerIdRef.current) {
        return;
      }
      extendStroke(toNormalizedPoint(event.nativeEvent, canvas));
    },
    [extendStroke, isDrawing],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerId !== activePointerIdRef.current) {
        return;
      }
      activePointerIdRef.current = null;
      endStroke();
    },
    [endStroke],
  );

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
