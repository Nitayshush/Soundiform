/**
 * @file        soundSelectionStore.ts
 * @description ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 1): בחירת-צליל נבחרת-משתמש לפי
 *              ז'אנר+תפקיד (bass/lead/drums/pad) + התמדה — ראה SoundSelector.tsx.
 * @author      Soundiform
 * @created     2026-08-24
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ מבנה: { [genreId]: { [role]: optionId } } — נשמר לכל ז'אנר בנפרד כי אופציות-הצליל
 * שונות לגמרי בין סגנונות (trance's "reese" bass לא קיים ב-house). לא נדרש ניקוי כשעוברים
 * ז'אנר — הבחירה הישנה פשוט לא רלוונטית עד שחוזרים לאותו ז'אנר.
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TrackRole } from '@soundiform/core';

const STORAGE_KEY = 'soundiform:sound-selections';

type GenreSoundSelections = Partial<Record<TrackRole, string>>;

interface SoundSelectionState {
  selectionsByGenre: Record<string, GenreSoundSelections>;
  selectSound: (genreId: string, role: TrackRole, optionId: string) => void;
}

export const useSoundSelectionStore = create<SoundSelectionState>()(
  persist(
    (set) => ({
      selectionsByGenre: {},
      selectSound: (genreId, role, optionId) => {
        set((state) => ({
          selectionsByGenre: {
            ...state.selectionsByGenre,
            [genreId]: { ...state.selectionsByGenre[genreId], [role]: optionId },
          },
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
