/**
 * @file        ShareButtons.tsx
 * @description ⭐ שיתוף לרשתות חברתיות — קישורי share-intent פשוטים (בלי OAuth/תלות חדשה),
 *              בדף השיתוף ובכרטיסי הגלריה (§11, §9 "מנוע הצמיחה").
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useState } from 'react';
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
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const copyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
