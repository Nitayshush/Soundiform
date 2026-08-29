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
import type { GenreAudioConfig, SynthLayerConfig, SynthPresetConfig } from '@soundiform/audio';
// ⚠️ ייבוא-ערך (לא type) מ-'@soundiform/audio' — בטוח כאן: api/render/route.ts כבר עושה
// בדיוק את זה (VIDEO_ASPECT_RATIOS) ורץ בפרודקשן. חייב להיות מקור-אמת יחיד עם SynthProvider,
// אחרת חישוב-התקציב למטה יסטה בשקט מכמות האוסצילטורים שנוצרת בפועל.
import { DEFAULT_UNISON_COUNT, DEFAULT_UNISON_SPREAD_CENTS } from '@soundiform/audio';
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

/**
 * ⭐ 2026-08-25 (מגוון מוזיקלי לפי-צורה): כל תבניות-הקצב לכל role (לא רק [0] כמו
 * extractRhythmPatterns) — מזין את CompositionConfig.rhythmPatternOptions, כדי ש-
 * composeMusicalScore (packages/core) יוכל לבחור ביניהן לפי-צורה. role עם תבנית בודדת בלבד
 * עדיין מוזן (מערך-באורך-1) — הבחירה תמיד "נופלת" לתבנית היחידה, בלי הבדל התנהגותי.
 */
function extractRhythmPatternOptions(
  pack: GenrePack,
): Partial<Record<TrackRole, readonly RhythmStepPattern[]>> | undefined {
  const entries = Object.entries(pack.rhythmPatterns) as [
    TrackRole,
    GenrePack['rhythmPatterns'][TrackRole],
  ][];
  const options: Partial<Record<TrackRole, readonly RhythmStepPattern[]>> = {};
  for (const [role, rolePatterns] of entries) {
    if (rolePatterns && rolePatterns.length > 0) {
      options[role] = rolePatterns.map((pattern) => ({
        stepsPerBar: pattern.stepsPerBar,
        hits: pattern.hits,
      }));
    }
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

export function toCompositionConfig(pack: GenrePack): CompositionConfig {
  const rhythmPatterns = extractRhythmPatterns(pack);
  const rhythmPatternOptions = extractRhythmPatternOptions(pack);
  return {
    genreId: pack.id,
    tempoBpm: pack.tempo.default,
    mode: pack.defaultMode,
    gridSubdivision: pack.grid.subdivision,
    swingAmount: pack.grid.swingAmount,
    chordProgression: pack.chordProgression,
    extendedChords: pack.harmonicTendency === 'extended',
    sectionOrder: pack.arrangement.sectionOrder,
    tempoRange: { min: pack.tempo.min, max: pack.tempo.max },
    ...(pack.allowedModes.length > 1 && { allowedModes: pack.allowedModes }),
    ...(pack.chordProgressionOptions && {
      chordProgressionOptions: pack.chordProgressionOptions,
    }),
    ...(rhythmPatterns && { rhythmPatterns }),
    ...(rhythmPatternOptions && { rhythmPatternOptions }),
    ...(pack.absoluteNoteBoard && { absoluteNoteBoard: true }),
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
 * ⭐ 2026-08-25 (מגוון מוזיקלי לפי-צורה): hash דטרמיניסטי (djb2-variant) מ-seed+role לאינדקס
 * ב-[0,length) — לא PRNG איכותי, רק "ברירת-מחדל שונה לפי-צורה" יציבה. seededRandom.ts (core)
 * לא מיוצא מ-index.ts בכוונה (פנימי-בלבד לשכבת theory/groove) — לא שוברים את זה בשביל צורך
 * קטן כאן; hash עצמאי מספיק כשכל מה שנדרש הוא "אותו seed → תמיד אותו אינדקס".
 */
function seededIndex(seed: string, role: string, length: number): number {
  const combined = `${seed}:${role}`;
  let hash = 0;
  for (let index = 0; index < combined.length; index += 1) {
    hash = (Math.imul(hash, 31) + combined.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % length;
}

/**
 * ⭐ 2026-08-25 (בחירת-צליל מרובה): "שכבות" בפועל של פריסט בודד — preset.layers כמו-שהוא
 * אם מוגדר ולא-ריק, אחרת "שכבה סינתטית" יחידה מהשדות ברמה-העליונה (gain=1) — אותה טכניקה
 * בדיוק כמו SynthProvider.ts's resolveLayers (פנימי שם, לא מיוצא — משוכפל כאן בכוונה, לא
 * מרחיבים את ה-API הציבורי של packages/audio רק בשביל צורך-פנימי קטן כאן).
 */
function presetToLayers(preset: SynthPresetConfig): SynthLayerConfig[] {
  if (preset.layers && preset.layers.length > 0) {
    return preset.layers;
  }
  return [
    {
      oscillatorType: preset.oscillatorType,
      envelope: preset.envelope,
      gain: 1,
      ...(preset.filter && { filter: preset.filter }),
      ...(preset.unison && { unison: preset.unison }),
    },
  ];
}

/**
 * ⭐ 2026-08-25 (בחירת-צליל מרובה): ממזג כמה SynthPresetConfig לפריסט-רב-שכבתי אחד — כל
 * השכבות של כל הפריסטים הנבחרים מתנגנות בו-זמנית לאותו תו (ראה presetToLayers). בחירה
 * בודדת מוחזרת כמו-שהיא (בלי "מיזוג של אחד" מיותר). polyphonic=true אם *כלשהו* מהפריסטים
 * הנבחרים פוליפוני (לא מאבדים יכולת-אקורד מ-pad). שדות top-level אחרים (oscillatorType/
 * envelope/filter/unison) נלקחים מהפריסט הראשון — לא רלוונטיים בפועל ברגע ש-layers מאוכלס.
 */
function mergeSynthPresets(presets: readonly SynthPresetConfig[]): SynthPresetConfig | undefined {
  const [base, ...rest] = presets;
  if (!base) {
    return undefined;
  }
  if (rest.length === 0) {
    return base;
  }
  return applyOscillatorBudget({
    ...base,
    polyphonic: presets.some((preset) => preset.polyphonic),
    layers: presets.flatMap(presetToLayers),
  });
}

/**
 * ⭐ 2026-08-28 (הסבב המבני לסאונד בנייד): כמה אוסצילטורים *אמיתיים* שכבה מריצה לכל תו —
 * חייב להתאים בדיוק ל-createToneVoice ב-SynthProvider.ts (משם מיובאת ברירת המחדל).
 */
function layerOscillatorCount(layer: SynthLayerConfig): number {
  return layer.unison?.count ?? DEFAULT_UNISON_COUNT;
}

/**
 * הנחת-עבודה לכמות התווים שנשמעים בו-זמנית בפריסט פוליפוני (pad/skank מנגנים אקורדים).
 * זה מה שהופך פאד ליקר פי-4 מ-lead באותו מספר-אוסצילטורים-להצהרה — ובלי המשקל הזה
 * התקציב היה "מתמחר" פאד בזול ולא נוגע בדיוק בתפקיד היקר ביותר (מדידה: הפאד לבדו היה
 * 80 מתוך 136 האוסצילטורים בתרחיש של 4 צלילים לכל תפקיד).
 */
const ASSUMED_CHORD_VOICES = 4;

/**
 * ⭐ 2026-08-28 — תקציב-אוסצילטורים לכל תפקיד, אחרי איחוד כמה צלילים נבחרים.
 *
 * הרקע (מדידות אמיתיות על מנוע הרינדור): העלות בפועל היא כמעט-לינארית במספר האוסצילטורים
 * הכולל. צליל אחד לכל תפקיד ≈ 45 אוסצילטורים ומתנגן סביר; 4 צלילים לכל תפקיד ≈ 136 — פי 6.5
 * יקר יותר, ומעבר ליכולת של נייד. **כל הצלילים שנבחרו ממשיכים להתנגן יחד בכל תו** (דרישת
 * השילוב ההרמוני) — רק ה"עובי" (unison) של כל שכבה מצטמצם יחסית, עם רצפה של אוסצילטור אחד,
 * כך ששום צליל נבחר לא נעלם לגמרי.
 *
 * בחירה **בודדת** לא מושפעת בכלל — mergeSynthPresets מחזיר את הפריסט היחיד כמו-שהוא לפני
 * שמגיעים לכאן — כך שהתקציב נוגע *רק* בערימות של 2 צלילים ומעלה.
 *
 * הערך 24 נמדד: על אותה יצירה ואותם 4 צלילים לכל תפקיד, זמן-הרינדור הוא 0.45x מהזמן-אמת
 * לפני הסבב הזה, 1.01x בתקציב 32, ו-1.41x בתקציב 24. מתחת ל-24 התשואה יורדת (16 נותן רק
 * 1.77x) תמורת פגיעה גדולה יותר בעובי-הצליל. זו נקודת-הכיוונון המרכזית אם המדידה בנייד
 * (AudioDebugHUD, ?debug=audio) תראה שזמן-הרינדור עדיין ארוך מדי.
 */
const OSCILLATOR_BUDGET_PER_ROLE = 24;

function applyOscillatorBudget(preset: SynthPresetConfig): SynthPresetConfig {
  const layers = preset.layers;
  if (!layers || layers.length === 0) {
    return preset;
  }
  const voiceMultiplier = preset.polyphonic ? ASSUMED_CHORD_VOICES : 1;
  const declaredOscillators = layers.reduce((sum, layer) => sum + layerOscillatorCount(layer), 0);
  const effectiveOscillators = declaredOscillators * voiceMultiplier;
  if (effectiveOscillators <= OSCILLATOR_BUDGET_PER_ROLE) {
    return preset;
  }
  const scale = OSCILLATOR_BUDGET_PER_ROLE / effectiveOscillators;
  return {
    ...preset,
    layers: layers.map((layer) => ({
      ...layer,
      unison: {
        // ⚠️ רצפה של 1 (לא 0) — שכבה עם 0 אוסצילטורים היא צליל שנבחר ופשוט נעלם, וזה בדיוק
        // מה שהמשתמש ביקש שלא יקרה. גם התקרה 9 של synthUnisonSchema נשמרת מאליה (רק מקטינים).
        count: Math.max(1, Math.round(layerOscillatorCount(layer) * scale)),
        spreadCents: layer.unison?.spreadCents ?? DEFAULT_UNISON_SPREAD_CENTS,
      },
    })),
  };
}

/**
 * ⭐ 2026-08-24 (Area 1), מורחב 2026-08-25 (מגוון מוזיקלי לפי-צורה + בחירת-צליל מרובה): פותר
 * בחירות-משתמש (soundSelections, [role]→optionId[]) אל תוך synthPresets בפועל —
 * soundOptions[role] הוא מקור-האמת לפריסטים חוקיים; id לא-קיים (או ז'אנר בלי soundOptions
 * לתפקיד הזה בכלל) נופל תמיד ל-synthMap[role] הרגיל, אף פעם לא נכשל. ⚠️ נקרא גם מ-
 * api/render/route.ts (שרת) — לכן *חייב* להיות סלחני-לחלוטין לקלט לא-חוקי מהלקוח (§0.3:
 * לעולם לא לסמוך על קליינט), לא לזרוק/לקרוס. תפקיד מושתק (MUTED_SOUND_OPTION_ID בתוך
 * המערך) לא נפתר לפריסט בכלל — לא משנה, הטראק לא יבנה כלל (ראה resolveMutedRoles +
 * createAllTrackRuntimes).
 *
 * ⭐ 2026-08-25: role בלי בחירה מפורשת נופל לברירת-מחדל תלוית-seed (seededIndex) — לא
 * synthMap[role] הקבוע/options[0]. role עם כמה id-ים נבחרים ממוזג ע"י mergeSynthPresets.
 * בחירה ידנית של המשתמש תמיד גוברת על ברירת-המחדל.
 */
function resolveSynthPresets(
  pack: GenrePack,
  seed: string,
  soundSelections?: Partial<Record<TrackRole, string[]>>,
): Partial<Record<TrackRole, SynthPresetConfig>> {
  const resolved: Partial<Record<TrackRole, SynthPresetConfig>> = { ...pack.synthMap };
  for (const role of Object.keys(pack.synthMap) as TrackRole[]) {
    const options = pack.soundOptions?.[role];
    if (options && options.length > 0) {
      const defaultOption = options[seededIndex(seed, role, options.length)];
      if (defaultOption) {
        resolved[role] = defaultOption.preset;
      }
    }
  }
  if (soundSelections) {
    for (const [role, optionIds] of Object.entries(soundSelections) as [TrackRole, string[]][]) {
      if (!optionIds || optionIds.length === 0 || optionIds.includes(MUTED_SOUND_OPTION_ID)) {
        continue;
      }
      const selectedPresets = optionIds
        .map((optionId) =>
          pack.soundOptions?.[role]?.find((candidate) => candidate.id === optionId),
        )
        .filter((option): option is NonNullable<typeof option> => option !== undefined)
        .map((option) => option.preset);
      const merged = mergeSynthPresets(selectedPresets);
      if (merged) {
        resolved[role] = merged;
      }
    }
  }
  return resolved;
}

function resolveMutedRoles(soundSelections?: Partial<Record<TrackRole, string[]>>): TrackRole[] {
  if (!soundSelections) {
    return [];
  }
  return (Object.entries(soundSelections) as [TrackRole, string[]][])
    .filter(([, optionIds]) => optionIds?.includes(MUTED_SOUND_OPTION_ID))
    .map(([role]) => role);
}

export function toGenreAudioConfig(
  pack: GenrePack,
  seed: string,
  soundSelections?: Partial<Record<TrackRole, string[]>>,
): GenreAudioConfig {
  const mutedRoles = resolveMutedRoles(soundSelections);
  return {
    synthPresets: resolveSynthPresets(pack, seed, soundSelections),
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
