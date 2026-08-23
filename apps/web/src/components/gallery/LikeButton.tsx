/**
 * @file        LikeButton.tsx
 * @description ⭐ 2026-08-22 (§11 גלריה): כפתור לייק/ביטול-לייק — POST/DELETE ל-api/likes.
 *              תבנית זהה ל-FollowButton.tsx (אותה סיבה: redirect ל-login ב-401, toggle
 *              אופטימי).
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface LikeButtonProps {
  renderId: string;
  initialIsLiked: boolean;
  initialLikeCount: number;
}

export function LikeButton({ renderId, initialIsLiked, initialLikeCount }: LikeButtonProps) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isPending, setIsPending] = useState(false);

  const toggle = async (): Promise<void> => {
    setIsPending(true);
    try {
      const response = await fetch('/api/likes', {
        method: isLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renderId }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (response.ok) {
        setIsLiked(!isLiked);
        setLikeCount((count) => count + (isLiked ? -1 : 1));
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={isLiked ? 'secondary' : 'outline'}
      size="sm"
      disabled={isPending}
      onClick={() => void toggle()}
    >
      {isLiked ? '♥' : '♡'} {likeCount}
    </Button>
  );
}
