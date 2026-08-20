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
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-semibold">גלריה</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">עדיין אין יצירות ציבוריות.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {rows.map((row) => (
            <li key={row.slug}>
              <Link href={`/s/${row.slug}`} className="block rounded border p-3 hover:bg-muted">
                <p className="font-mono text-sm">{row.genreId}</p>
                <p className="text-xs text-muted-foreground">{row.viewCount} צפיות</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
