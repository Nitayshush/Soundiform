/**
 * @file        ShapePlacementOverlay.tsx
 * @description ⭐ 2026-09-04 (Kids Studio v1): תצוגה מקדימה של צורה שנבחרה מ-ShapeTray —
 *              גרירה למיקום + גרירת ידית להגדלה/הקטנה, ורק בלחיצת "הנח" מתחייבת ל-shapeStore.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️⚠️ קריטי (עלה בבדיקת-תכנון): **אסור** לקרוא ל-addPath בכל pointermove של הגרירה.
 * addPath מפעיל חישוב shapeHash אסינכרוני בלי ניקוד-סדר (race — hash ישן יכול "לנצח" hash
 * חדש אם הוא מסיים לחשב אחרון), ו-useAudioEngine.canPlay תלוי ב-shapeHash!==null — קריאה
 * בכל פריים הייתה יוצרת הבהוב וחישוב מיותר בכל תזוזה. לכן המצב כאן (מיקום/גודל) הוא כולו
 * local component state, ו-addPath נקרא **פעם אחת בדיוק**, בלחיצת "הנח".
 *
 * ⚠️ ממורכב מעל DrawingCanvas כשכבה עצמאית (absolute inset-0) — בדיוק כמו RevealOverlay/
 * ScoreStaff שכבר יושבים מעליו באותו stack. לא נגענו ב-DrawingCanvas עצמו או בטיפול ה-pointer
 * שלו. ⚠️ המיכל **לא** pointer-events-none — הוא תופס בכוונה את כל שטח ה-inset-0, לא רק
 * מעל הצורה עצמה: כל עוד תצוגה-מקדימה פתוחה, נגיעה בכל מקום על הלוח היא חלק מהצבת-הצורה
 * (גרירה/הגדלה), לא התחלה של קו-יד חדש מתחת — לא רק "מחוץ לצורה מותר לצייר".
 *
 * ⚠️⚠️ 2026-09-04 (דווח חי: "העיגול יוצא ביצתי ולא מעוגל"): המיכל אינו מרובע (הלוח הוא
 * 16:9/ריבועי-בנייד, לא 1:1) — ראה applyAspectRatio ב-kidsShapes.ts. נמדד עם ResizeObserver
 * (כמו DrawingCanvas.tsx מודד את ה-backing-store שלו) כי היחס משתנה עם גודל המסך/סיבוב,
 * לא קבוע. התיקון חל גם על התצוגה המקדימה (SVG) וגם על הנקודות שנשמרות ב-commit — כך
 * שהצורה שנראית בזמן הגרירה היא בדיוק מה שיצטייר אחר-כך ב-DrawingCanvas.
 *
 * ⭐ 2026-09-05 (דווח חי: "בגלל שאין אישור של האימוג'י... האימוג'י לא משפיעה על המנגינה"):
 * prop `emoji` אופציונלי — כשקיים, האימוג'י (לא מצולע ה-SVG) הוא התצוגה הנגררת/נגררת-להגדלה,
 * אבל ה-commit **עדיין** מייצר צורת-עיגול רגילה (kind נשאר 'circle' תמיד עבור אימוג'י — ראה
 * studio/kids/page.tsx) ומתחייב ל-shapeStore בדיוק כמו כל צורה אחרת — "האימוג'י מתנהג כמו
 * עיגול", לפי בקשה מפורשת. onCommit אופציונלי מודיע לקורא את (cx,cy,size,pathIndex) כדי
 * שיוכל להציב sticker דקורטיבי (EmojiStickerLayer) באותו מיקום בדיוק, ולזכור **איזה** path
 * ב-shapeStore הוא מייצג (כדי שגרירה מאוחרת יותר תעדכן אותו — ראה EmojiStickerLayer.tsx).
 *
 * ⭐⭐ 2026-09-05 (דווח חי: "יש באג בהקטנה/הגדלה, לא עובד חלק"): resize חושב קודם מרחק
 * מנורמל-גולמי (Math.hypot על ערכים שכל אחד מנורמל לציר אחר — x לפי רוחב, y לפי גובה) —
 * על מיכל לא-מרובע (16:9) זה מערבב שתי סקאלות פיזיות שונות, כך שגרירה אלכסונית/אנכית
 * מרגישה לא-עקבית מול גרירה אופקית. תוקן לחשב מרחק **בפיקסלים פיזיים** (dx*width,
 * dy*height) ואז להמיר בחזרה ליחידות-size — אותה שיטה בדיוק ש-EmojiStickerLayer כבר השתמש
 * בה מההתחלה (שם לא דווח באג-חלקות).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Check, X } from 'lucide-react';
import { applyAspectRatio, generateShapePoints, type KidsShapeKind } from '@/lib/kidsShapes';
import { useShapeStore } from '@/stores/shapeStore';

const DEFAULT_SIZE = 0.25;
const MIN_SIZE = 0.06;
const MAX_SIZE = 0.9;

export interface ShapePlacementResult {
  cx: number;
  cy: number;
  size: number;
  /** אינדקס ה-path שנוצר ב-shapeStore.paths — ראה ⭐ 2026-09-05 למעלה. */
  pathIndex: number;
}

export interface ShapePlacementOverlayProps {
  kind: KidsShapeKind;
  /** כשקיים, מוצג במקום המצולע הגיאומטרי — ראה ⭐ 2026-09-05 למעלה. */
  emoji?: string;
  /** נקרא גם בהנחה וגם בביטול — ה-tray תמיד סוגר את התצוגה המקדימה אחרי זה. */
  onDone: () => void;
  /** נקרא רק בהנחה בפועל (לא בביטול), **לפני** onDone. ראה ⭐ 2026-09-05. */
  onCommit?: (result: ShapePlacementResult) => void;
}

function toNormalized(event: PointerEvent, container: HTMLDivElement): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

export function ShapePlacementOverlay({
  kind,
  emoji,
  onDone,
  onCommit,
}: ShapePlacementOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const addPath = useShapeStore((state) => state.addPath);
  const [cx, setCx] = useState(0.5);
  const [cy, setCy] = useState(0.5);
  const [size, setSize] = useState(DEFAULT_SIZE);
  // ⚠️ 16/9 כברירת מחדל (לפני המדידה הראשונה) — תואם aspect-video, הצורה הראשונית
  // הכי-סביר-נכונה עד ש-ResizeObserver מודד את המיכל בפועל.
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  /** רוחב/גובה המיכל בפיקסלים בפועל — לתרגום size (מנורמל) ל-font-size פיזי, ולחישוב-resize
   * במרחק פיזי עקבי (ראה ⭐⭐ 2026-09-05 למעלה). */
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const dragModeRef = useRef<'move' | 'resize' | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const measure = (): void => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setAspectRatio(rect.width / rect.height);
        setContainerWidth(rect.width);
        setContainerHeight(rect.height);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    return () => {
      observer.disconnect();
    };
  }, []);

  const handleBodyPointerDown = useCallback((event: ReactPointerEvent<Element>) => {
    if (activePointerIdRef.current !== null) {
      return;
    }
    activePointerIdRef.current = event.pointerId;
    dragModeRef.current = 'move';
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleHandlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== null) {
      return;
    }
    activePointerIdRef.current = event.pointerId;
    dragModeRef.current = 'resize';
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || event.pointerId !== activePointerIdRef.current || !dragModeRef.current) {
        return;
      }
      const normalized = toNormalized(event.nativeEvent, container);
      if (dragModeRef.current === 'move') {
        setCx(normalized.x);
        setCy(normalized.y);
        return;
      }
      // resize: מרחק **פיזי** (לא מנורמל-גולמי) מהמרכז — ראה ⭐⭐ 2026-09-05 למעלה. ממיר
      // בחזרה ליחידות-size (מנורמל לפי רוחב, כמו generateShapePoints מצפה) בסוף בלבד.
      const dxPx = (normalized.x - cx) * containerWidth;
      const dyPx = (normalized.y - cy) * containerHeight;
      const distancePx = Math.hypot(dxPx, dyPx);
      const nextSize = containerWidth > 0 ? (distancePx / containerWidth) * 2 : size;
      setSize(Math.min(MAX_SIZE, Math.max(MIN_SIZE, nextSize)));
    },
    [cx, cy, size, containerWidth, containerHeight],
  );

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointerIdRef.current) {
      return;
    }
    activePointerIdRef.current = null;
    dragModeRef.current = null;
  }, []);

  const points = applyAspectRatio(generateShapePoints(kind, cx, cy, size), cy, aspectRatio);
  const svgPoints = points.map((p) => `${String(p.x)},${String(p.y)}`).join(' ');
  const handleX = points.reduce((max, p) => Math.max(max, p.x), 0);
  const handleY = cy;
  // ⚠️ קירוב: גודל-הפונט נגזר מ-size (מנורמל, יחסי לרוחב) * רוחב-המיכל בפיקסלים — לא זהה
  // בדיוק ל-bounding box של הגליף (שונה בין אימוג'ים), אבל מספיק קרוב לתצוגה דקורטיבית.
  const emojiFontSize = size * containerWidth;

  const commit = (): void => {
    addPath({ points, closed: true });
    // ⚠️ addPath מוסיף (append) — האינדקס הטרי-ביותר הוא תמיד paths.length-1 מיד אחריו
    // (שני הקריאות רצות באותה סטאק סינכרוני, שום דבר אחר לא יכול "להתערב" ביניהן).
    const pathIndex = useShapeStore.getState().paths.length - 1;
    onCommit?.({ cx, cy, size, pathIndex });
    onDone();
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-30 touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {emoji ? (
        <span
          role="button"
          aria-label="Sticker — drag to move"
          className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none leading-none select-none active:cursor-grabbing"
          style={{
            left: `${String(cx * 100)}%`,
            top: `${String(cy * 100)}%`,
            fontSize: emojiFontSize || undefined,
          }}
          onPointerDown={handleBodyPointerDown}
        >
          {emoji}
        </span>
      ) : (
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <polygon
            points={svgPoints}
            className="fill-primary/30 stroke-primary cursor-grab active:cursor-grabbing"
            style={{ strokeWidth: 0.006, pointerEvents: 'auto' }}
            onPointerDown={handleBodyPointerDown}
          />
        </svg>
      )}
      {/* ⚠️ ידית ההגדלה/הקטנה — כפתור HTML רגיל (לא SVG) כדי לקבל touch target נוח (44px),
          ממוקם ב-% מעל ה-SVG לפי קואורדינטות מנורמלות זהות. */}
      <button
        type="button"
        aria-label="Resize shape"
        onPointerDown={handleHandlePointerDown}
        className="absolute size-8 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-primary bg-background shadow-md"
        style={{ left: `${String(handleX * 100)}%`, top: `${String(handleY * 100)}%` }}
      />
      <div className="absolute right-3 bottom-3 flex gap-2">
        <button
          type="button"
          onClick={onDone}
          aria-label="Cancel"
          className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-lg active:scale-95"
        >
          <X className="size-7" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={commit}
          aria-label="Place shape"
          className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
        >
          <Check className="size-7" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
