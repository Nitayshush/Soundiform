/**
 * @file        frameRenderer.ts
 * @description ⭐ מצייר פריים בודד של וידאו — קווי הצורה + נקודה נעה על הקונטור.
 * @author      Shape-to-Sound
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — "פריוויו ≈ פלט סופי" גם לוידאו: הצבעים/עובי-קו ומיקום הנקודה על הקונטור
 * (index = floor(progress * points.length)) זהים בכוונה ל-DrawingCanvas.tsx/Playhead.tsx
 * (הפריוויו החי בדפדפן) — אותה שפה חזותית, לא רק אותו סאונד.
 */

import { createCanvas } from '@napi-rs/canvas';
import type { ShapePoint } from '@shape-sound/shared';

const BACKGROUND_COLOR = '#ffffff';
const STROKE_COLOR = '#111827'; // = DrawingCanvas.tsx STROKE_COLOR
const DOT_COLOR = '#6366f1'; // = Playhead.tsx DOT_COLOR (0x6366f1)
const WATERMARK_TEXT = 'Shape-to-Sound';
const WATERMARK_COLOR = 'rgba(17, 24, 39, 0.55)';

export interface FrameDimensions {
  width: number;
  height: number;
}

interface DrawablePath {
  points: ShapePoint[];
  closed: boolean;
}

function drawShapeStrokes(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  paths: readonly DrawablePath[],
  width: number,
  height: number,
): void {
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const path of paths) {
    if (path.points.length < 2) {
      continue;
    }
    ctx.beginPath();
    const [first, ...rest] = path.points;
    if (!first) {
      continue;
    }
    ctx.moveTo(first.x * width, first.y * height);
    for (const point of rest) {
      ctx.lineTo(point.x * width, point.y * height);
    }
    if (path.closed) {
      ctx.closePath();
    }
    ctx.stroke();
  }
}

function drawWatermark(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  width: number,
  height: number,
): void {
  const fontSize = Math.max(12, Math.round(width * 0.025));
  ctx.font = `${String(fontSize)}px sans-serif`;
  ctx.fillStyle = WATERMARK_COLOR;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(WATERMARK_TEXT, width - fontSize * 0.6, height - fontSize * 0.6);
}

/**
 * מצייר פריים בודד. contourPoints מחושב פעם אחת ע"י הקורא (extractContour) — לא כאן,
 * כי זה חישוב גיאומטרי זהה לכל פריים; אין טעם לחשב אותו מחדש מאות פעמים לוידאו אחד.
 * watermark: §9 — מסלול חינם מוריד וידאו "720p ממותג".
 */
export function renderVideoFrame(
  paths: readonly DrawablePath[],
  contourPoints: readonly ShapePoint[],
  progress: number,
  dimensions: FrameDimensions,
  watermark: boolean,
): Buffer {
  const { width, height } = dimensions;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  drawShapeStrokes(ctx, paths, width, height);

  if (contourPoints.length > 0) {
    const index = Math.min(contourPoints.length - 1, Math.floor(progress * contourPoints.length));
    const point = contourPoints[index];
    if (point) {
      const dotRadius = Math.max(4, width * 0.015);
      ctx.fillStyle = DOT_COLOR;
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (watermark) {
    drawWatermark(ctx, width, height);
  }

  return canvas.toBuffer('image/png');
}
