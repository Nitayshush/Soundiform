/**
 * @file        GoogleAnalytics.tsx
 * @description ⭐ 2026-09-06: gtag.js — נטען רק אחרי שהמשתמש לחץ Accept בבאנר (ראה
 *              CookieConsentBanner.tsx/cookieConsentStore.ts) **וגם** יש measurement ID
 *              מוגדר. שני התנאים ביחד: לא נטען כלום לפני הסכמה, ולא נטען כלום בסביבה
 *              בלי NEXT_PUBLIC_GA_MEASUREMENT_ID (למשל dev לא-מוגדר לא מדווח בטעות ל-GA
 *              האמיתי).
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ strategy="afterInteractive" (לא beforeInteractive) — בניגוד לסקריפט ה-AudioContext
 * ב-layout.tsx, אין כאן שום תלות בסדר-טעינה קריטי; afterInteractive הוא הדפוס המתועד של
 * Next.js בדיוק בשביל אנליטיקס (לא חוסם רינדור ראשוני).
 */

'use client';

import Script from 'next/script';
import { useCookieConsentStore } from '@/stores/cookieConsentStore';

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  const choice = useCookieConsentStore((state) => state.choice);

  if (choice !== 'accepted' || !MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
