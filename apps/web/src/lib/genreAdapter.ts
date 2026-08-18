/**
 * @file        genreAdapter.ts
 * @description ⭐ הגשר היחיד בין GenrePack (@shape-sound/genres) לקונפיגים ש-core/audio מצפים
 *              להם — כי core/audio אסור להם לתלות ב-genres ישירות (§3: core→shared בלבד,
 *              audio→core,shared בלבד). רק apps/web, שמותר לו לתלות בהכל, ממיר.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { CompositionConfig } from '@shape-sound/core';
import type { GenreAudioConfig } from '@shape-sound/audio';
import type { GenrePack } from '@shape-sound/genres';

export function toCompositionConfig(pack: GenrePack): CompositionConfig {
  return {
    genreId: pack.id,
    tempoBpm: pack.tempo.default,
    mode: pack.defaultMode,
    gridSubdivision: pack.grid.subdivision,
    swingAmount: pack.grid.swingAmount,
  };
}

export function toGenreAudioConfig(pack: GenrePack): GenreAudioConfig {
  return {
    synthPresets: pack.synthMap,
    mixCharacter: pack.mixChain,
  };
}
