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
 *
 * ⭐⭐ 2026-09-05 (דווח חי, מובייל): "כפתורי הסגנון צריכים להיות בשורה אחת" — בכפתורי הגודל
 * המקורי (h-12/text-base) חמישה כפתורים לא נכנסו בשורה אחת במסכי-נייד ברוחב טיפוסי, וגם
 * flex-wrap גרם לחפיפה מכוערת עם התווית "Music Style" מעליהם בנוף (landscape). תוקן:
 * flex-nowrap קבוע (לא עובר לשורה שנייה בשום מצב) + גודל-קטן-כברירת-מחדל שגדל רק מ-sm
 * ומעלה (mobile-first — בדיוק כמו button.tsx המשותף); overflow-x-auto הוא רשת-ביטחון
 * (גלילה אופקית) למקרה-קיצון של מסך צר במיוחד, לא ההתנהגות המצופה בפועל.
 *
 * ⭐⭐⭐ 2026-09-05 (דווח חי, דסקטופ — "הכפתורים גבוהים מדי, והטבעת של הנבחר נחתכת"): שני
 * דברים ביחד. (1) overflow-x-auto (למעלה) **מכריח** גם overflow-y ל-auto לפי ה-spec (אותה
 * תופעה בדיוק שכבר תועדה ב-SoundSelector.tsx) — טבעת-הבחירה (ring, box-shadow שיוצא מחוץ
 * לגבולות הכפתור) נחתכת ע"י תיבת-האוברפלואו המאונכת שנוצרה בטעות. ⚠️ כתיבת overflow-y-visible
 * במפורש **לא** מספיקה לבטל את זה — ה-spec מפעיל את ההמרה ל-auto בהתאם לצירוף
 * visible+non-visible, לא רק לברירת-מחדל, אז הנוסחה היחידה שבאמת עוזרת היא לתת לטבעת מרווח
 * (py) בתוך תיבת ה-auto, לא לנסות "לבטל" אותה. (2) גם הגובה/הטבעת עצמם הוקטנו טיפה בשני
 * הגדלים (לא רק דסקטופ) — פחות סיכוי לחיתוך בכל מסך, לא רק תיקון-חורף לבאג הזה.
 *
 * ⭐⭐⭐⭐ 2026-09-05 (דווח חי מיד אחר-כך: "עכשיו שני הכפתורים בקצוות נחתכים"): אותו באג
 * בדיוק, ציר אחר — py פתר את הציר האנכי, אבל טבעת-הבחירה יוצאת גם שמאלה/ימינה מעבר לגבולות
 * הכפתור, ובלי px גם הן נחתכות ע"י אותה תיבת overflow-x-auto (הפעם על הציר שהיא *אמורה*
 * לחתוך, פשוט לא ציפינו שהתוכן עצמו — כולל הטבעת — יגיע עד ממש לקצה בלי שום מרווח). נוסף px
 * תואם ל-py, מאותה סיבה בדיוק.
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
    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto px-1 py-1 sm:gap-2">
      {GENRES.map(({ id, label, className }) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            setGenreId(id);
          }}
          aria-pressed={genreId === id}
          className={`${className} flex h-6 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-bold text-white shadow-sm transition-transform active:scale-90 sm:h-9 sm:px-4 sm:text-sm ${
            genreId === id ? 'ring-2 ring-white ring-offset-1 ring-offset-background' : ''
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
