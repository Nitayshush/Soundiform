/**
 * @file        genreStore.ts
 * @description בחירת הסגנון הפעיל (GenrePack) + התמדה — §5, GenreSelector.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { loadActiveGenrePacks } from '@shape-sound/genres';

const STORAGE_KEY = 'shape-sound:selected-genre';
const [firstActivePack] = loadActiveGenrePacks();
const DEFAULT_GENRE_ID = firstActivePack?.id ?? 'cinematic';

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
