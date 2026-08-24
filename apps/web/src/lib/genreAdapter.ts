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
import type { GenreAudioConfig, SynthPresetConfig } from '@soundiform/audio';
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

/**
 * ⭐ 2026-08-24 (Area 1, לפי בקשה חיה): ערך-סמל בתוך אותה מפת-בחירות soundSelections
 * (role→id) שמייצג "לכבות את התפקיד הזה לגמרי" — לא עוד אופציית-צליל, אלא היעדר-טראק.
 * נבחר סמל-מחרוזת (לא שדה נפרד ב-store) כדי לשמור על מודל "בחירה אחת לתפקיד" פשוט —
 * תפקיד הוא או "צליל X" או "כבוי", אף פעם לא שניהם. ראה resolveSynthPresets/
 * resolveMutedRoles למטה, ו-SoundSelector.tsx לכפתור ה-"Off".
 */
export const MUTED_SOUND_OPTION_ID = '__muted__';

/**
 * ⭐ 2026-08-24 (Area 1): פותר בחירות-משתמש (soundSelections, [role]→optionId) אל תוך
 * synthPresets בפועל — soundOptions[role] הוא מקור-האמת לפריסטים חוקיים; id לא-קיים (או
 * ז'אנר בלי soundOptions לתפקיד הזה בכלל) נופל תמיד ל-synthMap[role] הרגיל, אף פעם לא
 * נכשל. ⚠️ נקרא גם מ-api/render/route.ts (שרת) — לכן *חייב* להיות סלחני-לחלוטין לקלט
 * לא-חוקי מהלקוח (§0.3: לעולם לא לסמוך על קליינט), לא לזרוק/לקרוס. תפקיד מושתק
 * (MUTED_SOUND_OPTION_ID) לא נפתר לפריסט בכלל — לא משנה, הטראק לא יבנה כלל (ראה
 * resolveMutedRoles + createAllTrackRuntimes).
 */
function resolveSynthPresets(
  pack: GenrePack,
  soundSelections?: Partial<Record<TrackRole, string>>,
): Partial<Record<TrackRole, SynthPresetConfig>> {
  if (!soundSelections) {
    return pack.synthMap;
  }
  const resolved: Partial<Record<TrackRole, SynthPresetConfig>> = { ...pack.synthMap };
  for (const [role, optionId] of Object.entries(soundSelections) as [TrackRole, string][]) {
    if (optionId === MUTED_SOUND_OPTION_ID) {
      continue;
    }
    const option = pack.soundOptions?.[role]?.find((candidate) => candidate.id === optionId);
    if (option) {
      resolved[role] = option.preset;
    }
  }
  return resolved;
}

function resolveMutedRoles(soundSelections?: Partial<Record<TrackRole, string>>): TrackRole[] {
  if (!soundSelections) {
    return [];
  }
  return (Object.entries(soundSelections) as [TrackRole, string][])
    .filter(([, optionId]) => optionId === MUTED_SOUND_OPTION_ID)
    .map(([role]) => role);
}

export function toGenreAudioConfig(
  pack: GenrePack,
  soundSelections?: Partial<Record<TrackRole, string>>,
): GenreAudioConfig {
  const mutedRoles = resolveMutedRoles(soundSelections);
  return {
    synthPresets: resolveSynthPresets(pack, soundSelections),
    mixCharacter: pack.mixChain,
    sidechainEnabled: pack.sidechainEnabled,
    ...(pack.sidechainDepth !== undefined && { sidechainDepth: pack.sidechainDepth }),
    ...(pack.sidechainReleaseSeconds !== undefined && {
      sidechainReleaseSeconds: pack.sidechainReleaseSeconds,
    }),
    ...(pack.trackEq && { trackEq: pack.trackEq }),
    ...(mutedRoles.length > 0 && { mutedRoles }),
  };
}
