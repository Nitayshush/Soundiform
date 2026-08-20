/**
 * @file        genreAdapter.ts
 * @description ⭐ הגשר היחיד בין GenrePack (@soundiform/genres) לקונפיגים ש-core/audio מצפים
 *              להם — כי core/audio אסור להם לתלות ב-genres ישירות (§3: core→shared בלבד,
 *              audio→core,shared בלבד). רק apps/web, שמותר לו לתלות בהכל, ממיר.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { CompositionConfig } from '@soundiform/core';
import type { GenreAudioConfig } from '@soundiform/audio';
import type { GenrePack } from '@soundiform/genres';

export function toCompositionConfig(pack: GenrePack): CompositionConfig {
  const drumsPattern = pack.rhythmPatterns.drums?.[0];
  return {
    genreId: pack.id,
    tempoBpm: pack.tempo.default,
    mode: pack.defaultMode,
    gridSubdivision: pack.grid.subdivision,
    swingAmount: pack.grid.swingAmount,
    ...(drumsPattern && {
      drumsPattern: { stepsPerBar: drumsPattern.stepsPerBar, hits: drumsPattern.hits },
    }),
  };
}

export function toGenreAudioConfig(pack: GenrePack): GenreAudioConfig {
  return {
    synthPresets: pack.synthMap,
    mixCharacter: pack.mixChain,
  };
}
