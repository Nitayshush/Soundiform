/**
 * @file        page.tsx
 * @description ⭐ 2026-08-22 (§11 גלריה, item 7 — "מנגנון מעקב פעיל"): רשימת מי שהמשתמש
 *              עוקב אחריו, עם קישור לפרופיל של כל אחד (שכבר מציג את היצירות שלו — ראה
 *              u/[username]/page.tsx) וכפתור ביטול-מעקב ישיר. לפני זה היה קיים רק מספר
 *              עוקבים בפרופיל הציבורי, בלי רשימה בפועל.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { follows, getDb, users } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { FollowButton } from '@/components/account/FollowButton';
import Link from 'next/link';

export default async function FollowingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/account/following');
  }

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(eq(follows.followerId, user.id));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight">Following</h1>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re not following anyone yet — visit a profile to follow them.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Card className="flex items-center justify-between gap-3 border-border/60 p-3">
                  <Link
                    href={row.username ? `/u/${row.username}` : '#'}
                    className="flex min-w-0 items-center gap-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- avatar host varies (signed-redirect route or external OAuth CDN) */}
                    <img
                      src={row.avatarUrl ?? '/icon.svg'}
                      alt=""
                      className="size-10 shrink-0 rounded-full border border-border/60 object-cover"
                    />
                    <span className="truncate text-sm">
                      {row.displayName ?? `@${row.username ?? 'unknown'}`}
                    </span>
                  </Link>
                  <FollowButton profileUserId={row.id} initialIsFollowing={true} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
