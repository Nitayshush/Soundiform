/**
 * @file        robots.ts
 * @description ⭐ 2026-09-12: פותח את האתר למנועי-חיפוש (Google Search Console חובר) —
 *              MetadataRoute.Robots הילידי של Next.js, בלי חבילה נוספת. מרשה את המשטח
 *              הציבורי (עמודי שיווק, גלריה, דפי שיתוף/פרופיל); חוסם כל דבר תלוי-חשבון
 *              או פנימי, שממילא לא מציג תוכן ייחודי-לכל-URL לצופה לא-מחובר.
 * @author      Soundiform
 * @created     2026-09-12
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ 2026-09-14 (נתפס בבדיקה חיה בפרודקשן — אותו באג כמו sitemap.ts): בלי API דינמי,
 * Next.js פרש את זה כסטטי ורינדר פעם אחת בזמן ה-build — getSiteUrl() קפא על כתובת-fallback
 * (localhost). force-dynamic מבטיח שהכתובת נקבעת ב-runtime האמיתי בכל בקשה, כמו sitemap.ts.
 */

import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/gallery', '/pricing', '/terms', '/s/', '/u/'],
      // ⚠️ /feed, /account, /studio כולם דורשים session (redirect ל-/login) — אין להם תוכן
      // ציבורי לאנדקס. /api חסום כי אלו נתיבי-נתונים, לא דפים.
      disallow: ['/studio', '/account', '/feed', '/admin', '/api/', '/login', '/auth/'],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
