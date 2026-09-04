/**
 * @file        page.tsx
 * @description ⭐ 2026-08-22 (§11 גלריה, item 4): "My Gallery" — כל היצירות ששמר המשתמש
 *              (shares בכל visibility, לא רק public — useDownload.ts יוצר share אוטומטית
 *              בכל הורדה, ברירת מחדל 'public', אז זו כבר כמעט הרשימה המלאה של מה שהמשתמש
 *              רינדר בפועל). ממוין לפי תאריך שמירה (לא views, כמו הגלריה הציבורית) — זה
 *              עמוד "מה שמרתי", לא "מה הכי פופולרי". אין ייחוס-יוצר (זו הגלריה של עצמו).
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-09-04 (מקצה שדרוגים — כפתור פרסום/הסתרה): נוסף PublishToggleButton לכל כרטיס —
 * ראה shares.ts להסבר על ערך ה-visibility החדש 'private'.
 */

import { redirect } from 'next/navigation';
import { count, desc, eq, inArray } from 'drizzle-orm';
import { getDb, likes, projects, renders, resolveEffectivePlan, shares } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { GalleryCard } from '@/components/gallery/GalleryCard';
import { DownloadLinks } from '@/components/share/DownloadLinks';
import { PublishToggleButton } from '@/components/gallery/PublishToggleButton';

export default async function MyGalleryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/account/gallery');
  }

  const db = getDb();
  const { plan } = await resolveEffectivePlan(user.id);

  const rows = await db
    .select({
      shareId: shares.id,
      slug: shares.slug,
      visibility: shares.visibility,
      viewCount: shares.viewCount,
      genreId: renders.genreId,
      posterKey: renders.posterKey,
      renderId: renders.id,
      videoKey: renders.videoKey,
      stemKeys: renders.stemKeys,
    })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(eq(projects.userId, user.id))
    .orderBy(desc(shares.createdAt));

  const renderIds = rows.map((row) => row.renderId);
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
        <h1 className="mb-8 text-3xl font-semibold tracking-tight">My Gallery</h1>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing saved yet — render a creation in the Studio to see it here.
          </p>
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
                >
                  <div className="flex items-center justify-between gap-2">
                    <DownloadLinks
                      renderId={row.renderId}
                      hasVideo={Boolean(row.videoKey)}
                      showMidiAndStems={plan === 'studio'}
                      stemRoles={Object.keys(row.stemKeys ?? {})}
                    />
                    <PublishToggleButton shareId={row.shareId} initialVisibility={row.visibility} />
                  </div>
                </GalleryCard>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
