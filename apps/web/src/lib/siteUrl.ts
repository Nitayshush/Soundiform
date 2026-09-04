/**
 * @file        siteUrl.ts
 * @description ⭐ כתובת בסיס מוחלטת של האתר — נחוצה ל-share-intent links (Twitter/Facebook/
 *              WhatsApp דורשים URL מוחלט, לא נתיב יחסי). ראה .env: NEXT_PUBLIC_APP_URL.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **זה fallback לרינדור-בשרת בלבד, לא מקור-האמת של קישורי שיתוף.** הבאג שדווח חי:
 * "מעתיק קישור מהגלריה באתר החי ומקבל קישור של סביבת הפיתוח". שלוש סיבות בלתי-תלויות שהופכות
 * כל קביעה מראש של הדומיין לשבירה, וכולן התקיימו כאן:
 *   1. `NEXT_PUBLIC_*` **נצרב לתוך ה-build** ולא נקרא בזמן ריצה — build בפרודקשן שרץ בלי
 *      הערך מקבע `localhost:3000` לתמיד, וגם תיקון המשתנה אחר-כך לא מרפא בלי build מחדש.
 *   2. ה-.env מצביע ל-`soundiform.com` בעוד הדומיין החי הוא `www.soundiform.com` — הקישור
 *      "עובד" אבל מוציא את המשתמש מהדומיין שהוא נמצא בו.
 *   3. deploy-preview של Vercel מקבל דומיין משלו שאף משתנה סביבה לא יודע עליו.
 * לכן `ShareButtons` בונה את הכתובת מ-`window.location.origin` — הדומיין שהמשתמש **באמת**
 * נמצא בו — ומשתמש בערך שמכאן רק לרינדור הראשון בשרת. אותה החלטה בדיוק כמו
 * `auth/callback/route.ts`, שלוקח `origin` מתוך הבקשה ולא ממשתנה סביבה.
 */

const DEFAULT_SITE_URL = 'http://localhost:3000';

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // ⚠️ משתני Vercel הם server-side (בלי NEXT_PUBLIC_) ולכן נקראים בזמן ריצה, לא בזמן build —
  // הם הרשת-ביטחון היחידה שעובדת גם כשה-build נצרב בלי הדומיין. PRODUCTION_URL הוא הדומיין
  // היציב של הפרויקט; VERCEL_URL הוא של ה-deployment הספציפי (נכון ל-preview).
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) {
    return `https://${vercelHost}`;
  }
  return DEFAULT_SITE_URL;
}
