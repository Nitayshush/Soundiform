/**
 * @file        schema.ts
 * @description סכימת Zod של GenrePack — ראה PROJECT.md §5.1.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מגבלת V1 מתועדת: `rhythmPatterns` ו-`arrangement` מוגדרים בצורה אמיתית (לא unknown) כדי
 * שקבצי ה-JSON יוכלו לבטא נתונים משמעותיים — אבל **אף אחד מהם עדיין לא נצרך בפועל**
 * ב-harmonyEngine.ts. תבניות תופים אמיתיות (step sequencer) ומבנה intro/build/outro
 * דורשים שינוי ארכיטקטוני נפרד ב-core, לא בהיקף Sprint 5 (תופים כבר נדחו ב-Sprint 3).
 * `synthMap`/`mixChain` הם כן צרכניים בפועל החל מ-Sprint 5, אך מפושטים בכוונה —
 * "supersaw + sidechain" וכו' מ-§5.2 מתורגמים ל-oscillator/envelope/reverb/delay סבירים,
 * לא לדיזיין-סאונד אמיתי (unison detuning, sidechain ducking) שנדחה לעתיד.
 */

import { z } from 'zod';
import { modeSchema, trackRoleSchema } from '@soundiform/core';

export const oscillatorTypeSchema = z.enum(['sine', 'triangle', 'sawtooth', 'square']);

export const envelopeSchema = z.object({
  attack: z.number().min(0),
  decay: z.number().min(0),
  sustain: z.number().min(0).max(1),
  release: z.number().min(0),
});

/** ⭐ 2026-08-22: פילטר אופציונלי לפי-קול — ראה SynthProvider.ts ל-implementation. */
export const synthFilterSchema = z.object({
  type: z.enum(['lowpass', 'highpass']),
  frequencyHz: z.number().positive(),
  resonance: z.number().positive().optional(),
});

/** ⭐ 2026-08-22: רוחב unison "fat" אופציונלי לפי-קול — undefined נופל לברירת מחדל גלובלית.
 * ⭐ 2026-08-24 (Area 2): תקרה הועלתה מ-8 ל-9 — supersaw טראנס/האוס אמיתי משתמש ב-9 קולות
 * (המספר הקלאסי, מקור Roland JP-8000), ראה packages/genres/src/packs/trance.json's lead. */
export const synthUnisonSchema = z.object({
  count: z.number().int().min(1).max(9),
  spreadCents: z.number().min(0).max(100),
});

/**
 * ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 2): שכבת-קול בודדת בתוך פריסט רב-שכבתי — כל שכבה
 * היא בעצם "קול" עצמאי משלה (גל/מעטפת/unison/פילטר משלה), מנוגנת בו-זמנית עם שאר השכבות
 * לאותו תו. זה מה שמאפשר supersaw אמיתי (כמה שכבות saw מוסטות-אוקטבה/גיין) ו-bass layering
 * (שכבת-סאב טהורה + שכבת-אופי מעוותת) — לא רק unison "fat" בתוך קול יחיד (SynthProvider.ts
 * כבר תומך ב-unison לקול בודד; layers הוא רמה נוספת מעל זה, כמה קולות "fat" ביחד).
 */
export const synthLayerSchema = z.object({
  oscillatorType: oscillatorTypeSchema,
  envelope: envelopeSchema,
  /** עוצמת השכבה יחסית לשכבות האחרות (0-1) — לא volume מוחלט, ראה SynthProvider.ts. */
  gain: z.number().min(0).max(1),
  /** הסטת-פיץ' לשכבה הזו בחצאי-טונים (למשל -12 לשכבת-סאב אוקטבה מתחת לשכבה הראשית). */
  detuneSemitones: z.number().default(0),
  filter: synthFilterSchema.optional(),
  unison: synthUnisonSchema.optional(),
  /** ⭐ עיוות/סטורציה לשכבה הזו בלבד (0=בלי, ראה packages/audio/src/mixing/distortion.ts). */
  driveAmount: z.number().min(0).max(1).optional(),
});

export const synthPresetSchema = z.object({
  oscillatorType: oscillatorTypeSchema,
  envelope: envelopeSchema,
  /** האם הקול הזה מתנגן פוליפונית (טריאדה בו-זמנית) — בדרך כלל true ל-pad/skank. */
  polyphonic: z.boolean(),
  filter: synthFilterSchema.optional(),
  unison: synthUnisonSchema.optional(),
  /**
   * ⭐ 2026-08-24 (Area 2): כשמוגדר (ולא ריק) — *מחליף* את oscillatorType/envelope/filter/
   * unison שלמעלה (שנשארים כברירת-מחדל תקפה-בפני-עצמה לפריסטים חד-שכבתיים, לא נדרשים
   * להיעלם מהסכימה כדי לשמור על תאימות-לאחור). כמה שכבות מנוגנות בו-זמנית לכל תו.
   */
  layers: z.array(synthLayerSchema).optional(),
});

export const mixChainConfigSchema = z.object({
  reverbDecaySeconds: z.number().positive(),
  /** בתחביר זמן של Tone.js, למשל "8n". */
  delayTime: z.string().min(1),
  delayFeedback: z.number().min(0).max(1),
});

/** ⭐ 2026-08-24 (Area 2): EQ תלת-פס אופציונלי לפי-טראק — ראה packages/audio/src/mixing/eq.ts. */
export const trackEqConfigSchema = z.object({
  lowDb: z.number().min(-24).max(24),
  midDb: z.number().min(-24).max(24),
  highDb: z.number().min(-24).max(24),
});

/**
 * ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 1): אופציית-צליל בודדת שהמשתמש יכול לבחור עבור
 * תפקיד נתון (bass/lead/drums/pad) — במקום ה-preset הקבוע היחיד ב-synthMap. synthMap[role]
 * נשאר "ברירת המחדל" (המשמש גם כשלא נבחר כלום, וגם צריך להיות *זהה* לאחת האופציות כאן כדי
 * שהבחירה הראשונה תמיד תואמת למה שכבר נשמע). ⚠️ synth-only ב-V1 (kind אין צורך — כל
 * הז'אנרים שמגדירים soundOptions כרגע הם טראנס/האוס, סינתטיים בלבד); דגימות-אמיתיות
 * (piano/guitar לצ'יל/סינמטי/רגאיי) הן הרחבה עתידית שתדרוש discriminated union כאן
 * (kind:'synth'|'sampler') — לא נוסף מראש כדי לא ליצור scope שלא בשימוש (YAGNI), בדיוק
 * כמו ש-InstrumentProvider.ts כבר מתעד "V1: SynthProvider בלבד. V2: SamplerProvider נכנס
 * בלי לגעת ב-core".
 */
export const soundOptionSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ he: z.string().min(1), en: z.string().min(1) }),
  preset: synthPresetSchema,
});
export type SoundOption = z.infer<typeof soundOptionSchema>;

/** ⚠️ לא נצרך ב-V1 — ראה תיעוד למעלה. מוגדר עכשיו כדי שנתוני ה-JSON יהיו משמעותיים מהיום הראשון. */
export const patternSchema = z.object({
  name: z.string().min(1),
  stepsPerBar: z.union([z.literal(8), z.literal(16), z.literal(32)]),
  /** וולוסיטי לכל step, 0 = שקט (rest). */
  hits: z.array(z.number().min(0).max(1)),
});

/** ⚠️ לא נצרך ב-V1 — ראה תיעוד למעלה. */
export const arrangementTemplateSchema = z.object({
  sectionOrder: z.array(z.enum(['intro', 'loop', 'build', 'outro'])).min(1),
});

export const genrePackSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ he: z.string().min(1), en: z.string().min(1) }),
  tempo: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
    default: z.number().positive(),
  }),
  grid: z.object({
    subdivision: z.union([z.literal(8), z.literal(16), z.literal(32)]),
    swingAmount: z.number().min(0).max(1),
  }),
  allowedModes: z.array(modeSchema).min(1),
  defaultMode: modeSchema,
  harmonicTendency: z.enum(['diatonic', 'modal', 'extended']),
  /**
   * ⭐ 2026-08-22: התקדמות הרמונית ספציפית-לסגנון (דרגות-סולם 0-based, לולאה על פני הבארים) —
   * מחליף את ה-I–vi–IV–V האוניברסלי שהיה hardcoded ב-harmonyEngine.ts. כל דרגה חוקית תמיד
   * (§4.3), ללא תלות במוד בפועל — ה"אופי" נובע מהמוד עצמו, לא מהדרגות. harmonicTendency
   * (למעלה) קובע רק אם buildChord מוסיף גם 7th ('extended') — לא כמות/סוג הדרגות.
   */
  chordProgression: z.array(z.number().int()).min(1),
  /**
   * ⭐ 2026-08-25 (מגוון מוזיקלי לפי-צורה): פרוגרסיות-אקורדים חלופיות — undefined/מערך-ריק =
   * רק chordProgression הקבוע (התנהגות ישנה, ללא שינוי). כשמוגדר, composeMusicalScore
   * (packages/core) בוחר ביניהן לפי סימטריה-סיבובית של הצורה (rotationalOrder) או seeded-random.
   */
  chordProgressionOptions: z.array(z.array(z.number().int()).min(1)).optional(),
  roles: z.array(trackRoleSchema).min(1),
  // partialRecord ולא record: pack מגדיר רק את ה-roles שהוא בפועל משתמש בהם (roles למעלה),
  // לא נדרש filler-data מלאכותי לתפקידים שלא רלוונטיים לסגנון (למשל skank בז'אנרים לא-רגאיי).
  rhythmPatterns: z.partialRecord(trackRoleSchema, z.array(patternSchema)),
  synthMap: z.partialRecord(trackRoleSchema, synthPresetSchema),
  /**
   * ⭐ 2026-08-24 (Area 1): אופציות-צליל נבחרות-משתמש לפי-תפקיד — undefined/מערך-ריק[role] =
   * אין בחירה, נופל תמיד ל-synthMap[role]. כשמוגדר (מערך באורך≥1) — apps/web מציג בורר
   * בסטודיו (ראה SoundSelector.tsx). ⚠️ נשאר אופציונלי ולא-חובה עבור roles ב-synthMap —
   * לא כל תפקיד חייב אפשרויות-בחירה (למשל תופים יכולים להישאר בלי, אם הן לא מבודלות מספיק).
   */
  soundOptions: z.partialRecord(trackRoleSchema, z.array(soundOptionSchema).min(1)).optional(),
  /** ⭐ 2026-08-24 (Area 2): EQ אופציונלי לפי-טראק, מעל synthMap — undefined[role] = בלי EQ. */
  trackEq: z.partialRecord(trackRoleSchema, trackEqConfigSchema).optional(),
  mixChain: mixChainConfigSchema,
  arrangement: arrangementTemplateSchema,
  /** ⭐ 2026-08-22: סיידצ'יין קומפרשן (ראה packages/audio/src/mixing/sidechain.ts) — trance/house. */
  sidechainEnabled: z.boolean(),
  /** ⭐ 2026-08-24 (Area 2): כיוונון-עומק/שחרור לפי-סגנון — undefined נופל לברירות המחדל הישנות
   * ב-sidechain.ts. sidechainDepth הוא ה-gain הנותר בפועל בזמן הדחיקה (לא "כמות הנחתה") —
   * ערך *נמוך* יותר = דחיקה עמוקה/דרמטית יותר (0.35 ≈ ברירת המחדל הישנה, הנחתה של 65%). */
  sidechainDepth: z.number().min(0).max(1).optional(),
  sidechainReleaseSeconds: z.number().positive().optional(),
  requiresSamples: z.boolean(), // ⚠️ true → מושבת ב-V1
});

export type GenrePack = z.infer<typeof genrePackSchema>;
