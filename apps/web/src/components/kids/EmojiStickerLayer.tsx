/**
 * @file        EmojiStickerLayer.tsx
 * @description ⭐ 2026-09-04 (Kids Studio v1): שכבת אימוג'ים על הלוח. כל sticker נגרר-למקום
 *              (onPointerDown על הגוף) ונגרר-להגדלה/הקטנה (ידית) בלחיצה ישירה.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ המיכל **כן** pointer-events-none (בניגוד ל-ShapePlacementOverlay!) — סטיקרים קיימים
 * *כל הזמן* לצד ציור חופשי, לא רק בזמן-הצבה זמני; לו המיכל כולו תפס נגיעות, ילד לא היה
 * יכול לצייר בכלל כל עוד יש סטיקר על הלוח. רק הכפתורים עצמם (הסטיקר/ידית/מחיקה) הם
 * pointer-events-auto.
 *
 * ⭐⭐ 2026-09-05 (דווח חי: "מזיזים את האימוג'י ומופיע עיגול, לא ניתן לעדכן את מיקומו"):
 * לכל sticker יש pathIndex — ה-path התואם ב-shapeStore שנוצר בהצבה (ShapePlacementOverlay,
 * "האימוג'י מתנהג כמו עיגול"). גרירה/הגדלה מעדכנות x/y/size מקומית **על כל pointermove**
 * (בטוח — לא נוגע ב-shapeStore, ראה למטה), אבל את shapeStore.updatePath קוראים **רק על
 * pointerup** (endDrag) — לא בכל פריים, מאותה סיבה בדיוק ש-ShapePlacementOverlay לא קורא
 * ל-addPath בכל תזוזה (race על computeShapeHash האסינכרוני). כך הצליל *תמיד* עוקב אחרי
 * המיקום/גודל הסופיים של הסטיקר, ואף פעם לא נשאר "עיגול-יתום" חשוף במקום הישן.
 *
 * ⚠️ הצורה עצמה (העיגול) תמיד נוצרת עם pathStyles color='transparent' (studio/kids/page.tsx)
 * — בלתי-נראית מעצמה; האימוג'י כאן הוא הייצוג החזותי היחיד שלה.
 *
 * ⭐⭐⭐ 2026-09-05 (דווח חי: "מחיקת סטיקר חייבת להסיר גם את הצליל שלו"): removeSticker קורא
 * ל-shapeStore.removePath(pathIndex) בפועל (לא רק מסיר את ה-sticker הדקורטיבי). removePath
 * משנה את אורך המערך — ⚠️ קריטי: כל sticker אחר עם pathIndex שמצביע על path שבא *אחרי*
 * הנמחק חייב לזוז אחורה ב-1, אחרת הוא יצביע על ה-path הלא-נכון (זה שהחליף את מקומו
 * בעקבות ה-shift). הבעיה לא קיימת לצורות-גיאומטריות (ShapeTray) כי שום דבר לא עוקב אחרי
 * ה-index שלהן חוץ מ-shapeStore עצמו.
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { X } from 'lucide-react';
import { generateStickerCirclePath } from '@/lib/kidsShapes';
import { useShapeStore } from '@/stores/shapeStore';

export interface EmojiSticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
  /** font-size בפיקסלים. */
  size: number;
  /** אינדקס ה-path התואם ב-shapeStore.paths — ראה ⭐⭐ 2026-09-05 למעלה. */
  pathIndex: number;
}

export interface EmojiStickerLayerProps {
  stickers: EmojiSticker[];
  onChange: (next: EmojiSticker[]) => void;
}

const MIN_SIZE = 20;
const MAX_SIZE = 140;
type DragMode = 'move' | 'resize' | null;

function toNormalized(event: PointerEvent, container: HTMLDivElement): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

export function EmojiStickerLayer({ stickers, onChange }: EmojiStickerLayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragModeRef = useRef<DragMode>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // ⚠️ תלוי ב-stickers (לא ref) בכוונה — react-hooks/refs אוסר לעדכן ref בזמן רינדור, ומירוץ
  // כמו ב-addPath (ShapePlacementOverlay) לא רלוונטי כאן: עדכון x/y/size הוא state מקומי
  // סינכרוני, בלי חישוב אסינכרוני שיכול "לפגר" מאחורי עדכון מאוחר יותר.
  const updateSticker = useCallback(
    (id: string, patch: Partial<EmojiSticker>) => {
      onChange(stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [stickers, onChange],
  );

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, id: string, mode: DragMode) => {
      if (activePointerIdRef.current !== null) {
        return;
      }
      activePointerIdRef.current = event.pointerId;
      dragModeRef.current = mode;
      setSelectedId(id);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handleMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
      const container = containerRef.current;
      if (!container || event.pointerId !== activePointerIdRef.current || !dragModeRef.current) {
        return;
      }
      const normalized = toNormalized(event.nativeEvent, container);
      if (dragModeRef.current === 'move') {
        updateSticker(id, { x: normalized.x, y: normalized.y });
        return;
      }
      const sticker = stickers.find((s) => s.id === id);
      if (!sticker) {
        return;
      }
      // resize: מרחק פיזי (לא מנורמל!) מהמרכז — כדי שגרירה תרגיש עקבית בלי קשר לגודל המיכל.
      const rect = container.getBoundingClientRect();
      const dx = (normalized.x - sticker.x) * rect.width;
      const dy = (normalized.y - sticker.y) * rect.height;
      const distance = Math.hypot(dx, dy);
      updateSticker(id, { size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, distance * 1.6)) });
    },
    [stickers, updateSticker],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
      if (event.pointerId !== activePointerIdRef.current) {
        return;
      }
      // ⚠️ נלכד *לפני* האיפוס — קובע אם הייתה בכלל גרירה (לא רק לחיצה-לבחירה בלי תזוזה).
      const wasDragging = dragModeRef.current !== null;
      activePointerIdRef.current = null;
      dragModeRef.current = null;
      if (!wasDragging) {
        return;
      }
      const container = containerRef.current;
      const sticker = stickers.find((s) => s.id === id);
      if (!container || !sticker) {
        return;
      }
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      const normalizedSize = sticker.size / rect.width;
      const path = generateStickerCirclePath(
        sticker.x,
        sticker.y,
        normalizedSize,
        rect.width / rect.height,
      );
      useShapeStore.getState().updatePath(sticker.pathIndex, path);
    },
    [stickers],
  );

  /**
   * ⭐ 2026-09-05 (דווח חי: "מחיקת סטיקר חייבת להסיר גם את הצליל שלו"): removePath משנה
   * אורך paths בפועל, אז כל pathIndex ששמור על path שבא **אחרי** הנמחק חייב לזוז אחורה
   * ב-1 — אחרת הוא יצביע על ה-path הלא-נכון (זה שהחליף את מקומו).
   */
  const removeSticker = (id: string): void => {
    const removed = stickers.find((s) => s.id === id);
    if (!removed) {
      return;
    }
    useShapeStore.getState().removePath(removed.pathIndex);
    onChange(
      stickers
        .filter((s) => s.id !== id)
        .map((s) => (s.pathIndex > removed.pathIndex ? { ...s, pathIndex: s.pathIndex - 1 } : s)),
    );
    setSelectedId(null);
  };

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {stickers.map((sticker) => {
        const isSelected = sticker.id === selectedId;
        const handleOffset = Math.max(14, sticker.size * 0.35);
        return (
          <div
            key={sticker.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${String(sticker.x * 100)}%`, top: `${String(sticker.y * 100)}%` }}
          >
            <button
              type="button"
              aria-label="Sticker — drag to move"
              className="pointer-events-auto block touch-none leading-none select-none"
              style={{ fontSize: sticker.size }}
              onPointerDown={(event) => {
                startDrag(event, sticker.id, 'move');
              }}
              onPointerMove={(event) => {
                handleMove(event, sticker.id);
              }}
              onPointerUp={(event) => {
                endDrag(event, sticker.id);
              }}
              onPointerCancel={(event) => {
                endDrag(event, sticker.id);
              }}
            >
              {sticker.emoji}
            </button>
            {isSelected && (
              <>
                <button
                  type="button"
                  aria-label="Resize sticker"
                  onPointerDown={(event) => {
                    startDrag(event, sticker.id, 'resize');
                  }}
                  onPointerMove={(event) => {
                    handleMove(event, sticker.id);
                  }}
                  onPointerUp={(event) => {
                    endDrag(event, sticker.id);
                  }}
                  onPointerCancel={(event) => {
                    endDrag(event, sticker.id);
                  }}
                  className="pointer-events-auto absolute size-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-primary bg-background shadow-md"
                  style={{ right: -handleOffset, bottom: -handleOffset }}
                />
                <button
                  type="button"
                  aria-label="Remove sticker"
                  onClick={() => {
                    removeSticker(sticker.id);
                  }}
                  className="pointer-events-auto absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md"
                  style={{ left: -handleOffset, top: -handleOffset }}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
