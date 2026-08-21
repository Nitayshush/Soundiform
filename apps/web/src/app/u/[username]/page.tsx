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
import { and, desc, eq } from 'drizzle-orm';
import { getDb, projects, renders, shares, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

  const creations = await db
    .select({
      slug: shares.slug,
      viewCount: shares.viewCount,
      genreId: renders.genreId,
      createdAt: shares.createdAt,
    })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(and(eq(projects.userId, profile.id), eq(shares.visibility, 'public')))
    .orderBy(desc(shares.createdAt));

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
              {creations.length === 1 ? 'creation' : 'creations'}
            </p>
          </div>
          {isOwnProfile && (
            <Button variant="outline" nativeButton={false} render={<Link href="/account" />}>
              Edit profile
            </Button>
          )}
        </div>

        {creations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public creations yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {creations.map((creation) => (
              <li key={creation.slug}>
                <Link href={`/s/${creation.slug}`}>
                  <Card className="border-border/60 p-4 transition-colors hover:border-primary/50 hover:bg-card/80">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{creation.genreId}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {creation.viewCount} views
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
