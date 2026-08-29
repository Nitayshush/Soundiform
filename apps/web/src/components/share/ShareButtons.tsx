/**
 * @file        ShareButtons.tsx
 * @description ⭐ שיתוף לרשתות חברתיות — קישורי share-intent פשוטים (בלי OAuth/תלות חדשה),
 *              בדף השיתוף ובכרטיסי הגלריה (§11, §9 "מנוע הצמיחה").
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⭐ 2026-08-28 (לפי בקשה חיה: "שיתוף כללי של המכשיר", לצד WhatsApp/X/Facebook הקיימים):
 * כפתור Share רביעי מבוסס Web Share API (navigator.share) — פותח את תפריט-השיתוף האמיתי
 * של המכשיר (כל אפליקציה מותקנת, לא רק 3 הרשתות הקבועות למטה). זמין בעיקר במובייל; רוב
 * דפדפני-דסקטופ לא תומכים, אז הכפתור נעלם אוטומטית שם (לא נשבר/מוצג-מבוטל). הבדיקה
 * חייבת לקרות ב-useEffect (client, אחרי mount) — navigator לא קיים ב-SSR, ובדיקה סינכרונית
 * ברינדור הייתה יוצרת hydration mismatch.
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ShareButtonsProps {
  url: string;
  title?: string;
}

export function ShareButtons({
  url,
  title = 'Check out this creation on Soundiform',
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  useEffect(() => {
    // ⚠️ סנכרון עם API חיצוני (navigator.share, לא קיים ב-SSR) — לא state שנגזר-מ-props/state
    // אחר, ולכן לא ניתן לחשב אותו כ-lazy initializer בלי ליצור hydration mismatch (השרת תמיד
    // "false", הלקוח היה מחשב את הערך האמיתי כבר ברינדור הראשון — פער מול ה-HTML מהשרת).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNativeShare(typeof navigator.share === 'function');
  }, []);

  const copyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async (): Promise<void> => {
    try {
      await navigator.share({ title, url });
    } catch {
      // ⚠️ AbortError כשהמשתמש סוגר את גליון-השיתוף בעצמו — לא שגיאה אמיתית, בלי הודעה.
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canNativeShare && (
        <Button type="button" variant="outline" size="sm" onClick={() => void shareNative()}>
          Share
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <a
            href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        X / Twitter
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        Facebook
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <a
            href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        WhatsApp
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
        {copied ? 'Copied ✓' : 'Copy link'}
      </Button>
    </div>
  );
}
