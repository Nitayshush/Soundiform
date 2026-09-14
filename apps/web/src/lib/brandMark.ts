/**
 * @file        brandMark.ts
 * @description ⭐ 2026-09-14: סימן-המותג (SVG), כמחרוזת קבועה — זהה בדיוק ל-app/icon.svg.
 *              משמש בתמונות OpenGraph (opengraph-image.tsx בכמה נתיבים) שצריכות אותו כ-data
 *              URI מוטבע. ⚠️ לא קורא את הקובץ בפועל (readFileSync) בכוונה: חלק מהתמונות
 *              רצות ב-edge runtime (בלי DB — דף הבית/גלריה), ששם אין גישה ל-fs בכלל. מחרוזת
 *              JS פשוטה עובדת זהה בשני ה-runtimes (edge ו-nodejs).
 * @author      Soundiform
 * @created     2026-09-14
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ אם app/icon.svg משתנה, לעדכן גם כאן באופן זהה — אין מנגנון אוטומטי שמסנכרן ביניהם.
 */

export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <rect width="160" height="160" rx="34" fill="#211B4A" />
  <g transform="translate(20,46)">
    <path d="M45 10 L80 68 L10 68 Z" fill="none" stroke="#EFECFF" stroke-width="5" stroke-linejoin="round" />
    <rect x="94" y="48" width="10" height="20" rx="3" fill="#B6ABF0" />
    <rect x="111" y="34" width="10" height="34" rx="3" fill="#D2C9FF" />
    <rect x="128" y="18" width="10" height="50" rx="3" fill="#EFECFF" />
    <rect x="145" y="34" width="10" height="34" rx="3" fill="#D2C9FF" />
  </g>
</svg>`;

/**
 * ⚠️ btoa() ולא Buffer — Buffer הוא API של Node, וחלק מהקוראות (דף הבית/גלריה) רצות
 * ב-edge runtime. btoa() תקין כאן כי BRAND_MARK_SVG הוא ASCII טהור (בלי עברית/יוניקוד).
 */
export function brandMarkDataUri(): string {
  return `data:image/svg+xml;base64,${btoa(BRAND_MARK_SVG)}`;
}
