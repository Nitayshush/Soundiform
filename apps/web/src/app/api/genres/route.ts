/**
 * @file        route.ts
 * @description ⭐ Sprint 9 — מקור האמת ל-GenrePacks בזמן ריצה. הקליינט (GenreSelector,
 *              useAudioEngine) קורא מכאן, לא מ-@soundiform/genres הסטטי — זה מה שמאפשר
 *              "עריכת GenrePack ללא דיפלוי" (§11 Sprint 9) לבוא לידי ביטוי בפועל.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { genrePacks, getDb } from '@soundiform/db';

export async function GET(): Promise<NextResponse> {
  const db = getDb();
  const rows = await db
    .select({ config: genrePacks.config })
    .from(genrePacks)
    .where(eq(genrePacks.isActive, true))
    .orderBy(asc(genrePacks.sortOrder));

  return NextResponse.json({ packs: rows.map((row) => row.config) });
}
