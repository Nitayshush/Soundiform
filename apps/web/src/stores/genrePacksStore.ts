/**
 * @file        genrePacksStore.ts
 * @description ⭐ Sprint 9 — קאש בזיכרון של GenrePacks פעילים, נטענים מ-/api/genres (DB) ולא
 *              מ-@soundiform/genres הסטטי, כדי ש"עריכת GenrePack ללא דיפלוי" תשפיע בפועל
 *              גם על הפריוויו בדפדפן. נטען פעם אחת (לא בכל render) — GenreSelector קורא לזה
 *              ב-useEffect, useAudioEngine קורא ל-getState() ישירות (לא hook, כי play() הוא
 *              callback לא-רי-אקטיבי).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { create } from 'zustand';
import type { GenrePack } from '@soundiform/genres';

interface GenrePacksState {
  packs: GenrePack[];
  isLoading: boolean;
  error: string | null;
  fetchPacks: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to load styles';
}

export const useGenrePacksStore = create<GenrePacksState>((set, get) => ({
  packs: [],
  isLoading: false,
  error: null,
  fetchPacks: async () => {
    if (get().packs.length > 0 || get().isLoading) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      // ⚠️ 2026-09-01: cache:'no-store' לצד הכותרת בתשובה — כל צד יכול לטמן בנפרד, ותשובה
      // ישנה כאן פירושה שהמשתמש שומע גרסה קודמת של הסגנון בלי שום סימן לכך. ראה
      // api/genres/route.ts.
      const response = await fetch('/api/genres', { cache: 'no-store' });
      const body: unknown = await response.json();
      const parsed = body as { packs?: GenrePack[]; error?: string };
      if (!response.ok) {
        throw new Error(parsed.error ?? 'Failed to load styles');
      }
      set({ packs: parsed.packs ?? [], isLoading: false });
    } catch (caughtError) {
      set({ error: errorMessage(caughtError), isLoading: false });
    }
  },
}));
