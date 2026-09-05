/**
 * @file        EmojiPickerButton.tsx
 * @description ⭐ 2026-09-04 (Kids Studio v1, לפי בקשה חיה): כפתור שפותח פאנל בחירה מכל
 *              ספריית האימוג'ים (kidsEmoji.ts) — לא רק חמשת הז'אנרים.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ Portal ל-document.body (לא absolute מקומי) — אותה סיבה בדיוק כמו SoundSelector.tsx:
 * הפאנל לא צריך להיות כפוף ל-overflow של שום container אב. בניגוד ל-SoundSelector, זה
 * modal ממורכז-מסך (לא עוגן למיקום הכפתור) — פשוט משמעותית, ומספיק כאן כי אין container
 * עם overflow-x-auto בעמוד הזה (הטולבר התחתון הוא flex-wrap רגיל).
 *
 * ⭐ 2026-09-05 (דווח חי: "צריך כפתור וי לאשר את האימוג'י, כדי שישפיע על המנגינה"): לחיצה
 * על אימוג'י כאן **לא** מוסיפה sticker ישירות יותר (זה היה התנהגות v1) — היא רק בוחרת
 * אימוג'י (onPick) וסוגרת את הפאנל; הקורא (studio/kids/page.tsx) פותח ShapePlacementOverlay
 * עם emoji זה, כדי שהילד יגרור-למיקום/יגדיל ויאשר ב-✓ — בדיוק כמו ShapeTray. רק אחרי אישור
 * נוצר sticker בפועל, **וגם** צורת-עיגול ב-shapeStore (משפיעה על הצליל).
 */

'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { EMOJI_CATEGORIES } from '@/lib/kidsEmoji';

export interface EmojiPickerButtonProps {
  onPick: (emoji: string) => void;
  /** true בזמן שכבר יש צורה/אימוג'י בתצוגה מקדימה — ראה studio/kids/page.tsx. */
  disabled?: boolean;
}

export function EmojiPickerButton({ onPick, disabled = false }: EmojiPickerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
        disabled={disabled}
        aria-label="Add a sticker"
        className="flex size-12 items-center justify-center rounded-2xl border-2 border-border bg-card text-2xl shadow-sm transition-transform active:scale-90 disabled:opacity-40 [@media(pointer:coarse)]:size-14"
      >
        😊
      </button>
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <span className="text-base font-semibold">Stickers</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                  }}
                  aria-label="Close"
                  className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <div className="overflow-y-auto p-4">
                {EMOJI_CATEGORIES.map((category) => (
                  <div key={category.label} className="mb-4 last:mb-0">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {category.label}
                    </p>
                    <div className="grid grid-cols-6 gap-2">
                      {category.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            onPick(emoji);
                            setIsOpen(false);
                          }}
                          className="flex size-10 items-center justify-center rounded-xl text-2xl transition-transform active:scale-90 hover:bg-muted"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
