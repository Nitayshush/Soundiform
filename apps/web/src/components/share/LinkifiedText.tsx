/**
 * @file        LinkifiedText.tsx
 * @description ⭐ 2026-09-13 (לפי בקשה חיה): הופך כתובות URL בתוך project.description (דף
 *              השיתוף) לקישורים לחיצים — הטקסט נכתב חופשי ב-CreationDetailsModal, אז קישור
 *              שהמשתמש הדביק שם צריך להיות שימושי בפועל, לא רק טקסט.
 * @author      Soundiform
 * @created     2026-09-13
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בטוח מפני XSS: מפצלים טקסט ל-React nodes רגילים (לעולם לא dangerouslySetInnerHTML) —
 * ה-href עצמו הוא בדיוק המחרוזת שהתאימה לרג'קס, לא HTML גולמי מוזרק.
 * ⚠️ rel="nofollow ugc" — זה תוכן שכתב משתמש (user-generated content), לא תוכן של Soundiform
 * עצמו; לא רוצים "להצביע" בעין של מנועי חיפוש על קישורים שהמשתמשים מדביקים.
 */

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export interface LinkifiedTextProps {
  text: string;
}

export function LinkifiedText({ text }: LinkifiedTextProps) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="break-all underline"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
