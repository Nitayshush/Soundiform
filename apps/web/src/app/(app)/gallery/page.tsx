/**
 * @file        page.tsx
 * @description גלריה — יצירות ציבוריות/פופולריות לפי סגנון (ראה PROJECT.md §11 Sprint 8).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, renders, shares } from '@soundiform/db';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
      createdAt: shares.createdAt,
    })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .where(conditions)
    .orderBy(desc(shares.viewCount))
    .limit(50);

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
                <Card className="border-border/60 p-4 transition-colors hover:border-primary/50 hover:bg-card/80">
                  <Link href={`/s/${row.slug}`} className="block">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{row.genreId}</Badge>
                      <span className="text-xs text-muted-foreground">{row.viewCount} views</span>
                    </div>
                  </Link>
                  <div className="mt-3">
                    <ShareButtons url={`${getSiteUrl()}/s/${row.slug}`} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
