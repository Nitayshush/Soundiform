/**
 * @file        page.tsx
 * @description ⭐ פיד — יצירות ציבוריות של משתמשים שאני עוקב אחריהם, לפי חדשות. פיד בתוך
 *              האתר בלבד (§11, לא אימייל/push בסיבוב הזה).
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, inArray } from 'drizzle-orm';
import { follows, getDb, projects, renders, shares, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/feed');
  }

  const db = getDb();
  const following = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, user.id));
  const followingIds = following.map((row) => row.followingId);

  const items =
    followingIds.length === 0
      ? []
      : await db
          .select({
            slug: shares.slug,
            genreId: renders.genreId,
            createdAt: shares.createdAt,
            creatorUsername: users.username,
            creatorDisplayName: users.displayName,
          })
          .from(shares)
          .innerJoin(renders, eq(shares.renderId, renders.id))
          .innerJoin(projects, eq(renders.projectId, projects.id))
          .innerJoin(users, eq(projects.userId, users.id))
          .where(inArray(projects.userId, followingIds))
          .orderBy(desc(shares.createdAt))
          .limit(50);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight">Feed</h1>
        {followingIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re not following anyone yet — visit a creator&apos;s profile to follow them.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No public creations from people you follow yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.slug}>
                <Link href={`/s/${item.slug}`}>
                  <Card className="border-border/60 p-4 transition-colors hover:border-primary/50 hover:bg-card/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        {item.creatorDisplayName ??
                          (item.creatorUsername ? `@${item.creatorUsername}` : 'Someone')}
                      </span>
                      <Badge variant="secondary">{item.genreId}</Badge>
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
