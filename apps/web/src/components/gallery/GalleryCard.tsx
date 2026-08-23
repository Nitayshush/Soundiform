/**
 * @file        GalleryCard.tsx
 * @description ⭐ 2026-08-22 (§11 גלריה): כרטיס-יצירה משותף — גלריה ציבורית, "My Gallery",
 *              וגריד היצירות בפרופיל הציבורי כולם משתמשים באותו כרטיס (היו שלושה כרטיסים
 *              כמעט-זהים, כפולים). poster (thumbnail) במקום ניגון וידאו חי בגריד גלילה —
 *              זול יותר וטעינה מהירה, השמעה מלאה שמורה לעמוד השיתוף עצמו (/s/[slug]).
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FollowButton } from '@/components/account/FollowButton';

export interface GalleryCardCreator {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface GalleryCardProps {
  slug: string;
  posterUrl: string | null;
  genreId: string;
  viewCount: number;
  likeCount?: number;
  creator?: GalleryCardCreator | null;
  /** רק כשהצופה מחובר ואינו היוצר עצמו — ראה קריאה בכל עמוד. */
  showFollowButton?: boolean;
  isFollowingCreator?: boolean;
  /** סלוט לפקדי-בעלים (DownloadLinks וכו') — מוצג רק כשבאמת רלוונטי (הגריד של עצמך). */
  children?: ReactNode;
}

export function GalleryCard({
  slug,
  posterUrl,
  genreId,
  viewCount,
  likeCount,
  creator,
  showFollowButton = false,
  isFollowingCreator = false,
  children,
}: GalleryCardProps) {
  return (
    <Card className="overflow-hidden border-border/60 transition-colors hover:border-primary/50 hover:bg-card/80">
      <Link href={`/s/${slug}`} className="block">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- poster is a signed R2 redirect URL, not next/image-friendly
          <img src={posterUrl} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-muted/40 text-xs text-muted-foreground">
            No preview
          </div>
        )}
      </Link>
      <div className="flex flex-col gap-2 p-4">
        <Link href={`/s/${slug}`} className="block">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">{genreId}</Badge>
            <span className="text-xs text-muted-foreground">
              {viewCount} views{likeCount !== undefined ? ` · ${String(likeCount)} likes` : ''}
            </span>
          </div>
        </Link>
        {creator && (
          <div className="flex items-center justify-between gap-2">
            {(() => {
              const label = creator.displayName ?? `@${creator.username ?? 'unknown'}`;
              const avatar = (
                // eslint-disable-next-line @next/next/no-img-element -- avatar host varies (signed-redirect route or external OAuth CDN)
                <img
                  src={creator.avatarUrl ?? '/icon.svg'}
                  alt=""
                  className="size-6 shrink-0 rounded-full border border-border/60 object-cover"
                />
              );
              // ⭐ username הוא nullable (המשתמש עדיין לא הגדיר אחד) — בלי username אין /u/[username]
              // תקין לקישור אליו, אז מציגים טקסט רגיל במקום Link שקושר לעמוד לא-קיים.
              return creator.username ? (
                <Link
                  href={`/u/${creator.username}`}
                  className="flex min-w-0 items-center gap-2 text-sm hover:underline"
                >
                  {avatar}
                  <span className="truncate text-muted-foreground">{label}</span>
                </Link>
              ) : (
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  {avatar}
                  <span className="truncate text-muted-foreground">{label}</span>
                </span>
              );
            })()}
            {showFollowButton && (
              <FollowButton profileUserId={creator.id} initialIsFollowing={isFollowingCreator} />
            )}
          </div>
        )}
        {children}
      </div>
    </Card>
  );
}
