/**
 * @file        page.tsx
 * @description דף חשבון — פרטי משתמש, מכסות, מנוי (ראה PROJECT.md §11 Sprint 7).
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * Server Component — קורא ישירות מה-session (Supabase server client) ומ-Drizzle
 * (getDb, עוקף RLS בכוונה — השרת הוא הצד המורשה, ראה api/projects/route.ts).
 */

import { redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  getDb,
  getMonthlyCreationCount,
  getSavedProjectCount,
  projects,
  users,
} from '@shape-sound/db';
import { FREE_MONTHLY_CREATIONS, FREE_SAVED_PROJECTS } from '@shape-sound/db';
import { createClient } from '@/lib/supabase/server';

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
  const plan = userRow?.plan ?? 'free';

  const [savedCount, monthlyCreations, myProjects] = await Promise.all([
    getSavedProjectCount(user.id),
    getMonthlyCreationCount(user.id),
    db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, user.id), isNull(projects.deletedAt)))
      .orderBy(desc(projects.createdAt)),
  ]);

  const isFree = plan === 'free';

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">חשבון</h1>

      <section className="mb-6 rounded border p-4">
        <p className="text-sm text-muted-foreground">אימייל</p>
        <p className="mb-3">{userRow?.email ?? user.email}</p>
        <p className="text-sm text-muted-foreground">תוכנית</p>
        <p className="capitalize">{plan}</p>
      </section>

      <section className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-medium">מכסות</h2>
        <p>
          יצירות החודש: {monthlyCreations}
          {isFree ? ` / ${String(FREE_MONTHLY_CREATIONS)}` : ' (ללא הגבלה)'}
        </p>
        <p>
          שמורות: {savedCount}
          {isFree ? ` / ${String(FREE_SAVED_PROJECTS)}` : ' (ללא הגבלה)'}
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-medium">יצירות שמורות</h2>
        {myProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">עדיין אין יצירות שמורות.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {myProjects.map((project) => (
              <li key={project.id} className="rounded border px-3 py-2 text-sm">
                {project.title ?? project.shapeHash.slice(0, 12)} —{' '}
                {new Date(project.createdAt).toLocaleDateString('he-IL')}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
