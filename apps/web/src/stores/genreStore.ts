/**
 * @file        genreStore.ts
 * @description בחירת הסגנון הפעיל (GenrePack) + התמדה — §5, GenreSelector.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ Sprint 9: DEFAULT_GENRE_ID קבוע מראש (לא נגזר מ-loadActiveGenrePacks) — הסגנונות
 * הפעילים בפועל נטענים אסינכרונית מ-/api/genres (genrePacksStore.ts), ואין להם ערך
 * מיידי/סינכרוני בזמן אתחול ה-store הזה. 'cinematic' תמיד קיים וזה בדיוק הפולבק שהיה כבר.
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = 'soundiform:selected-genre';
const DEFAULT_GENRE_ID = 'cinematic';

interface GenreStoreState {
  genreId: string;
  setGenreId: (genreId: string) => void;
}

export const useGenreStore = create<GenreStoreState>()(
  persist(
    (set) => ({
      genreId: DEFAULT_GENRE_ID,
      setGenreId: (genreId) => {
        set({ genreId });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
