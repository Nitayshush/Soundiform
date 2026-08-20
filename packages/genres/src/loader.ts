/**
 * @file        loader.ts
 * @description טעינת GenrePack (מ-DB או מ-packs/*.json) + ולידציה מול schema.ts.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ V1: טוען מ-JSON סטטי בתוך החבילה, לא מ-DB (genre_packs, §6) — §5 עצמו אומר "הוספת
 * סגנון = הוספת שורה, בלי דיפלוי", וזה נכון רק כשה-DB הוא מקור האמת. חיבור ל-DB בפועל
 * (עם is_active/sort_order) הוא עבודת שילוב עתידית שדורשת @soundiform/db — לא כאן,
 * כדי לא ליצור תלות core/genres → db בטרם עת.
 */

import trance from './packs/trance.json' with { type: 'json' };
import house from './packs/house.json' with { type: 'json' };
import chill from './packs/chill.json' with { type: 'json' };
import cinematic from './packs/cinematic.json' with { type: 'json' };
import reggae from './packs/reggae.json' with { type: 'json' };
import { genrePackSchema, type GenrePack } from './schema';

const RAW_PACKS: readonly unknown[] = [trance, house, chill, cinematic, reggae];

function parsePack(raw: unknown): GenrePack {
  const result = genrePackSchema.safeParse(raw);
  if (!result.success) {
    const id = typeof raw === 'object' && raw !== null && 'id' in raw ? String(raw.id) : '?';
    throw new Error(`loader: GenrePack "${id}" לא תקף מול הסכימה: ${result.error.message}`);
  }
  return result.data;
}

const ALL_PACKS: readonly GenrePack[] = RAW_PACKS.map(parsePack);

/** כל ה-GenrePacks, כולל כאלה עם requiresSamples: true (reggae — מוסתר ב-V1). */
export function loadAllGenrePacks(): readonly GenrePack[] {
  return ALL_PACKS;
}

/** GenrePacks פעילים בלבד — מה שמותר להציג ב-GenreSelector ב-V1 (§5.2). */
export function loadActiveGenrePacks(): readonly GenrePack[] {
  return ALL_PACKS.filter((pack) => !pack.requiresSamples);
}

/** מחפש GenrePack לפי id, כולל כאלה שאינם פעילים. מחזיר null אם לא נמצא. */
export function loadGenrePackById(id: string): GenrePack | null {
  return ALL_PACKS.find((pack) => pack.id === id) ?? null;
}
