/**
 * @file        useVisibleViewport.ts
 * @description ⭐ 2026-08-29: מודד את האזור שבאמת **נראה** בחלון — לא את ה-layout viewport.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ למה זה קיים (נתפס בשתי בדיקות חיות רצופות בנייד): לוח-הציור המוגדל נחתך בתחתית,
 * ואיתו נעלם כפתור ההקטנה — כלומר המשתמש נתקע במצב מורחב.
 *
 * הניסיון הראשון היה `inset-0`, שנמדד מול ה-**layout viewport** — וזה כמעט תמיד גבוה
 * מהאזור הנראה בנייד. הניסיון השני היה `h-[100dvh]`, שאמור להתחשב בכרום-הדפדפן — אבל גם
 * הוא לא הספיק: בדפדפני-נייד סרגל-הכתובת **מרחף מעל** התוכן, ואחרי סיבוב מכשיר הערך לא
 * תמיד מתעדכן מיד.
 *
 * `visualViewport` הוא ה-API היחיד שמדווח את המלבן שבאמת נראה, כולל כרום מרחף וכולל
 * ההיסט שלו מראש ה-layout viewport. הוא גם משדר `resize`/`scroll` בכל שינוי כזה.
 *
 * ⚠️ מדידה נוספת אחרי סיבוב: `orientationchange` נורה **לפני** שהדפדפן מסיים לפרוס מחדש,
 * ולכן מדידה באותו רגע מחזירה את המידות הישנות. מודדים שוב בפריים הבא ואחרי השהיה קצרה.
 */

'use client';

import { useEffect, useState } from 'react';

export interface VisibleViewport {
  height: number;
  /** ההיסט של האזור הנראה מראש ה-layout viewport (כשכרום מרחף דוחף אותו למטה). */
  offsetTop: number;
}

/** ⚠️ מדידה מאוחרת אחרי סיבוב — ראה ההערה בראש הקובץ. */
const POST_ROTATION_REMEASURE_MS = 250;

/**
 * מחזיר את גובה/היסט האזור הנראה, או null כשלא פעיל (כדי לא למדוד ולהאזין לחינם).
 * @param enabled כבה כשאין צורך — ההאזנה נרשמת רק כשהיא באמת נדרשת.
 */
export function useVisibleViewport(enabled: boolean): VisibleViewport | null {
  const [viewport, setViewport] = useState<VisibleViewport | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const visual = window.visualViewport;
    const measure = (): void => {
      setViewport({
        height: visual ? visual.height : window.innerHeight,
        offsetTop: visual ? visual.offsetTop : 0,
      });
    };

    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const measureAfterLayout = (): void => {
      rafId = requestAnimationFrame(measure);
      timeoutId = setTimeout(measure, POST_ROTATION_REMEASURE_MS);
    };

    // ⚠️ המדידה הראשונה ב-rAF ולא סינכרונית: setState בגוף effect מייצר רינדור מדורג
    // (react-hooks כלל אמיתי, לא סגנון). הפריים הבודד שלפניה מכוסה ע"י h-[100dvh] ב-CSS,
    // אז אין הבהוב — פשוט ערך-גיבוי סביר עד שהמדידה האמיתית מגיעה.
    measureAfterLayout();
    visual?.addEventListener('resize', measure);
    // ⚠️ גם scroll: כשסרגל-הכתובת נכנס/יוצא, ה-offsetTop משתנה בלי אירוע resize.
    visual?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measureAfterLayout);

    return () => {
      visual?.removeEventListener('resize', measure);
      visual?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measureAfterLayout);
      cancelAnimationFrame(rafId);
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [enabled]);

  // ⚠️ מסננים כאן ולא מאפסים ב-effect: איפוס state בגוף effect הוא בדיוק אותו רינדור-מדורג.
  // הערך הישן נשאר ב-state כשמכובה, אבל אף אחד לא רואה אותו — והוא נמדד מחדש בהפעלה הבאה.
  return enabled ? viewport : null;
}
