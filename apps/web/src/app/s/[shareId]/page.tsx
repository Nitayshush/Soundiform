/**
 * @file        page.tsx
 * @description דף שיתוף ציבורי ליצירה בודדת (ראה PROJECT.md §11 Sprint 8, §9 מנוע הצמיחה).
 *
 * ⭐ 2026-08-22 (§11 גלריה): כשיש videoKey/posterKey, מוצג <video> אמיתי (הפריט הראשי
 * שאפשר לשתף/להוריד — כולל הציור המקורי, ראה frameRenderer.ts) במקום/בנוסף ל-SharePlayer
 * הישן (ניגון חי בדפדפן, בלי הצורה) — שנשאר fallback ל-renders ישנים בלי וידאו. ייחוס יוצר
 * (שם+קישור לפרופיל) נוסף כאן לראשונה.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * Server Component — RLS ציבורי על shares/remixes (public role) מרשה את זה גם ללא session,
 * אבל בפועל קוראים דרך Drizzle (עוקף RLS ממילא, ראה api/projects/route.ts להסבר).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, count, eq, sql } from 'drizzle-orm';
import { follows, getDb, likes, projects, renders, shares, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { RemixButton } from '@/components/share/RemixButton';
import { SharePlayer } from '@/components/share/SharePlayer';
import { ShareButtons } from '@/components/share/ShareButtons';
import { DownloadLinks } from '@/components/share/DownloadLinks';
import { FollowButton } from '@/components/account/FollowButton';
import { LikeButton } from '@/components/gallery/LikeButton';
import { CommentSection } from '@/components/gallery/CommentSection';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { getSiteUrl } from '@/lib/siteUrl';

interface SharePageProps {
  params: Promise<{ shareId: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { shareId } = await params;
  const db = getDb();

  const [row] = await db
    .select({
      shareRowId: shares.id,
      visibility: shares.visibility,
      renderId: renders.id,
      score: renders.score,
      genreId: renders.genreId,
      videoKey: renders.videoKey,
      posterKey: renders.posterKey,
      shapeData: projects.shapeData,
      creationSettings: projects.creationSettings,
      creatorId: users.id,
      creatorUsername: users.username,
      creatorDisplayName: users.displayName,
    })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .innerJoin(users, eq(projects.userId, users.id))
    .where(eq(shares.slug, shareId));

  if (!row) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const isOwnCreation = sessionUser?.id === row.creatorId;

  // ⚠️ 2026-09-04: 'private' חסום גם בקישור הישיר, לא רק בגלריה הציבורית (אחרת 'private'
  // היה רק "לא רשום", כמו unlisted, ולא היה מגן בכלל — ראה shares.ts). הבדיקה חייבת לקרות
  // **לפני** הגדלת viewCount, אחרת גם צפיות חסומות היו נספרות.
  if (row.visibility === 'private' && !isOwnCreation) {
    notFound();
  }

  await db
    .update(shares)
    .set({ viewCount: sql`${shares.viewCount} + 1` })
    .where(eq(shares.id, row.shareRowId));
  const [isFollowingCreator, [likeCountRow], isLikedRows] = await Promise.all([
    sessionUser
      ? db
          .select({ followerId: follows.followerId })
          .from(follows)
          .where(
            and(eq(follows.followerId, sessionUser.id), eq(follows.followingId, row.creatorId)),
          )
          .then((rows) => rows.length > 0)
      : Promise.resolve(false),
    db.select({ total: count() }).from(likes).where(eq(likes.renderId, row.renderId)),
    sessionUser
      ? db
          .select({ userId: likes.userId })
          .from(likes)
          .where(and(eq(likes.userId, sessionUser.id), eq(likes.renderId, row.renderId)))
      : Promise.resolve([]),
  ]);
  const likeCount = likeCountRow?.total ?? 0;
  const isLiked = isLikedRows.length > 0;

  const hasVideo = Boolean(row.videoKey);
  const videoUrl = hasVideo ? `/api/renders/${row.renderId}/download?type=video&inline=1` : null;
  const posterUrl = row.posterKey
    ? `/api/renders/${row.renderId}/download?type=poster&inline=1`
    : undefined;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-1 text-3xl font-semibold tracking-tight">Shared creation</h1>
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            by{' '}
            {row.creatorUsername ? (
              <Link href={`/u/${row.creatorUsername}`} className="hover:underline">
                {row.creatorDisplayName ?? `@${row.creatorUsername}`}
              </Link>
            ) : (
              (row.creatorDisplayName ?? 'a Soundiform creator')
            )}
          </p>
          <div className="flex items-center gap-2">
            <LikeButton
              renderId={row.renderId}
              initialIsLiked={isLiked}
              initialLikeCount={likeCount}
            />
            {!isOwnCreation && (
              <FollowButton profileUserId={row.creatorId} initialIsFollowing={isFollowingCreator} />
            )}
          </div>
        </div>
        <Card className="border-border/60 p-6">
          <CardContent className="flex flex-col gap-6 px-0">
            {videoUrl ? (
              <video controls poster={posterUrl} src={videoUrl} className="w-full rounded-lg" />
            ) : (
              <SharePlayer score={row.score} genreId={row.genreId} />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <RemixButton
                renderId={row.renderId}
                paths={row.shapeData.paths}
                genreId={row.genreId}
                creationSettings={row.creationSettings}
              />
              <DownloadLinks renderId={row.renderId} hasVideo={hasVideo} />
            </div>
            <ShareButtons path={`/s/${shareId}`} fallbackOrigin={getSiteUrl()} />
          </CardContent>
        </Card>
        <div className="mt-6">
          <CommentSection renderId={row.renderId} />
        </div>
      </main>
    </>
  );
}
