/**
 * @file        DrawingCanvas.tsx
 * @description ⭐ קנבס הציור הראשי — לכידת צורה מעכבר/מגע. ליבת חוויית הקלט.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-08-23: prop `hidden` — בזמן ניגון, הציור הגולמי נעלם (opacity, לא unmount, כדי
 * שלא לאבד את גודל ה-canvas/backing-store) ו-ScoreStaff.tsx בונה אותו מחדש במיקומו הנכון
 * על סרגל התווים, לפי קו הסורק — לא שני ייצוגים שונים גלויים בו-זמנית.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ShapePoint } from '@soundiform/shared';
import { useShapeCapture } from '@/hooks/useShapeCapture';

/** ⚠️ הקנבס עצמו לבן (studio/page.tsx) — קו כהה (לא בהיר-על-כהה כמו קודם). */
const STROKE_COLOR = '#211b4a';
const ACTIVE_STROKE_COLOR = '#6c5fc4';
const LINE_WIDTH = 4;

export interface DrawingCanvasProps {
  /** true בזמן ניגון — הציור הגולמי דועך (ScoreStaff.tsx מרכיב אותו מחדש על הסורק). */
  hidden?: boolean;
}

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

export function DrawingCanvas({ hidden = false }: DrawingCanvasProps) {
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
      className="h-full w-full touch-none transition-opacity duration-300"
      style={{ opacity: hidden ? 0 : 1 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
