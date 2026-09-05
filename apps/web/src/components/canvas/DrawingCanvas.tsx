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
 *
 * ⭐ 2026-09-04 (Kids Studio v1): כל path מצויר עכשיו עם ה-pathStyles שלו מ-shapeStore
 * (צבע/עובי), עם STROKE_COLOR/LINE_WIDTH כ-fallback — נקרא ישירות מה-store (כמו hasUploadedImage
 * כבר עושה) ולא כ-prop חדש, כדי לא לגעת בחתימת הקומפוננטה. ב-Studio הרגיל pathStyles תמיד
 * ריק (שום דבר שם לא קורא ל-setCurrentColor/setCurrentStrokeWidth), אז הרינדור זהה לישן.
 * ⚠️ הקו הפעיל (activeStrokePoints, טרם הושלם) **נשאר** ב-ACTIVE_STROKE_COLOR/LINE_WIDTH
 * הקבועים במכוון — לא currentColor. הוא איתות "אתה מצייר עכשיו", לא תצוגה מקדימה של הצבע
 * שנבחר; ולוּ היה עוקב אחרי currentColor, הקו הפעיל ב-Studio הרגיל היה הופך מסגול לכהה
 * (כי currentColor שם נשאר בברירת המחדל, שהיא STROKE_COLOR הכהה) — רגרסיה חזותית אמיתית.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ShapePoint } from '@soundiform/shared';
import { useShapeCapture } from '@/hooks/useShapeCapture';
import { useShapeStore } from '@/stores/shapeStore';

/** ⚠️ הקנבס עצמו לבן (studio/page.tsx) — קו כהה (לא בהיר-על-כהה כמו קודם). */
const STROKE_COLOR = '#211b4a';
const ACTIVE_STROKE_COLOR = '#6c5fc4';
const LINE_WIDTH = 6;

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
  canvasWidth: number,
  canvasHeight: number,
  color: string,
  strokeWidth: number = LINE_WIDTH,
  closed = false,
): void {
  // ⭐ 2026-09-05 (Kids Studio — סטיקר-אימוג'י): 'transparent' מסמן path שקיים רק בשביל
  // הצליל, בלי ייצוג חזותי משלו (EmojiStickerLayer מציג את האימוג'י מעליו במקום). ⚠️
  // בלי הבדיקה הזו, `${color}33` היה בונה 'transparent33' — ערך CSS לא-תקין ש-canvas
  // מתעלם ממנו בשקט, ומשאיר את fillStyle הקודם בטעות (לא "בלתי-נראה", אלא צבע אקראי).
  if (points.length < 2 || color === 'transparent') {
    return;
  }
  context.strokeStyle = color;
  context.lineWidth = strokeWidth;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.beginPath();
  const [first, ...rest] = points;
  context.moveTo(first.x * canvasWidth, first.y * canvasHeight);
  for (const point of rest) {
    context.lineTo(point.x * canvasWidth, point.y * canvasHeight);
  }
  // ⭐ 2026-09-04 (Kids Studio v1): צורות מונחות (עיגול/ריבוע/כוכב/לב) סגורות — ציור-יד
  // רגיל תמיד closed:false, אז זה תמיד היה inert עד עכשיו.
  if (closed) {
    context.closePath();
    context.fillStyle = `${color}33`; // מילוי שקוף-חלקית (hex + alpha suffix)
    context.fill();
  }
  context.stroke();
}

export function DrawingCanvas({ hidden = false }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { paths, activeStrokePoints, isDrawing, beginStroke, extendStroke, endStroke } =
    useShapeCapture();
  /**
   * ⚠️ 2026-09-02 (באג שנתפס בבדיקה חיה): כשמוצגת תמונה שהועלתה, **השלד לא מצויר כאן.**
   *
   * הקנבס הזה מותח את הצורה על **כל** הלוח, בעוד ש-UploadedImageLayer מציג את התמונה
   * ביחס-הצורה המקורי שלה (object-contain) — כלומר עם שוליים. בשוליים האלה השלד המתוח
   * נחשף מתחת לתמונה, וזה מה שנראה בצילום המסך: קווים כהים בקצה השמאלי והימני שאינם
   * חלק מהתמונה.
   *
   * ⚠️ הציור הפעיל (activeStrokePoints) **כן** ממשיך להיות מצויר — ברגע שהמשתמש מתחיל
   * לצייר, addPath ממילא מנקה את התמונה (shapeStore), ואסור שהקו שלו ייעלם בזמן שהוא מצייר.
   */
  const hasUploadedImage = useShapeStore((state) => state.previewImageUrl !== null);
  const pathStyles = useShapeStore((state) => state.pathStyles);
  /** מבטיח שרק מגע/עכבר אחד מצייר בכל רגע — נגיעה שנייה בזמן ציור (למשל כף יד בטעות) מתעלמת ממנה. */
  const activePointerIdRef = useRef<number | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!hasUploadedImage) {
      paths.forEach((path, index) => {
        const style = pathStyles[index];
        drawStroke(
          context,
          path.points,
          canvas.width,
          canvas.height,
          style?.color ?? STROKE_COLOR,
          style?.strokeWidth ?? LINE_WIDTH,
          path.closed,
        );
      });
    }
    drawStroke(context, activeStrokePoints, canvas.width, canvas.height, ACTIVE_STROKE_COLOR);
  }, [paths, pathStyles, activeStrokePoints, hasUploadedImage]);

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
