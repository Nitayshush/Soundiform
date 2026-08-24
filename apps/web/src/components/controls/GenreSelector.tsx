/**
 * @file        GenreSelector.tsx
 * @description ⭐ בורר הסגנון — אותה צורה, הפקות שונות. ראה PROJECT.md §4.5, §5.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ Sprint 9: הסגנונות נטענים מ-/api/genres (DB, ראה genrePacksStore.ts) — לא מ-@soundiform/genres
 * הסטטי — כדי ש"עריכת GenrePack ללא דיפלוי" תשפיע גם כאן, לא רק ברינדור השרת.
 */

'use client';

import { useEffect } from 'react';
import { useGenrePacksStore } from '@/stores/genrePacksStore';
import { useGenreStore } from '@/stores/genreStore';
import { Button } from '@/components/ui/button';

export function GenreSelector() {
  const genreId = useGenreStore((state) => state.genreId);
  const setGenreId = useGenreStore((state) => state.setGenreId);
  const packs = useGenrePacksStore((state) => state.packs);
  const isLoading = useGenrePacksStore((state) => state.isLoading);
  const error = useGenrePacksStore((state) => state.error);
  const fetchPacks = useGenrePacksStore((state) => state.fetchPacks);

  useEffect(() => {
    void fetchPacks();
  }, [fetchPacks]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    // ⭐ 2026-08-24 (בדיקה חיה, מובייל צר — 320px): הגלילה-האופקית הישנה מתחת ל-sm הסתירה
    // בפועל את רוב הסגנונות (המשתמש לא ידע לגלול, ובנוסף שיתפה שורה עם SoundSelector/
    // Upload/Save שדחקו אותה עוד יותר — ראה studio/page.tsx, עכשיו בשורה נפרדת). flex-wrap
    // + size="sm" (פילים קטנים יותר) במקום גלילה — *כל* הסגנונות תמיד גלויים בבת אחת,
    // גולשים לשורה שנייה אם צריך, לא נחבאים.
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Musical style">
      {isLoading && packs.length === 0 ? (
        <span className="text-sm text-muted-foreground">Loading styles…</span>
      ) : (
        packs.map((pack) => (
          <Button
            key={pack.id}
            type="button"
            role="radio"
            size="sm"
            variant={pack.id === genreId ? 'default' : 'outline'}
            className="shrink-0 rounded-full"
            aria-checked={pack.id === genreId}
            onClick={() => {
              setGenreId(pack.id);
            }}
          >
            {pack.displayName.en}
          </Button>
        ))
      )}
    </div>
  );
}
