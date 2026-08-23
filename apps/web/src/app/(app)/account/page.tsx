/**
 * @file        page.tsx
 * @description דף חשבון — פרטי משתמש, מכסות, מנוי (ראה PROJECT.md §11 Sprint 7).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * Server Component — קורא ישירות מה-session (Supabase server client) ומ-Drizzle
 * (getDb, עוקף RLS בכוונה — השרת הוא הצד המורשה, ראה api/projects/route.ts).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import {
  follows,
  getDb,
  getMonthlyCreationCount,
  getSavedProjectCount,
  projects,
  resolveEffectivePlan,
  users,
} from '@soundiform/db';
import { FREE_MONTHLY_CREATIONS, FREE_SAVED_PROJECTS } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileEditForm } from '@/components/account/ProfileEditForm';

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/account');
  }

  const db = getDb();
  const [userRow] = await db.select().from(users).where(eq(users.id, user.id));
  // ⭐ 2026-08-22: resolveEffectivePlan (לא users.plan ישיר) — כדי שהעמוד הזה לא יציג plan
  // מיושן לרגע אחרי שמענק-גישה זמני מהאדמין פג (ראה planOverride.ts).
  const { plan } = await resolveEffectivePlan(user.id);

  const [savedCount, monthlyCreations, myProjects, [followingCountRow], [followerCountRow]] =
    await Promise.all([
      getSavedProjectCount(user.id),
      getMonthlyCreationCount(user.id),
      db
        .select()
        .from(projects)
        .where(and(eq(projects.userId, user.id), isNull(projects.deletedAt)))
        .orderBy(desc(projects.createdAt)),
      db.select({ total: count() }).from(follows).where(eq(follows.followerId, user.id)),
      db.select({ total: count() }).from(follows).where(eq(follows.followingId, user.id)),
    ]);
  const followingCount = followingCountRow?.total ?? 0;
  const followerCount = followerCountRow?.total ?? 0;

  const isFree = plan === 'free';

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>

        <ProfileEditForm
          initialUsername={userRow?.username ?? null}
          initialDisplayName={userRow?.displayName ?? null}
          initialAvatarUrl={userRow?.avatarUrl ?? null}
        />

        <Card className="border-border/60">
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p>{userRow?.email ?? user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="capitalize">{plan}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <Link href="/account/following" className="hover:underline">
                Following ({followingCount})
              </Link>
              <Link href="/account/followers" className="hover:underline">
                Followers ({followerCount})
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Quotas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>
              Creations this month: {monthlyCreations}
              {isFree ? ` / ${String(FREE_MONTHLY_CREATIONS)}` : ' (unlimited)'}
            </p>
            <p>
              Saved: {savedCount}
              {isFree ? ` / ${String(FREE_SAVED_PROJECTS)}` : ' (unlimited)'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Saved creations</CardTitle>
          </CardHeader>
          <CardContent>
            {myProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved creations yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {myProjects.map((project) => (
                  <li
                    key={project.id}
                    className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    {project.title ?? project.shapeHash.slice(0, 12)} —{' '}
                    {new Date(project.createdAt).toLocaleDateString('en-US')}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
