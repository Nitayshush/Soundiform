/**
 * @file        soundSelectionStore.ts
 * @description ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 1): בחירת-צליל נבחרת-משתמש לפי
 *              ז'אנר+תפקיד (bass/lead/drums/pad) + התמדה — ראה SoundSelector.tsx.
 * @author      Soundiform
 * @created     2026-08-24
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ מבנה: { [genreId]: { [role]: optionId[] } } — נשמר לכל ז'אנר בנפרד כי אופציות-הצליל
 * שונות לגמרי בין סגנונות (trance's "reese" bass לא קיים ב-house). לא נדרש ניקוי כשעוברים
 * ז'אנר — הבחירה הישנה פשוט לא רלוונטית עד שחוזרים לאותו ז'אנר.
 *
 * ⭐ 2026-08-25 (בחירת-צליל מרובה): optionId בודד → מערך optionId[] — כמה תתי-צלילים
 * ביחד לאותו role, לא רק אחד. genreAdapter.ts's mergeSynthPresets ממזג את השכבות (layers)
 * של כל האופציות הנבחרות לפריסט אחד. MUTED_SOUND_OPTION_ID נשאר מצב-יחיד (מנקה הכל).
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TrackRole } from '@soundiform/core';
import { MUTED_SOUND_OPTION_ID } from '@/lib/genreAdapter';

// ⭐ 2026-08-25 (בחירת-צליל מרובה): מפתח חדש (היה 'soundiform:sound-selections') — הצורה
// הישנה שמורה הייתה optionId בודד (string) לכל role, לא מערך. בלי שינוי-מפתח, ערכים ישנים
// היו "נראים" תקפים ל-TS (אין ולידציה בזמן ריצה על persist) אבל מתנהגים שגוי בשקט: מחרוזת
// גם היא iterable/יש לה .includes(), כך ש-current.includes(...)/[...current, id] על מחרוזת
// ישנה מייצרים תוצאות משובשות (למשל spread של מחרוזת מפרק אותה לתווים בודדים) — בדיוק סוג
// הבאג ש-"השתקתי הכל חוץ מתופים ועדיין שמעתי עוד צלילים" יכול לנבוע ממנו. מפתח חדש = דף חלק.
const STORAGE_KEY = 'soundiform:sound-selections-v2';

/** ⭐ 2026-08-25: תקרה על כמה תתי-צלילים אפשר לצרף בו-זמנית לאותו role — שכבות רבות מדי
 * הופכות למעומעם/יקר-CPU. הוספה שחוצה את התקרה מסירה את הישנה-ביותר (FIFO), לא no-op. */
const MAX_SELECTED_PER_ROLE = 3;

type GenreSoundSelections = Partial<Record<TrackRole, string[]>>;

interface SoundSelectionState {
  selectionsByGenre: Record<string, GenreSoundSelections>;
  toggleSound: (genreId: string, role: TrackRole, optionId: string) => void;
}

export const useSoundSelectionStore = create<SoundSelectionState>()(
  persist(
    (set) => ({
      selectionsByGenre: {},
      toggleSound: (genreId, role, optionId) => {
        set((state) => {
          const current = state.selectionsByGenre[genreId]?.[role] ?? [];
          let next: string[];
          if (optionId === MUTED_SOUND_OPTION_ID) {
            next = [MUTED_SOUND_OPTION_ID];
          } else if (current.includes(MUTED_SOUND_OPTION_ID)) {
            next = [optionId];
          } else if (current.includes(optionId)) {
            next = current.filter((id) => id !== optionId);
          } else if (current.length >= MAX_SELECTED_PER_ROLE) {
            next = [...current.slice(1), optionId];
          } else {
            next = [...current, optionId];
          }
          return {
            selectionsByGenre: {
              ...state.selectionsByGenre,
              [genreId]: { ...state.selectionsByGenre[genreId], [role]: next },
            },
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
