/**
 * @file        useFitAspectRatio.ts
 * @description ⭐ 2026-08-24 (מובייל): מודד את הקונטיינר (ResizeObserver — אותה טכניקה כמו
 *              DrawingCanvas.tsx's backing-store sizing) ומחשב את גודל-הפיקסלים המדויק של
 *              קופסה שומרת-יחס שנכנסת בו, לפי איזה ציר בפועל מגביל (רוחב או גובה) — CSS
 *              טהור (aspect-ratio + max-width/max-height) לא פותר את זה נכון כששני הצירים
 *              יכולים להיות המגביל (למשל לרוחב מסך נייד לעומת לרוחב במצב landscape).
 * @author      Soundiform
 * @created     2026-08-24
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ יחס-הצורה עצמו משתנה לפי רוחב הקונטיינר הנמדד (לא media query נפרד) — ריבועי מתחת
 * ל-MOBILE_BREAKPOINT_PX (640, תואם Tailwind's `sm`), 16:9 מעליו. אותה מדידה אחת משרתת גם
 * את בחירת היחס וגם את חישוב הגודל בפועל.
 *
 * ⚠️ באג אמיתי שנתפס בבדיקה חיה: getBoundingClientRect() על הקונטיינר מחזיר border-box —
 * *כולל* ה-padding שלו (למשל p-4 של הקונטיינר במקום שהוא נצרך). בלי להחסיר את ה-padding,
 * "השטח הפנוי" מנופח, והקופסה יוצאת גדולה/לא-נכונה (במיוחד ב-landscape, שם הגובה הוא
 * הציר המגביל וההבדל בולט). מחסירים padding מחושב (getComputedStyle) לפני החישוב.
 *
 * ⚠️ באג שני שנתפס באותה בדיקה: maxWidthPx (למשל תואם max-w-5xl) *חייב* להיכנס לחישוב כאן,
 * לא להישאר כ-class Tailwind על האלמנט הממוזג — ברגע שיש style width/height מפורש (מהחישוב
 * הזה), max-width מה-CSS class עדיין חותך את הרוחב (כי max-width הוא hard cap בלי קשר למקור
 * ה-width), אבל הגובה שנקבע ב-style *לא* מתעדכן בהתאם — יוצא box לא-16:9 עם רוחב חתוך וגובה
 * לא-תואם. הפתרון: הקאפ נכנס לחישוב פה, וה-className לא מכיל עוד max-w-* מתחרה.
 */

import { useEffect, useState, type RefObject } from 'react';

const MOBILE_BREAKPOINT_PX = 640;
const MOBILE_ASPECT_RATIO = 1;
const DESKTOP_ASPECT_RATIO = 16 / 9;

export interface FittedSize {
  width: number;
  height: number;
}

export function useFitAspectRatio(
  containerRef: RefObject<HTMLElement | null>,
  maxWidthPx: number = Infinity,
): FittedSize | null {
  const [size, setSize] = useState<FittedSize | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleResize = (): void => {
      const rect = container.getBoundingClientRect();
      const styles = getComputedStyle(container);
      const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const availableWidth = rect.width - paddingX;
      const availableHeight = rect.height - paddingY;
      if (availableWidth <= 0 || availableHeight <= 0) {
        return;
      }
      const aspectRatio =
        availableWidth < MOBILE_BREAKPOINT_PX ? MOBILE_ASPECT_RATIO : DESKTOP_ASPECT_RATIO;
      const width = Math.min(availableWidth, availableHeight * aspectRatio, maxWidthPx);
      const height = width / aspectRatio;
      setSize({ width, height });
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    handleResize();

    return () => {
      observer.disconnect();
    };
  }, [containerRef, maxWidthPx]);

  return size;
}
