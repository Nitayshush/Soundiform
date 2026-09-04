/**
 * @file        PublishToggleButton.tsx
 * @description ⭐ 2026-09-04 (מקצה שדרוגים): הצג/הסתר יצירה מהגלריה הציבורית, מתוך My Gallery.
 *              PATCH /api/shares/[shareId]. תבנית זהה ל-LikeButton.tsx (toggle אופטימי, 401
 *              → login).
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { ShareVisibility } from '@soundiform/db';

export interface PublishToggleButtonProps {
  shareId: string;
  initialVisibility: ShareVisibility;
}

export function PublishToggleButton({ shareId, initialVisibility }: PublishToggleButtonProps) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(initialVisibility);
  const [isPending, setIsPending] = useState(false);
  const isPublic = visibility === 'public';

  const toggle = async (): Promise<void> => {
    const nextVisibility = isPublic ? 'private' : 'public';
    setIsPending(true);
    try {
      const response = await fetch(`/api/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: nextVisibility }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (response.ok) {
        setVisibility(nextVisibility);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={isPublic ? 'secondary' : 'outline'}
      size="sm"
      disabled={isPending}
      onClick={() => void toggle()}
      title={isPublic ? 'Visible in the public gallery' : 'Hidden from the public gallery'}
    >
      {isPublic ? '🌐 Public' : '🔒 Private'}
    </Button>
  );
}
