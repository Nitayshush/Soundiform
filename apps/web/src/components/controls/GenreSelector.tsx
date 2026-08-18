/**
 * @file        GenreSelector.tsx
 * @description ⭐ בורר הסגנון — אותה צורה, הפקות שונות. ראה PROJECT.md §4.5, §5.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { loadActiveGenrePacks } from '@shape-sound/genres';
import { useGenreStore } from '@/stores/genreStore';

// reggae לא מופיע כאן בכלל — loadActiveGenrePacks כבר מסנן requiresSamples (§5.2).
const ACTIVE_PACKS = loadActiveGenrePacks();

export function GenreSelector() {
  const genreId = useGenreStore((state) => state.genreId);
  const setGenreId = useGenreStore((state) => state.setGenreId);

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="סגנון מוזיקלי">
      {ACTIVE_PACKS.map((pack) => (
        <button
          key={pack.id}
          type="button"
          role="radio"
          aria-checked={pack.id === genreId}
          onClick={() => {
            setGenreId(pack.id);
          }}
          className={`rounded-full border px-3 py-1 text-sm ${
            pack.id === genreId ? 'bg-foreground text-background' : ''
          }`}
        >
          {pack.displayName.he}
        </button>
      ))}
    </div>
  );
}
