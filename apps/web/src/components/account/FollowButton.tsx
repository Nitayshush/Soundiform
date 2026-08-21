/**
 * @file        FollowButton.tsx
 * @description ⭐ כפתור עקוב/בטל-מעקב בדף פרופיל ציבורי — POST/DELETE ל-api/follows.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface FollowButtonProps {
  profileUserId: string;
  initialIsFollowing: boolean;
}

export function FollowButton({ profileUserId, initialIsFollowing }: FollowButtonProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, setIsPending] = useState(false);

  const toggle = async (): Promise<void> => {
    setIsPending(true);
    try {
      const response = await fetch('/api/follows', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: profileUserId }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (response.ok) {
        setIsFollowing(!isFollowing);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={isFollowing ? 'secondary' : 'default'}
      disabled={isPending}
      onClick={() => void toggle()}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}
