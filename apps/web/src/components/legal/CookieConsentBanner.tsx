/**
 * @file        CookieConsentBanner.tsx
 * @description ⭐ 2026-09-06: באנר עוגיות בכניסה הראשונה — מוצג כל עוד choice===null
 *              (ראה cookieConsentStore.ts). Accept/Decline, לא רק אישור-קריאה יחיד: דחייה
 *              באמת מונעת טעינת Google Analytics (ראה GoogleAnalytics.tsx) — לא רק "מסתיר
 *              הודעה". מורכב מ-layout.tsx (שורש), אז מוצג בכל עמוד באתר.
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ choice מתחיל תמיד null גם ב-SSR/רינדור-ראשון (לפני ש-zustand/persist מספיק לקרוא
 * מ-localStorage) — כלומר הבאנר "מהבהב" לרגע גם למי שכבר החליט, בדיוק כמו כל store אחר
 * עם persist בקודבייס הזה (genreStore/shapeStore וכו'). זה פשרה מוכרת וקיימת, לא באג חדש.
 */

'use client';

import Link from 'next/link';
import { useCookieConsentStore } from '@/stores/cookieConsentStore';

export function CookieConsentBanner() {
  const choice = useCookieConsentStore((state) => state.choice);
  const setChoice = useCookieConsentStore((state) => state.setChoice);

  if (choice !== null) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-card/95 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies to keep you signed in and to understand how Soundiform is used. See our{' '}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setChoice('declined');
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => {
              setChoice('accepted');
            }}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/80"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
