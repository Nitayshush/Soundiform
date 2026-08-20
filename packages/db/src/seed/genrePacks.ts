/**
 * @file        genrePacks.ts
 * @description ⭐ Sprint 9 — ממלא את genre_packs מה-JSON הסטטי של packages/genres, פעם אחת
 *              (idempotent: `onConflictDoUpdate`). מריצים דרך `pnpm run db:seed-genres`.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ אחרי ה-seed הראשוני, ה-DB הוא מקור האמת (§11 Sprint 9: "עריכת GenrePack ללא דיפלוי") —
 * את הסקריפט הזה מריצים שוב רק אם רוצים *לאפס* עריכות אדמין בחזרה לברירת המחדל הסטטית,
 * לא כחלק משוטף.
 */

import { loadAllGenrePacks } from '@soundiform/genres';
import { getDb } from '../client';
import { genrePacks } from '../schema';

export async function seedGenrePacks(): Promise<number> {
  const db = getDb();
  const packs = loadAllGenrePacks();

  for (const [index, pack] of packs.entries()) {
    await db
      .insert(genrePacks)
      .values({
        id: pack.id,
        config: pack,
        isActive: !pack.requiresSamples,
        sortOrder: index,
      })
      .onConflictDoUpdate({
        target: genrePacks.id,
        set: { config: pack, sortOrder: index },
      });
  }

  return packs.length;
}
