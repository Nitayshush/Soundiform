/**
 * @file        creationTitle.ts
 * @description ⭐ 2026-09-13: כותרת ברירת-מחדל מ-genreId ("trance" -> "Trance creation") —
 *              משמשת בכל מקום שבו ליצירה אין title משלה (עדיין לא מולא, או דולג ב-CreationDetailsModal).
 *              היה משוכפל שלוש פעמים (useDownload.ts, s/[shareId]/page.tsx, account/gallery/page.tsx) — מאוחד כאן.
 * @author      Soundiform
 * @created     2026-09-13
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

/** "trance" -> "Trance". ⭐ 2026-09-14: מיוצא בנפרד — gallery/page.tsx צריך רק את זה, בלי "creation". */
export function genreDisplayName(genreId: string): string {
  return `${genreId.charAt(0).toUpperCase()}${genreId.slice(1)}`;
}

export function defaultCreationTitle(genreId: string): string {
  return `${genreDisplayName(genreId)} creation`;
}
