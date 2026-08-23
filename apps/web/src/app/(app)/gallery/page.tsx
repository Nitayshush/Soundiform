/**
 * @file        page.tsx
 * @description גלריה — יצירות ציבוריות/פופולריות לפי סגנון (ראה PROJECT.md §11 Sprint 8).
 *
 * ⭐ 2026-08-22: כרטיסים משתמשים ב-GalleryCard המשותף (poster thumbnail + ייחוס יוצר עם
 * קישור לפרופיל — "הצגת הכי-הרבה-צפיות עם שם היוצר" מ-§11 גלריה). isFollowingCreator נבדק
 * per-creator (לא רק per-row) כדי לא לשלוח שאילתת follows כפולה לאותו יוצר בכמה כרטיסים.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { follows, getDb, likes, renders, shares, users, projects } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { GalleryCard } from '@/components/gallery/GalleryCard';
import { ShareButtons } from '@/components/share/ShareButtons';
import { getSiteUrl } from '@/lib/siteUrl';

interface GalleryPageProps {
  searchParams: Promise<{ genre?: string }>;
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const { genre } = await searchParams;
  const db = getDb();

  const conditions = genre
    ? and(eq(shares.visibility, 'public'), eq(renders.genreId, genre))
    : eq(shares.visibility, 'public');

  const rows = await db
    .select({
      slug: shares.slug,
      viewCount: shares.viewCount,
      genreId: renders.genreId,
      posterKey: renders.posterKey,
      renderId: renders.id,
      creatorId: users.id,
      creatorUsername: users.username,
      creatorDisplayName: users.displayName,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .innerJoin(users, eq(projects.userId, users.id))
    .where(conditions)
    .orderBy(desc(shares.viewCount))
    .limit(50);

  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const creatorIds = Array.from(new Set(rows.map((row) => row.creatorId)));
  const renderIds = rows.map((row) => row.renderId);
  const [followingIds, likeCountRows] = await Promise.all([
    sessionUser
      ? db
          .select({ followingId: follows.followingId })
          .from(follows)
          .where(
            and(eq(follows.followerId, sessionUser.id), inArray(follows.followingId, creatorIds)),
          )
          .then((followingRows) => new Set(followingRows.map((row) => row.followingId)))
      : Promise.resolve(new Set<string>()),
    renderIds.length > 0
      ? db
          .select({ renderId: likes.renderId, total: count() })
          .from(likes)
          .where(inArray(likes.renderId, renderIds))
          .groupBy(likes.renderId)
      : Promise.resolve([]),
  ]);
  const likeCountByRenderId = new Map(likeCountRows.map((row) => [row.renderId, row.total]));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight">Gallery</h1>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public creations yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {rows.map((row) => (
              <li key={row.slug}>
                <GalleryCard
                  slug={row.slug}
                  posterUrl={
                    row.posterKey
                      ? `/api/renders/${row.renderId}/download?type=poster&inline=1`
                      : null
                  }
                  genreId={row.genreId}
                  viewCount={row.viewCount}
                  likeCount={likeCountByRenderId.get(row.renderId) ?? 0}
                  creator={{
                    id: row.creatorId,
                    username: row.creatorUsername,
                    displayName: row.creatorDisplayName,
                    avatarUrl: row.creatorAvatarUrl,
                  }}
                  showFollowButton={Boolean(sessionUser) && sessionUser?.id !== row.creatorId}
                  isFollowingCreator={followingIds.has(row.creatorId)}
                >
                  <ShareButtons url={`${getSiteUrl()}/s/${row.slug}`} />
                </GalleryCard>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
