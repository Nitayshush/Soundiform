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

import type { CompositionConfig, RhythmStepPattern, TrackRole } from '@soundiform/core';
import type { GenreAudioConfig } from '@soundiform/audio';
import type { GenrePack } from '@soundiform/genres';

/**
 * ⭐ 2026-08-22: כל role שהסגנון מגדיר rhythmPatterns עבורו (לא רק drums כמו קודם) — זה מה
 * שמאפשר ל-buildBassTrack/buildLeadTrack/buildSkankTrack (core) לצרוך groove ספציפי-לסגנון.
 */
function extractRhythmPatterns(
  pack: GenrePack,
): Partial<Record<TrackRole, RhythmStepPattern>> | undefined {
  const entries = Object.entries(pack.rhythmPatterns) as [
    TrackRole,
    GenrePack['rhythmPatterns'][TrackRole],
  ][];
  const patterns: Partial<Record<TrackRole, RhythmStepPattern>> = {};
  for (const [role, rolePatterns] of entries) {
    const firstPattern = rolePatterns?.[0];
    if (firstPattern) {
      patterns[role] = { stepsPerBar: firstPattern.stepsPerBar, hits: firstPattern.hits };
    }
  }
  return Object.keys(patterns).length > 0 ? patterns : undefined;
}

export function toCompositionConfig(pack: GenrePack): CompositionConfig {
  const rhythmPatterns = extractRhythmPatterns(pack);
  return {
    genreId: pack.id,
    tempoBpm: pack.tempo.default,
    mode: pack.defaultMode,
    gridSubdivision: pack.grid.subdivision,
    swingAmount: pack.grid.swingAmount,
    chordProgression: pack.chordProgression,
    extendedChords: pack.harmonicTendency === 'extended',
    sectionOrder: pack.arrangement.sectionOrder,
    ...(rhythmPatterns && { rhythmPatterns }),
  };
}

export function toGenreAudioConfig(pack: GenrePack): GenreAudioConfig {
  return {
    synthPresets: pack.synthMap,
    mixCharacter: pack.mixChain,
    sidechainEnabled: pack.sidechainEnabled,
  };
}
