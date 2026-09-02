/**
 * @file        Logo.tsx
 * @description ⭐ סימן המותג — קבצי SVG מקוריים שסופקו (2026-08-20), לא שחזור. מוטמע כ-SVG
 *              בודד לכל וריאנט (לא הרכבת flex+SVG נפרד) כדי לשמר במדויק את המיקום היחסי
 *              בין האיקון ל-wordmark שנקבע במקור — הרכבת flex גרמה לאיקון "לזוז"/לחפוף לטקסט.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ צבעי הגרסה הכהה (light-on-dark) — כל שימוש היום הוא על רקע כהה (Header/Studio/Login).
 * אם יתווסף אי-פעם הקשר בהיר (למשל favicon על שבב בהיר), יש להוסיף וריאנט נפרד עם צבעי
 * ה-light-lockup שסופקו (#4A3FA0 stroke, #8B7FD6/#6C5FC4 עמודות) — לא לנחש/לגזור מהכהה.
 *
 * ⚠️ 2026-09-02 (דווח בבדיקה חיה: "הלוגו בהדר נחתך): ה-viewBox הורחב מ-380 ל-440.
 *
 * ה-wordmark הוא **טקסט חי**, לא נתיב — ולכן רוחבו נקבע ע"י מטריקת הגופן שהדפדפן טוען
 * בפועל. ה-viewBox המקורי הותאם למטריקה צרה יותר: נמדד שעם Arial הדיו נגמר ב-368 מתוך
 * 380, כלומר מרווח של 3% בלבד. הדף מרנדר ב-**Geist** (`--font-sans`, ראה layout.tsx),
 * שרחב יותר — והאות האחרונה חרגה מה-viewBox ונחתכה, כי svg שורשי חותך לגבולות ה-viewport
 * כברירת מחדל.
 *
 * ⚠️ 440 נותן ~20% מרווח, שמכסה גם את שרשרת ה-fallback (Helvetica/Arial/system-ui) אם
 * Geist לא נטען. **אל תהדקו את הערך הזה בחזרה לרוחב הדיו** — כל שינוי גופן יחתוך שוב.
 * המרווח הוא שקוף ולא משפיע ויזואלית (`w-auto` על גובה קבוע).
 */

import { cn } from '@/lib/utils';

const ICON_STROKE = '#EFECFF';
const ICON_BAR_LIGHT = '#B6ABF0';
const ICON_BAR_LIGHTER = '#D2C9FF';
const ICON_BAR_BRIGHT = '#EFECFF';

/** האיקון בלבד (משולש+4 עמודות) — מ-logo-icon.svg שסופק, בצבעי הגרסה הכהה. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-8 w-auto', className)}
      aria-hidden="true"
    >
      <g transform="translate(20,46)">
        <path
          d="M45 10 L80 68 L10 68 Z"
          fill="none"
          stroke={ICON_STROKE}
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <rect x="94" y="48" width="10" height="20" rx="3" fill={ICON_BAR_LIGHT} />
        <rect x="111" y="34" width="10" height="34" rx="3" fill={ICON_BAR_LIGHTER} />
        <rect x="128" y="18" width="10" height="50" rx="3" fill={ICON_BAR_BRIGHT} />
        <rect x="145" y="34" width="10" height="34" rx="3" fill={ICON_BAR_LIGHTER} />
      </g>
    </svg>
  );
}

export interface LogoProps {
  className?: string;
  /** רק האיקון, בלי ה-wordmark — למקומות צפופים (למשל header קומפקטי במובייל). */
  markOnly?: boolean;
}

/** ה-lockup המלא — מ-logo-notagline-dark-v3.svg שסופק (בלי מלבן הרקע — ה-header כבר כהה). */
export function Logo({ className, markOnly = false }: LogoProps) {
  if (markOnly) {
    return <LogoMark className={className} />;
  }

  return (
    <svg
      viewBox="0 0 440 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-8 w-auto', className)}
      role="img"
      aria-label="Soundiform"
    >
      <g transform="translate(24,13) scale(0.8)">
        <path
          d="M40 8 L70 60 L10 60 Z"
          fill="none"
          stroke={ICON_STROKE}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <rect x="82" y="42" width="9" height="18" rx="2.5" fill={ICON_BAR_LIGHT} />
        <rect x="97" y="30" width="9" height="30" rx="2.5" fill={ICON_BAR_LIGHTER} />
        <rect x="112" y="16" width="9" height="44" rx="2.5" fill={ICON_BAR_BRIGHT} />
        <rect x="127" y="30" width="9" height="30" rx="2.5" fill={ICON_BAR_LIGHTER} />
      </g>
      <text
        x="148"
        y="61"
        fontFamily="var(--font-sans), 'Inter', 'Helvetica Neue', Arial, sans-serif"
        fontSize="46"
        fontWeight="500"
        letterSpacing="-0.5"
        fill="#F5F4FF"
      >
        sound<tspan fill={ICON_BAR_LIGHT}>iform</tspan>
      </text>
    </svg>
  );
}
