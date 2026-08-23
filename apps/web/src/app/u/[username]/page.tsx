/**
 * @file        page.tsx
 * @description ⭐ פרופיל ציבורי — "רשת התוכן" (§11): גריד היצירות הציבוריות של יוצר, לפי
 *              username. Server Component; getDb() עוקף RLS בכוונה (השרת הוא הצד המורשה,
 *              ראה api/projects/route.ts) — לכן קריטי לבחור explicit רק עמודות בטוחות
 *              לפרסום (username/display_name/avatar_url), לעולם לא email (ראה users.ts).
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { follows, getDb, likes, projects, renders, shares, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { FollowButton } from '@/components/account/FollowButton';
import { DownloadLinks } from '@/components/share/DownloadLinks';
import { GalleryCard } from '@/components/gallery/GalleryCard';

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const db = getDb();

  const [profile] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      plan: users.plan,
    })
    .from(users)
    .where(eq(users.username, username));

  if (!profile) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const isOwnProfile = sessionUser?.id === profile.id;

  const [creations, [followerRow], isFollowingRow] = await Promise.all([
    db
      .select({
        slug: shares.slug,
        viewCount: shares.viewCount,
        genreId: renders.genreId,
        createdAt: shares.createdAt,
        renderId: renders.id,
        posterKey: renders.posterKey,
        videoKey: renders.videoKey,
        stemKeys: renders.stemKeys,
      })
      .from(shares)
      .innerJoin(renders, eq(shares.renderId, renders.id))
      .innerJoin(projects, eq(renders.projectId, projects.id))
      .where(and(eq(projects.userId, profile.id), eq(shares.visibility, 'public')))
      .orderBy(desc(shares.createdAt)),
    db.select({ total: count() }).from(follows).where(eq(follows.followingId, profile.id)),
    sessionUser
      ? db
          .select({ followerId: follows.followerId })
          .from(follows)
          .where(and(eq(follows.followerId, sessionUser.id), eq(follows.followingId, profile.id)))
      : Promise.resolve([]),
  ]);
  const followerCount = followerRow?.total ?? 0;
  const isFollowing = isFollowingRow.length > 0;

  const renderIds = creations.map((creation) => creation.renderId);
  const likeCountRows =
    renderIds.length > 0
      ? await db
          .select({ renderId: likes.renderId, total: count() })
          .from(likes)
          .where(inArray(likes.renderId, renderIds))
          .groupBy(likes.renderId)
      : [];
  const likeCountByRenderId = new Map(likeCountRows.map((row) => [row.renderId, row.total]));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar host varies (our signed-redirect route or an external OAuth CDN), not next/image-friendly */}
          <img
            src={profile.avatarUrl ?? '/icon.svg'}
            alt=""
            className="size-16 rounded-full border border-border/60 object-cover"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {profile.displayName ?? `@${profile.username}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{profile.username} · {creations.length}{' '}
              {creations.length === 1 ? 'creation' : 'creations'} · {followerCount}{' '}
              {followerCount === 1 ? 'follower' : 'followers'}
            </p>
          </div>
          {isOwnProfile ? (
            <Button variant="outline" nativeButton={false} render={<Link href="/account" />}>
              Edit profile
            </Button>
          ) : (
            <FollowButton profileUserId={profile.id} initialIsFollowing={isFollowing} />
          )}
        </div>

        {creations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public creations yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {creations.map((creation) => (
              <li key={creation.slug}>
                <GalleryCard
                  slug={creation.slug}
                  posterUrl={
                    creation.posterKey
                      ? `/api/renders/${creation.renderId}/download?type=poster&inline=1`
                      : null
                  }
                  genreId={creation.genreId}
                  viewCount={creation.viewCount}
                  likeCount={likeCountByRenderId.get(creation.renderId) ?? 0}
                >
                  {isOwnProfile && (
                    <DownloadLinks
                      renderId={creation.renderId}
                      hasVideo={Boolean(creation.videoKey)}
                      showMidiAndStems={profile.plan === 'studio'}
                      stemRoles={Object.keys(creation.stemKeys ?? {})}
                    />
                  )}
                </GalleryCard>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
