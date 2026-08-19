/**
 * @file        page.tsx
 * @description דף שיתוף ציבורי ליצירה בודדת (ראה PROJECT.md §11 Sprint 8, §9 מנוע הצמיחה).
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * Server Component — RLS ציבורי על shares/remixes (public role) מרשה את זה גם ללא session,
 * אבל בפועל קוראים דרך Drizzle (עוקף RLS ממילא, ראה api/projects/route.ts להסבר).
 */

import { notFound } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { getDb, projects, renders, shares } from '@shape-sound/db';
import { RemixButton } from '@/components/share/RemixButton';
import { SharePlayer } from '@/components/share/SharePlayer';

interface SharePageProps {
  params: Promise<{ shareId: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { shareId } = await params;
  const db = getDb();

  const [row] = await db
    .select({
      shareRowId: shares.id,
      renderId: renders.id,
      score: renders.score,
      genreId: renders.genreId,
      shapeData: projects.shapeData,
    })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(eq(shares.slug, shareId));

  if (!row) {
    notFound();
  }

  await db
    .update(shares)
    .set({ viewCount: sql`${shares.viewCount} + 1` })
    .where(eq(shares.id, row.shareRowId));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold">יצירה משותפת</h1>
      <p className="mb-6 text-sm text-muted-foreground">Shape-to-Sound — מוזיקה מצורה</p>
      <SharePlayer score={row.score} genreId={row.genreId} />
      <div className="mt-6">
        <RemixButton renderId={row.renderId} paths={row.shapeData.paths} />
      </div>
    </main>
  );
}
