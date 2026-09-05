/**
 * @file        KidsGenrePicker.tsx
 * @description ⭐ 2026-09-04 (Kids Studio v1): בורר ז'אנר — כותב ל-genreStore.setGenreId,
 *              אותו store שה-GenreSelector הרגיל כותב אליו, אז המנוע לא מבחין בין השניים.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מפה מקומית קבועה, לא מ-genre pack metadata — לחבילות ז'אנר אין שדה icon/צבע כלל (נבדק:
 * packages/genres/src/schema.ts, רק id + displayName). זה מסמן חוב-אפשרי (אם ז'אנר חדש
 * יתווסף, המפה כאן צריכה עדכון ידני), אבל להוסיף שדה כזה לסכמה חוצה-חבילות רק בשביל העמוד
 * הזה הוא scope גדול משמעותית ממה שהתבקש כאן.
 *
 * ⭐ 2026-09-05 (דווח חי, סבב שני): אייקון-בלבד (🤸/🙌/🧘...) התברר כדו-משמעי — קשה לנחש
 * מה כל אייקון אמור לייצג בלי טקסט. הוחלף לכפתור-כדור צבעוני עם **שם הז'אנר כתוב**, לא רק
 * אייקון: "פשוט לעשות כפתורים ולרשום את הסגנונות, בסגנון שמתאים לילדים" — צבע גדול/עגול/
 * שמח לכל ז'אנר, טקסט גדול וברור, בלי לנסות לנחש אייקון-מייצג.
 */

'use client';

import { useGenreStore } from '@/stores/genreStore';

const GENRES: { id: string; label: string; className: string }[] = [
  { id: 'trance', label: 'Trance', className: 'bg-violet-400' },
  { id: 'house', label: 'House', className: 'bg-orange-400' },
  { id: 'chill', label: 'Chill', className: 'bg-sky-400' },
  { id: 'cinematic', label: 'Cinematic', className: 'bg-rose-400' },
  { id: 'reggae', label: 'Reggae', className: 'bg-green-500' },
];

export function KidsGenrePicker() {
  const genreId = useGenreStore((state) => state.genreId);
  const setGenreId = useGenreStore((state) => state.setGenreId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {GENRES.map(({ id, label, className }) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            setGenreId(id);
          }}
          aria-pressed={genreId === id}
          className={`${className} flex h-12 items-center justify-center rounded-full px-5 text-base font-bold text-white shadow-sm transition-transform active:scale-90 ${
            genreId === id ? 'ring-4 ring-white ring-offset-2 ring-offset-background' : ''
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
