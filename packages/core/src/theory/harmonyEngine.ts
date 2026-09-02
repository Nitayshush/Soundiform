/**
 * @file        harmonyEngine.ts
 * @description ⭐⭐ הפרק המחבר — RawMusicalIntent → MusicalScore אמיתי ותקף. סוגר את שכבה 3
 *              (Theory & Taste, §4.1): אוכף סולם, הרמוניה, voice leading, קוונטיזציה, הומניזציה.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ Sprint 5: מקבל CompositionConfig (טמפו/מוד/גריד/סווינג) מהקורא — לא מ-GenrePack
 * ישירות! §3 קובע "core → shared" בלבד, core לא תלוי ב-@soundiform/genres. apps/web הוא
 * זה שממיר GenrePack ל-CompositionConfig לפני הקריאה. השורש (pitch class) נשאר נגזר
 * דטרמיניסטית מ-seed בכל הסגנונות — זה ה"תוכן" של הצורה (§4.5), לא ה"לבוש" של הסגנון.
 *
 * ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 3+4): שני שינויים ביחד כי שניהם נוגעים באותה
 * מכונת חישוב-משך/תוכן-סקשן:
 * (1) baseBars מושפע גם מ-intent.sizeHint (גודל ה-bounding-box של הציור, geometryToMusic.ts) —
 *     לא רק ממספר הקודקודים כמו קודם.
 * (2) lead/bass כבר לא שקטים ב-intro/build/outro — buildLeadTrack/buildBassTrack מייצרים
 *     תוכן (גרסה מדוללת/רכה/נמוכה-יותר של אותו המוטיב) לכל הסקשנים, לא רק ל-loop. בעבר
 *     (ראה git history) הם יוצרו רק ל-loopBars ואז הוזזו — התנהגות שהייתה מכוונת אך יצרה
 *     יצירות שעד 75% מהן שקטות ב-lead/bass. progressionDegrees גם חושב מחדש כרצף אחד
 *     רציף על פני כל המשך (לא restart מ-0 בכל section) — מסלק אי-רציפות הרמונית בגבולות.
 */

import type { Mode, MusicalScore, Note, Section, Track, TrackRole } from '../score/MusicalScore';
import { musicalScoreSchema } from '../score/scoreSchema';
import type { RawMusicalIntent, SymmetryTransform } from '../mapping/geometryToMusic';
import { scaleDegreeToMidiPitch, snapToScale } from './scales';
import { buildChord } from './chords';
import { applyCadences, degreeAtBar, progressionDegreesFromRaster } from './progression';
import { chooseSmoothVoicing, smoothMelodicLine } from './voiceLeading';
import {
  applySwing,
  quantizeToGrid,
  ticksPerGridUnit,
  TICKS_PER_BEAT,
  type GridSubdivision,
} from '../groove/quantize';
import { humanizeTiming, humanizeVelocity } from '../groove/humanize';
import { createSeededRandom } from '../internal/seededRandom';
import { at } from '../internal/arrayUtils';
import { rasterizeShapeToBoard, type BoardRaster } from '../analysis/boardRaster';
import { buildEventRaster } from '../analysis/onsetEvents';
import {
  applyPolicyWithFloor,
  resolveRolePolicy,
  DRUM_PIECE_POLICY,
  type RhythmPolicy,
} from './rolePolicy';
import { ROLE_PITCH_RANGES } from './rules';
import { DRUM_PIECE_GAIN, drumPieceForRow, type DrumPiece } from './drumKit';
import {
  beatHitsForBar,
  DRUM_PIECE_DEGREE_OFFSET,
  piecesOwnedByPattern,
  type BeatPattern,
} from './beatPattern';
import {
  ABSOLUTE_BOARD_ROOT_PITCH_CLASS,
  buildNoteBoardRows,
  COLUMNS_PER_BAR,
  MELODY_DEGREE_OFFSET,
  MELODY_DEGREE_RANGE,
  quantizeYToRowIndex,
  resolveBoardRowCount,
} from './noteBoard';

const SCORE_FORMAT_VERSION = '1.0.0';
const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
/** מרכז אוקטבת השורש (MIDI) — C3-ish, בסיס נוח לכל שלושת הטראקים סביבו. */
const ROOT_OCTAVE_BASE_MIDI = 48;
/** כמה תווים "יושבים" בבר אחד לצורך חישוב durationBars מתוך motifSize. */
const NOTES_PER_BAR = 4;
/**
 * טווח דרגות-סולם למלודיה — Y=0 (למעלה) → הדרגה הגבוהה, Y=1 (למטה) → הנמוכה.
 * ⭐ 2026-08-25 (תיקון ממוקד: טווח-מלודיה רחב יותר): 8→15 (מ-~אוקטבה ל-~2 אוקטבות) — כדי
 * שציר-ה-Y ישפיע משמעותית יותר על הפיץ' בפועל. מאומת-חשבונית שבטוח מול ROLE_PITCH_RANGES.lead
 * (rules.ts, 48–96) על כל שורש אפשרי (48–59) ובכל אחד מ-7 המודים: הדרגה המקסימלית (7+15-1=21)
 * נותנת אינטרוול מקסימלי של 36 חצי-טונים — 59+36=95≤96, תמיד בטוח. גם עם זאת, applySymmetryTransform's
 * inversion יכול "להיפתח" רחוק יותר עם הטווח הרחב — ראה wrapPitchIntoRealisticRange ב-buildLeadTrack.
 */
// MELODY_DEGREE_RANGE/MELODY_DEGREE_OFFSET/ABSOLUTE_BOARD_ROOT_PITCH_CLASS/COLUMNS_PER_BAR
// עברו ל-noteBoard.ts (מקור-אמת יחיד, נצרך גם ע"י MusicalGrid.tsx דרך @soundiform/core) —
// מיובאים למטה כדי למנוע import מעגלי (noteBoard.ts גם צריך אותם).
/** הבס יושב אוקטבה מתחת לשורש. */
const BASS_DEGREE_OFFSET = -7;

/**
 * ⭐ 2026-08-24 (Area 3): טווח המכפיל על baseBars-מ-motif לפי intent.sizeHint∈[0,1]
 * (geometryToMusic.ts — אלכסון bounding-box מנורמל). ציור קטן מתכווץ עד 0.6×, ציור
 * שממלא את הקנבס מתארך עד 1.5×. motifSize עצמו (→ *כמות* התווים) לא משתנה — זה מושג
 * נפרד מ*אורך* היצירה.
 */
const SIZE_MULTIPLIER_MIN = 0.6;
const SIZE_MULTIPLIER_MAX = 1.5;
/**
 * תקרה עצמאית ל-baseBars (לפני הכפלת-סימטריה) — נגזרת מהתקרה הישנה של motifSize
 * (MAX_MOTIF_SIZE=64 ב-geometryToMusic.ts → ceil(64/4)=16) מוכפלת ב-SIZE_MULTIPLIER_MAX,
 * כדי ש-sizeHint לא יפתח דרך חדשה ובלתי-מוגבלת למשכים ארוכים במיוחד (עלות רינדור/CPU).
 */
const MAX_LOOP_BASE_BARS = 24;

const TICKS_PER_BAR = TICKS_PER_BEAT * DEFAULT_TIME_SIGNATURE[0];

/**
 * ⭐ 2026-08-24 (Area 4, מתוקן פעמיים אחרי שתי בדיקות אמיתיות בסטודיו):
 *
 * גרסה 1 דיללה את *מספר* התווים (density) — קרסה ל"תו אחד ממושך" בסקשן-קצה של בר בודד
 * (המקרה הנפוץ ביותר). תוקן: תמיד מנגנים את *כל* fullMelody (ראה buildRampedLeadNotes).
 *
 * גרסה 2 (הגרסה הזו מתקנת) הוסיפה גם הזזת-רגיסטר קבועה (אוקטבה למטה) והחלשת-עוצמה
 * ל-intro/outro — לבדיקה אמיתית עם ציור **קו ישר כמעט-שטוח** (ה-Y כמעט קבוע לאורך כל
 * הצורה) זה חשף באג-עיצוב אמיתי: ה-loop ניגן pitch=71 לאורך כולו (כצפוי — קו שטוח = אותו
 * pitch), אבל ה-intro/build/outro ניגנו pitch=59 — אוקטבה שלמה למטה, על אף שהצורה עצמה
 * לא השתנתה בכלל. בדיוק זו הייתה תלונת המשתמש: "קו ישר אמור לתת אותה מנגינה תמיד; בפועל
 * זה שונה". הזזת-רגיסטר/עוצמה היא תוספת-עיצוב שלי, לא נגזרת מהצורה — מפרה את העיקרון
 * המרכזי של הפרויקט (§4.5: "הצורה קובעת תוכן, הסגנון קובע רק לבוש") באותה מידה שהשקט
 * המקורי הפר אותו. התיקון: registerOffsetSemitones=0 תמיד (הפיץ' תמיד זהה למה שה-loop
 * היה מנגן), velocityScale=1 ל-intro/outro (בלי החלשה מלאכותית). build שומר על עלייה
 * הדרגתית עדינה בעוצמה — זו כבר לא "עיצוב-תוכן" אלא דינמיקת-ביצוע לגיטימית (בדיוק מה
 * שהשם "build" אומר), ולא נוגעת בפיץ' בכלל.
 */
interface SectionEnergyRamp {
  velocityScale: (progress: number) => number;
  registerOffsetSemitones: (progress: number) => number;
}

/** intro/outro — כל המוטיב, באותו רגיסטר ובאותה עוצמה בדיוק כמו ה-loop — נאמן לצורה בלבד. */
const EDGE_RAMP: SectionEnergyRamp = {
  velocityScale: () => 1,
  registerOffsetSemitones: () => 0,
};

/** build — עלייה הדרגתית עדינה בעוצמה (דינמיקת-ביצוע, לא שינוי תוכן) לקראת חזרת ה-loop. */
const BUILD_ENTRY_VELOCITY_SCALE = 0.75;
const BUILD_RAMP: SectionEnergyRamp = {
  velocityScale: (progress) =>
    BUILD_ENTRY_VELOCITY_SCALE + (1 - BUILD_ENTRY_VELOCITY_SCALE) * progress,
  registerOffsetSemitones: () => 0,
};

/**
 * ⭐ 2026-08-24: טווח MIDI ריאליסטי ל-lead — *חייב* להישאר תואם ל-ROLE_PITCH_RANGES.lead
 * ב-rules.ts (48-96; לא מיובא ישירות כדי לא ליצור תלות מ-content-generation ל-validation,
 * אותה הפרדה קיימת כבר בין MELODY_DEGREE_OFFSET כאן לבין rules.ts). registerOffsetSemitones
 * (למעלה) יכול לדחוף תו מחוץ לטווח הזה במקרי-קצה — המוטיב המשני-ההפוך (secondaryMotif,
 * applySymmetryTransform) כבר תופס כמעט את הטווח כולו לפני כל הזזה. עוטפים באוקטבות
 * (±12 — תמיד שומר על חברות-בסולם, §4.3) במקום לחתוך/לקרוס אל מחוץ לטווח.
 */
const LEAD_REALISTIC_RANGE = { min: 48, max: 96 };

function wrapPitchIntoRealisticRange(pitch: number, range: { min: number; max: number }): number {
  let result = pitch;
  while (result < range.min) {
    result += 12;
  }
  while (result > range.max) {
    result -= 12;
  }
  return result;
}

/**
 * תבנית ריתמית דטרמיניסטית — hits[step] הוא velocity (0=שקט). ⭐ 2026-08-22: נקרא בעבר
 * DrumsPattern; שונה שם כי עכשיו כל role (bass/lead/skank/drums) משתמש באותה צורה — ראה
 * GenrePack.rhythmPatterns ב-§5.1.
 */
export interface RhythmStepPattern {
  stepsPerBar: GridSubdivision;
  hits: readonly number[];
}

/**
 * מה ש-composeMusicalScore צריך מסגנון (GenrePack) בלי לתלות ב-@soundiform/genres.
 * apps/web בונה את זה מ-GenrePack שנבחר; ברירת המחדל (ללא סגנון עדיין) היא באחריות הקורא.
 */
export interface CompositionConfig {
  genreId: string;
  tempoBpm: number;
  mode: Mode;
  gridSubdivision: GridSubdivision;
  /** 0–1, ראה GenrePack.grid.swingAmount ב-§5.1. */
  swingAmount: number;
  /**
   * ⭐ 2026-08-22: התקדמות הרמונית ספציפית-לסגנון (דרגות-סולם 0-based, לולאה על-פני הבארים) —
   * ראה GenrePack.chordProgression ב-§5.1. מחליף את ה-I–vi–IV–V האוניברסלי שהיה hardcoded כאן.
   */
  chordProgression: readonly number[];
  /** ⭐ 2026-08-22: harmonicTendency==='extended' (chill/cinematic) — מוסיף 7th לאקורדי ה-pad. */
  extendedChords: boolean;
  /**
   * ⭐ 2026-08-22: תבניות הריתמיקה של הסגנון (rhythmPatterns[role][0]) — מחליף את
   * drumsPattern הישן (שכיסה רק תופים). כל role שמוגדר כאן משפיע על התזמון/מבנה בפועל:
   * bass/lead מקבלים placement קצבי-לפי-סגנון (עדיין תוכן/כמות-תווים מהצורה, §4.5 — ראה
   * buildLeadTrack), drums/skank מקבלים טראק ריתמי נפרד לגמרי (buildDrumsTrack/buildSkankTrack).
   * pad נבנה כברירת מחדל *אלא אם* rhythmPatterns מוגדר בלי מפתח pad (ראה composeMusicalScore) —
   * זה מה שמדיר pad מרגאיי (שיש לו skank במקום), בלי לשבור configs ישנים/בדיקות שלא מגדירים
   * rhythmPatterns בכלל.
   */
  rhythmPatterns?: Partial<Record<TrackRole, RhythmStepPattern>>;
  /**
   * ⭐ 2026-08-22: מבנה היצירה (§5.1 arrangement.sectionOrder) — היה מוגדר תמיד כ-['loop']
   * ולא נקרא בפועל (הפלט תמיד היה לולאה סטטית אחת). כשמוגדר ריבוי-סקשנים, composeMusicalScore
   * מוסיף intro/build/outro אמיתיים סביב תוכן ה-loop (עדיין באורך שנגזר מהצורה, §4.5).
   * ברירת מחדל אם undefined: ['loop'] (התנהגות ישנה, זהה למה שהיה hardcoded).
   */
  sectionOrder?: readonly Section['name'][];
  /**
   * ⭐ 2026-08-25 (מגוון מוזיקלי לפי-צורה): טווח טמפו לגיטימי לסגנון — לצד tempoBpm הקיים
   * (שנשאר ברירת-המחדל כש-tempoRange לא מוגדר). כשקיים, composeMusicalScore בוחר טמפו בפועל
   * בתוך הטווח לפי intent.rhythmicDensityHint (סיגנל שהיה מחושב ומעולם לא נצרך) — צורה
   * "עמוסת-פינות" מקבלת טמפו מהיר יותר בתוך מה שהסגנון מגדיר כלגיטימי.
   */
  tempoRange?: { min: number; max: number };
  /**
   * ⭐ 2026-08-25: מודים חוקיים לסגנון — לצד mode הקיים (שנשאר ברירת-המחדל כשלא מוגדר, או
   * כשמוגדר אורך≤1). כשיש יותר ממוד אחד, composeMusicalScore בוחר לפי intent.articulation
   * (בינארי גיאומטרי טבעי — עקבי עם איך ש-articulation עצמו נגזר מחדות-הצורה).
   */
  allowedModes?: readonly Mode[];
  /**
   * ⭐ 2026-08-25: פרוגרסיות-אקורדים חלופיות לסגנון — לצד chordProgression הקיים (ברירת-מחדל
   * כשלא מוגדר). כשקיים, נבחר לפי intent.rotationalOrder כשיש סימטריה-סיבובית אמיתית
   * (משמעות גיאומטרית: משושה לעומת משולש יבחרו אחרת), אחרת seeded-random.
   */
  chordProgressionOptions?: readonly (readonly number[])[];
  /**
   * ⭐ 2026-08-25: תבניות-קצב חלופיות לכל role — שדה נפרד מ-rhythmPatterns (שנשאר הפריט
   * הבודד/ברירת-המחדל כש-role חסר כאן). נבחר לפי intent.rhythmicDensityHint, bucketed
   * לפי מספר האפשרויות.
   */
  rhythmPatternOptions?: Partial<Record<TrackRole, readonly RhythmStepPattern[]>>;
  /**
   * ⭐ 2026-08-27 (לוח-תווים אבסולוטי): undefined/false = התנהגות ישנה (שורש אקראי-לפי-seed,
   * mode נבחר לפי selectMode/allowedModes, buildLeadTrack דוגם motifSize תווים + שיקוף-סימטריה
   * לחצי-שני). true = השורש/מוד קבועים (mode כאן משמש ישירות ללא selectMode, root נקבע ל-
   * ABSOLUTE_BOARD_ROOT_PITCH_CLASS ב-composeMusicalScore) ו-buildLeadTrack דוגם ישירות את כל
   * intent.pitchContour על פני עמודות-זמן קבועות (COLUMNS_PER_BAR לבר, ראה noteBoard.ts) —
   * ללא motifSize, ללא applySymmetryTransform. משפיע רק על lead; בס/פאד ללא שינוי.
   */
  absoluteNoteBoard?: boolean;
  /**
   * ⭐ 2026-08-30 (הרחבת הלוח לשאר הסגנונות): שורש-הלוח (pitch class, 0=C) ומספר-השורות,
   * לסגנונות עם absoluteNoteBoard. undefined = ברירות-המחדל שב-noteBoard.ts, כך
   * שטראנס/האוס לא משתנים כלל. משפיע **רק** כש-absoluteNoteBoard דלוק.
   * ⚠️ מספר-השורות מהודק לטווח שפוי ע"י resolveBoardRowCount — ראה שם למה.
   */
  noteBoardRootPitchClass?: number;
  noteBoardRowCount?: number;
  /**
   * ⭐ 2026-08-31: מכפיל-עוצמה לכל פעימה בבר — "הלבוש" של הסגנון בזמן.
   *
   * ⚠️ זו **לא** תבנית-קצב, וההבחנה הזו היא כל העניין: היא לא קובעת מה מנגן ומה שותק
   * (זה נגזר מהציור בלבד), רק כמה חזק נשמע מה שכבר נבחר. כך האוס יכול להדגיש את ארבע
   * הפעימות בלי לכפות four-on-the-floor על ציור שלא צויר כך. undefined = DEFAULT_BEAT_ACCENTS.
   */
  beatAccents?: readonly number[];
  /**
   * ⭐ 2026-08-31 (שכבה ד'): גרידי-קוונטיזציה שהסגנון מרשה. הציור בוחר מתוכם לפי צפיפות
   * האירועים שלו. undefined = רק gridSubdivision הקבוע של הסגנון, כלומר בדיוק כמו קודם.
   * ⚠️ **לא** משנה את רזולוציית הלוח (COLUMNS_PER_BAR) — ראה subdivisionFromEventDensity.
   */
  allowedSubdivisions?: readonly GridSubdivision[];
  /** ⭐ 2026-08-31 (שכבה ב'): דריסות למדיניות-הקצב לפי תפקיד. ראה rolePolicy.ts. */
  rolePolicies?: Partial<Record<TrackRole, Partial<RhythmPolicy>>>;
  /**
   * ⭐ 2026-08-31 (סבב א'): מקצב תופים ידני שהמשתמש בחר. undefined = התופים נגזרים מהציור
   * בלבד, בדיוק כמו קודם. ראה beatPattern.ts להסבר על ההיברידיות.
   */
  beatPattern?: BeatPattern;
}

function midiToFrequencyHz(midiPitch: number): number {
  return 440 * Math.pow(2, (midiPitch - 69) / 12);
}

function sampleEvenly<T>(array: readonly T[], count: number): T[] {
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [at(array, 0)];
  }
  return Array.from({ length: count }, (_, index) => {
    const position = Math.round((index / (count - 1)) * (array.length - 1));
    return at(array, position);
  });
}

/**
 * ⭐ 2026-08-22: כל מיקומי ה"פגיעה" (hits>0) של תבנית ריתמית, פרושים על פני barCount
 * בארים (חוזר על התבנית כל בר) — ticks יחסית לתחילת הפריסה (בר 0 = תחילת הסקשן, לא
 * תחילת היצירה). משמש הן ל-bass (כל הפגיעות מנוגנות) והן ל-lead (נדגם מהן מספר-קבוע
 * התואם את motifSize, ראה buildLoopLeadNotes).
 */
function patternHitTicks(pattern: RhythmStepPattern, barCount: number): number[] {
  const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
  const hitStepIndices = pattern.hits
    .map((velocity, stepIndex) => (velocity > 0 ? stepIndex : null))
    .filter((stepIndex): stepIndex is number => stepIndex !== null);
  if (hitStepIndices.length === 0) {
    return [];
  }
  const ticks: number[] = [];
  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    for (const stepIndex of hitStepIndices) {
      ticks.push(barIndex * TICKS_PER_BAR + stepIndex * stepTicks);
    }
  }
  return ticks;
}

function yToMelodyDegree(y: number): number {
  const clampedY = Math.min(1, Math.max(0, y));
  return Math.round((1 - clampedY) * (MELODY_DEGREE_RANGE - 1)) + MELODY_DEGREE_OFFSET;
}

/**
 * מיישם את טרנספורמציית הסימטריה (§4.4) על מוטיב MIDI — רטרוגרד (סדר הפוך בזמן) ו/או
 * אינוורסיה (מרווחים הפוכים סביב התו הראשון, מוצמדים מחדש לסולם כי היפוך יכול לצאת מהסולם).
 */
function applySymmetryTransform(
  motif: readonly number[],
  transform: SymmetryTransform,
  root: number,
  mode: Mode,
): number[] {
  if (motif.length === 0) {
    return [];
  }
  const firstPitch = at(motif, 0);

  const inverted =
    transform === 'inversion' || transform === 'retrograde-inversion'
      ? motif.map((pitch) => snapToScale(2 * firstPitch - pitch, root, mode))
      : [...motif];

  const shouldReverse = transform === 'retrograde' || transform === 'retrograde-inversion';
  return shouldReverse ? [...inverted].reverse() : inverted;
}

function getHarmonicProgressionDegrees(
  barCount: number,
  chordProgression: readonly number[],
): number[] {
  return Array.from({ length: barCount }, (_, index) =>
    at(chordProgression, index % chordProgression.length),
  );
}

/**
 * ⭐ 2026-08-27 (לוח-תווים אבסולוטי — שלב 2): מחליף את getHarmonicProgressionDegrees
 * כש-absoluteNoteBoard דלוק — דרגת-הסולם של כל בר נגזרת ישירות ממיקום-Y של הצורה באותו בר
 * (כמו buildAbsoluteBoardMelody, ברזולוציית-בר במקום ברזולוציית-עמודה), לא ממחזור
 * chordProgression קבוע. buildBassTrack/buildPadTrack/buildSwellNotes/buildBuildSectionNotes
 * ממשיכים לצרוך את המערך הזה בדיוק כמו היום — שום שינוי אצלם.
 * ⚠️ `% 7` (לא הטווח המלא 0–14 כמו במלודיה): chooseSmoothVoicing/generateInversions
 * (voiceLeading.ts) יכולים להוסיף עד +24 חצי-טונים מעל הטריאדה הבסיסית כדי למזער תנועה
 * מהאקורד הקודם — עם דרגה עד 14 זה יכול לחרוג מ-ROLE_PITCH_RANGES.pad.max=84 (נבדק:
 * דרגה 14 → טריאדה [72,75,79] → inversion יוצא [79,84,87]). קיפול לאוקטבה אחת (0–6, בדיוק
 * הטווח שכבר בשימוש בטוח היום ע"י chordProgression הסטטי בכל קובצי ה-JSON) שומר על כל
 * מרווחי-הביטחון הקיימים בלי לגעת ב-voiceLeading/chords בכלל.
 */
function buildAbsoluteBoardProgressionDegrees(
  intent: RawMusicalIntent,
  barCount: number,
  rowCount?: number,
): number[] {
  // ⚠️ אותו מספר-שורות שהמלודיה משתמשת בו — אחרת ההרמוניה (בס/פאד) נגזרת מחלוקת-Y שונה
  // מזו של הלוח שהמשתמש רואה ומצייר עליו, והשניים יוצאים מסונכרנים.
  const resolvedRowCount = resolveBoardRowCount(rowCount);
  return sampleEvenly(intent.pitchContour, barCount).map(
    (y) => quantizeYToRowIndex(y, resolvedRowCount) % 7,
  );
}

function buildPadTrack(
  root: number,
  mode: Mode,
  progressionDegrees: readonly number[],
  extendedChords: boolean,
): Track {
  const notes: Note[] = [];
  let previousChord: number[] | null = null;

  progressionDegrees.forEach((degree, barIndex) => {
    const chord = buildChord(root, mode, degree, extendedChords);
    const voiced = chooseSmoothVoicing(previousChord, chord);
    previousChord = voiced;
    const startTick = barIndex * TICKS_PER_BAR;
    for (const pitch of voiced) {
      notes.push({
        startTick,
        durationTicks: TICKS_PER_BAR,
        pitch,
        velocity: 0.5,
        articulation: 'legato',
      });
    }
  });

  return {
    role: 'pad',
    instrumentId: 'default-pad',
    notes,
    // ⭐ 2026-08-25: 0.6→0.45, ⭐ 2026-08-27 (לפי בקשה חיה: "התופים עדיין לא בולטים מספיק"):
    // 0.45→0.4 — תופים כבר ב-volume:1 (התקרה של mixSettingsSchema, אי אפשר להעלות את זה
    // עוד), אז ה"הגברה היחסית" היחידה האפשרית היא להנמיך עוד קצת את שאר הכלים.
    mixSettings: { volume: 0.4, pan: 0, reverbSend: 0.3, delaySend: 0.1 },
  };
}

/**
 * ⭐ 2026-08-22: כשהסגנון מגדיר rhythmPatterns.bass, כל בר מנגן את פגיעות התבנית (במקום
 * "תו אחד לכל בר" קבוע) — זה מה שהופך "פועם 16th" (טראנס) ל-groove אמיתי שונה מ-"one-drop"
 * (רגאיי), בלי לגעת בהרמוניה (כל הפגיעות בתוך בר נתון עדיין ב-pitch של אקורד אותו בר).
 * בלי pattern (config.rhythmPatterns?.bass undefined) — נופל חזרה לתו-אחד-לכל-בר הישן.
 * ⭐ 2026-08-24: מקבל section (לא durationBars גלובלי) — startTick כבר אבסולוטי, אין יותר
 * shiftNotes נפרד אחרי הקריאה (ראה buildBassTrack).
 */
function buildLoopBassNotes(
  root: number,
  mode: Mode,
  progressionDegrees: readonly number[],
  section: Section,
  pattern: RhythmStepPattern | undefined,
  config: CompositionConfig,
  random: () => number,
): Note[] {
  // ⚠️ BASS_DEGREE_OFFSET מוסף ל-degreeIndex (לא ל-root!) — הוא נמדד ב"דרגות סולם" (7=אוקטבה),
  // בדיוק כמו MELODY_DEGREE_OFFSET. הוספה ישירה ל-root ב-semitones הייתה משנה את ה-pitch class
  // בפועל (offset שאינו כפולה של 12) ומייצרת תווים "בסולם" ביחס לשורש שגוי — לא ביחס ל-score.key.root.
  const rawPitches = progressionDegrees.map((degree) =>
    scaleDegreeToMidiPitch(root, mode, degree + BASS_DEGREE_OFFSET),
  );
  const smoothedPitches = smoothMelodicLine(rawPitches);

  const notes: Note[] = [];
  if (pattern) {
    const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
    const hitDurationTicks = Math.max(
      ticksPerGridUnit(config.gridSubdivision),
      quantizeToGrid(stepTicks * 0.85, config.gridSubdivision),
    );
    smoothedPitches.forEach((pitch, barIndex) => {
      pattern.hits.forEach((hitVelocity, stepIndex) => {
        if (hitVelocity <= 0) {
          return;
        }
        const rawStartTick = (section.startBar + barIndex) * TICKS_PER_BAR + stepIndex * stepTicks;
        const swungStartTick = applySwing(rawStartTick, config.gridSubdivision, config.swingAmount);
        const startTick = humanizeTiming(swungStartTick, config.tempoBpm, random);
        const velocity = humanizeVelocity(0.6 + hitVelocity * 0.3, random);
        notes.push({
          startTick,
          durationTicks: hitDurationTicks,
          pitch,
          velocity,
          articulation: 'staccato',
        });
      });
    });
  } else {
    smoothedPitches.forEach((pitch, barIndex) => {
      notes.push({
        startTick: (section.startBar + barIndex) * TICKS_PER_BAR,
        durationTicks: TICKS_PER_BAR,
        pitch,
        velocity: 0.7,
        articulation: 'staccato',
      });
    });
  }
  return notes;
}

/**
 * ⭐ 2026-08-24 (Area 4): בס מחוץ ל-loop — לא שקט, רק מצומצם: פעימת-שורש אחת לבר (ההרמוניה
 * הקיימת של הסקשן, ראה composeMusicalScore's fullProgressionDegrees), בעוצמה לפי
 * velocityScaleRamp (קבוע ל-intro/outro, עולה הדרגתית ל-build). בלי תת-חלוקות הקצב המלא
 * של ה-loop — זה מה ש"פחות מלא" אומר כאן, לא שקט.
 */
function buildRampedBassNotes(
  root: number,
  mode: Mode,
  sectionProgressionDegrees: readonly number[],
  section: Section,
  velocityScaleRamp: (progress: number) => number,
  random: () => number,
): Note[] {
  const barCount = Math.max(1, sectionProgressionDegrees.length);
  return sectionProgressionDegrees.map((degree, barOffset) => {
    const progress = (barOffset + 1) / barCount;
    const pitch = scaleDegreeToMidiPitch(root, mode, degree + BASS_DEGREE_OFFSET);
    return {
      startTick: (section.startBar + barOffset) * TICKS_PER_BAR,
      durationTicks: TICKS_PER_BAR,
      pitch,
      velocity: humanizeVelocity(0.7 * velocityScaleRamp(progress), random),
      articulation: 'legato',
    };
  });
}

/**
 * ⭐ 2026-08-24: בונה את טראק הבס המלא — loop (groove מלא, ללא שינוי מהתנהגות הישנה) +
 * intro/build/outro (buildRampedBassNotes, Area 4) — כל הסקשנים ביחד, לא רק loop+shift.
 */
function buildBassTrack(
  root: number,
  mode: Mode,
  sections: readonly Section[],
  fullProgressionDegrees: readonly number[],
  pattern: RhythmStepPattern | undefined,
  config: CompositionConfig,
  random: () => number,
): Track {
  const notes: Note[] = [];
  for (const section of sections) {
    const sectionDegrees = fullProgressionDegrees.slice(
      section.startBar,
      section.startBar + section.lengthBars,
    );
    if (section.name === 'loop') {
      notes.push(
        ...buildLoopBassNotes(root, mode, sectionDegrees, section, pattern, config, random),
      );
    } else if (section.name === 'build') {
      notes.push(
        ...buildRampedBassNotes(
          root,
          mode,
          sectionDegrees,
          section,
          BUILD_RAMP.velocityScale,
          random,
        ),
      );
    } else {
      notes.push(
        ...buildRampedBassNotes(
          root,
          mode,
          sectionDegrees,
          section,
          EDGE_RAMP.velocityScale,
          random,
        ),
      );
    }
  }

  return {
    role: 'bass',
    instrumentId: 'default-bass',
    notes,
    // ⭐ 2026-08-25: 0.8→0.65, ⭐ 2026-08-27 (לפי בקשה חיה): 0.65→0.58 — אותה סיבה כמו
    // buildPadTrack (מפנה מקום-תדר/עוצמה לתופים, volume:1, שחולקים איתו טווח-תדרים נמוך).
    mixSettings: { volume: 0.58, pan: 0, reverbSend: 0, delaySend: 0 },
  };
}

/**
 * ⭐ 2026-08-22: מספר-התווים תמיד מהצורה (§4.5, fullMelody.length לא משתנה) — הסגנון
 * משפיע רק על *מיקומם* בזמן: כשיש rhythmPatterns.lead, אותם תווים "נדגמים" (sampleEvenly)
 * אל תוך מיקומי-הפגיעה הסינקופטיים של הסגנון, במקום חלוקה שווה גנרית. בלי pattern —
 * נופל לחלוקה השווה הישנה. ⭐ 2026-08-24: מקבל section — startTick אבסולוטי מההתחלה,
 * אין יותר shiftNotes נפרד (ראה buildLeadTrack).
 */
function buildLoopLeadNotes(
  fullMelody: readonly number[],
  section: Section,
  intent: RawMusicalIntent,
  config: CompositionConfig,
  random: () => number,
): Note[] {
  const totalTicks = section.lengthBars * TICKS_PER_BAR;
  const noteCount = fullMelody.length;
  const evenSlotTicks = noteCount > 0 ? totalTicks / noteCount : totalTicks;
  const isStaccato = intent.articulation === 'staccato';
  // ⭐ 2026-08-25 (מגוון מוזיקלי לפי-צורה): durationHint (מורכבות-מתאר, geometryToMusic.ts)
  // מערבב את gapRatio לגרדיאנט רציף בתוך כל טווח — לא רק מתג בינארי staccato/legato כמו קודם.
  const gapRatio = isStaccato
    ? lerp(0.25, 0.55, intent.durationHint)
    : lerp(0.75, 0.98, intent.durationHint);
  const sectionStartTicks = section.startBar * TICKS_PER_BAR;

  const patternTicks = config.rhythmPatterns?.lead
    ? patternHitTicks(config.rhythmPatterns.lead, section.lengthBars)
    : [];
  const startTicksRaw =
    patternTicks.length >= noteCount && noteCount > 0
      ? sampleEvenly(patternTicks, noteCount)
      : Array.from({ length: noteCount }, (_, index) => index * evenSlotTicks);

  return fullMelody.map((pitch, index) => {
    const rawStartTick = sectionStartTicks + at(startTicksRaw, index);
    const nextRawStartTick =
      index + 1 < startTicksRaw.length
        ? sectionStartTicks + at(startTicksRaw, index + 1)
        : rawStartTick + evenSlotTicks;
    const gapTicks = Math.max(1, nextRawStartTick - rawStartTick);
    const quantizedStartTick = quantizeToGrid(rawStartTick, config.gridSubdivision);
    const swungStartTick = applySwing(
      quantizedStartTick,
      config.gridSubdivision,
      config.swingAmount,
    );
    const startTick = humanizeTiming(swungStartTick, config.tempoBpm, random);
    const durationTicks = Math.max(
      ticksPerGridUnit(config.gridSubdivision),
      quantizeToGrid(gapTicks * gapRatio, config.gridSubdivision),
    );
    const velocity = humanizeVelocity(0.4 + intent.velocityHint * 0.5, random);

    return { startTick, durationTicks, pitch, velocity, articulation: intent.articulation };
  });
}

/**
 * ⭐ 2026-08-24 (Area 4, מתוקן — ראה הערת SectionEnergyRamp): lead מחוץ ל-loop — לא שקט,
 * *כל* המוטיב המצויר (fullMelody, אותה כמות-תווים בדיוק כמו ה-loop לאורך הזה — ראה
 * buildLoopLeadNotes), רק דחוס לאורך הסקשן הקצר, רך יותר, אוקטבה נמוכה יותר. זה מבטיח
 * תנועה מלודית אמיתית תמיד — גם בסקשן-קצה של בר אחד בודד (המקרה הנפוץ ביותר, ציור פשוט) —
 * במקום לקרוס ל"תו יחיד ממושך" (שנשמע כמו ה-pad swell הישן).
 */
function buildRampedLeadNotes(
  fullMelody: readonly number[],
  section: Section,
  ramp: SectionEnergyRamp,
  intent: RawMusicalIntent,
  config: CompositionConfig,
  random: () => number,
): Note[] {
  if (fullMelody.length === 0 || section.lengthBars <= 0) {
    return [];
  }
  const totalTicks = section.lengthBars * TICKS_PER_BAR;
  const noteCount = fullMelody.length;
  const evenSlotTicks = totalTicks / noteCount;
  const gapRatio = intent.articulation === 'staccato' ? 0.6 : 0.95;
  const sectionStartTicks = section.startBar * TICKS_PER_BAR;

  return fullMelody.map((pitch, index) => {
    const progress = (index + 1) / noteCount;
    const registerOffsetSemitones = Math.round(ramp.registerOffsetSemitones(progress));
    const shiftedPitch = wrapPitchIntoRealisticRange(
      pitch + registerOffsetSemitones,
      LEAD_REALISTIC_RANGE,
    );
    const rawStartTick = sectionStartTicks + index * evenSlotTicks;
    const quantizedStartTick = quantizeToGrid(rawStartTick, config.gridSubdivision);
    const startTick = humanizeTiming(quantizedStartTick, config.tempoBpm, random);
    const durationTicks = Math.max(
      ticksPerGridUnit(config.gridSubdivision),
      quantizeToGrid(evenSlotTicks * gapRatio, config.gridSubdivision),
    );
    const velocity = humanizeVelocity(
      (0.4 + intent.velocityHint * 0.5) * ramp.velocityScale(progress),
      random,
    );
    return { startTick, durationTicks, pitch: shiftedPitch, velocity, articulation: 'legato' };
  });
}

/**
 * הנתיב הישן (ללא absoluteNoteBoard): motifSize תווים מדוגמים מ-pitchContour, ועם סימטריה —
 * חצי-שני משוקף אלגוריתמית (applySymmetryTransform) במקום נדגם מהציור. ⚠️ ללא שינוי מהתנהגות
 * הקודמת — משמש כל סגנון שלא הוגדר לו absoluteNoteBoard.
 */
function buildLegacyMelody(intent: RawMusicalIntent, root: number, mode: Mode): number[] {
  const hasSecondPhrase = intent.symmetryTransform !== 'none';
  const sampledY = sampleEvenly(intent.pitchContour, intent.motifSize);
  // ⭐ 2026-08-25 (טווח-מלודיה רחב יותר): wrap כאן (לא רק ב-buildRampedLeadNotes כמו קודם) —
  // עם MELODY_DEGREE_RANGE=15 (היה 8), applySymmetryTransform's inversion (2*firstPitch-pitch)
  // יכול לצאת הרחק מחוץ ל-LEAD_REALISTIC_RANGE בלי זה.
  const primaryMotif = sampledY
    .map((y) => scaleDegreeToMidiPitch(root, mode, yToMelodyDegree(y)))
    .map((pitch) => wrapPitchIntoRealisticRange(pitch, LEAD_REALISTIC_RANGE));
  const secondaryMotif = hasSecondPhrase
    ? applySymmetryTransform(primaryMotif, intent.symmetryTransform, root, mode).map((pitch) =>
        wrapPitchIntoRealisticRange(pitch, LEAD_REALISTIC_RANGE),
      )
    : [];
  return hasSecondPhrase ? [...primaryMotif, ...secondaryMotif] : primaryMotif;
}

/**
 * ⭐ 2026-08-27 (לוח-תווים אבסולוטי): דוגם ישירות את כל intent.pitchContour על פני
 * COLUMNS_PER_BAR עמודות לכל בר של סקשן ה-loop (אורך-הלולאה כבר נגזר מהצורה, sizeHint/
 * motifSize, למעלה ב-composeMusicalScore) — כל עמודה מקבלת תו אחד מ-noteBoardRows הקבוע,
 * לפי מיקום-Y בפועל. אין motifSize, אין שיקוף-סימטריה: כל תו נדגם ישירות מהתוואי שצויר.
 *
 * ⭐ 2026-08-28 (לפי בקשה חיה: "חירחורי-סאונד בנייד", טראנס/האוס בלבד): בלי הסינון למטה,
 * הפונקציה הזו הייתה מזינה תמיד 16 תווים/בר ברצף, לכל אורך היצירה — קצב-הפעלה גבוה
 * ורציף (תו כל ~100-130ms ללא הפסקה) שלא היה קיים במנוע הישן (fullMelody.length שם היה
 * motifSize, נמוך בהרבה). בס/פאד/תופים כבר מוגבלים לפגיעות תבנית-הקצב *שלהם* — המנגינה
 * הייתה היחידה שהתעלמה מ-config.rhythmPatterns.lead (קיים בדיוק לשם כך, נבחר לפי
 * rhythmicDensityHint — טראנס למשל מגדיר 16/8/4 פגיעות-לבר). מסננים כאן לעמודות שבהן
 * לתבנית יש פגיעה בפועל — אותו פיץ' מדויק בכל עמודה שנשארת (אין שינוי-תוכן), רק פחות
 * מהן הופכות לתו מושמע כשהסגנון/הצורה קוראים לגרוב דליל יותר. ⚠️ לא נוגעים ב-
 * buildLoopLeadNotes/buildRampedLeadNotes: הן כבר מסתנכרנות ל-patternHitTicks כשהאורך
 * תואם בדיוק (מוודא את זה ב-harmonyEngine.test.ts) — פחות תווים בקלט = פחות דחיסה גם
 * ב-intro/build/outro, בלי שינוי נוסף שם.
 */
function buildAbsoluteBoardMelody(
  intent: RawMusicalIntent,
  root: number,
  mode: Mode,
  sections: readonly Section[],
  config: CompositionConfig,
): number[] {
  const loopSection = sections.find((section) => section.name === 'loop');
  const totalColumns = Math.max(1, (loopSection?.lengthBars ?? 1) * COLUMNS_PER_BAR);
  // ⭐ 2026-08-30: מספר-השורות מגיע מהסגנון (undefined = ברירת המחדל). הקוונטיזציה למטה
  // כבר נגזרת מ-noteBoardRows.length, ולכן היא מסתגלת מאליה — אין כאן קבוע נוסף לעדכן.
  const noteBoardRows = buildNoteBoardRows(root, mode, config.noteBoardRowCount);
  const allColumnPitches = sampleEvenly(intent.pitchContour, totalColumns).map((y) =>
    at(noteBoardRows, quantizeYToRowIndex(y, noteBoardRows.length)),
  );
  const leadPattern = config.rhythmPatterns?.lead;
  if (!leadPattern || leadPattern.hits.every((hitVelocity) => hitVelocity <= 0)) {
    return allColumnPitches;
  }
  return allColumnPitches.filter(
    (_, index) => at(leadPattern.hits, index % leadPattern.hits.length) > 0,
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ⭐ 2026-08-31 — "הסורק מנגן את התאים שהציור עובר עליהם"
 *
 * הנתיב הזה מחליף את buildAbsoluteBoardMelody לסגנונות עם absoluteNoteBoard: במקום ערך-Y
 * יחיד לעמודה (שחייב מיצוע, ולכן קרס לתו בודד בכל צורה סגורה — ראה boardRaster.ts),
 * הציור נצרב על הלוח וכל תא שנחצה מנוגן.
 *
 * §4.5 ("הסגנון קובע לבוש") נשמר, אבל הגבול זז: הציור קובע **אילו** תאים מנגנים ומתי;
 * הסגנון קובע רק **איך הם יושבים בזמן** — קוונטיזציה לגריד, סווינג, והדגשת-עוצמה על
 * הפעימות החזקות. אף תבנית-קצב לא נכפית יותר על הליד.
 * ───────────────────────────────────────────────────────────────────────────── */

/** ⚠️ תקרת תווים בו-זמנית לעמודה. ראה limitVoices ב-boardRaster.ts. */
const MAX_VOICES_PER_COLUMN = 3;
/** לכל היותר כמה תווים באקורד-פאד של בר. */
const MAX_PAD_VOICES_PER_BAR = 4;
const COLUMNS_PER_BEAT = COLUMNS_PER_BAR / DEFAULT_TIME_SIGNATURE[0];

/**
 * הדגשת-עוצמה לפי פעימה בבר — "הלבוש" של הסגנון בזמן. ⚠️ זה **לא** מקצב: הוא לא קובע מה
 * מנגן ומה שותק, רק כמה חזק נשמע מה שהציור כבר בחר. בלי זה, ציור שיוצא בדיוק על הגריד
 * נשמע שטוח ומכני; איתו הוא "יושב" בתוך הסגנון בלי שנכפה עליו גרוב.
 */
const DEFAULT_BEAT_ACCENTS = [1, 0.82, 0.92, 0.86];

/** רצף עמודות סמוכות שבהן אותה שורה נחצתה — קו אופקי הופך לתו מוחזק, לא ל-32 חזרות. */
interface RasterRun {
  row: number;
  startColumn: number;
  endColumn: number;
}

/**
 * ⚠️ המיזוג הזה הוא מה שהופך את הרסטר למוזיקה ולא למקלע: קו ישר אופקי חוצה את אותה שורה
 * בכל עמודה, ובלי מיזוג הוא היה מייצר תו-16 חוזר לכל אורך היצירה. עם מיזוג — תו אחד ארוך,
 * בדיוק כמו קריאה של piano-roll. ממילא גם מוריד דרמטית את מספר התווים לרינדור.
 */
function extractRasterRuns(raster: BoardRaster): RasterRun[] {
  const openRuns = new Map<number, number>();
  const runs: RasterRun[] = [];

  raster.forEach((rows, column) => {
    const present = new Set(rows);
    for (const [row, startColumn] of [...openRuns]) {
      if (!present.has(row)) {
        runs.push({ row, startColumn, endColumn: column - 1 });
        openRuns.delete(row);
      }
    }
    for (const row of rows) {
      if (!openRuns.has(row)) {
        openRuns.set(row, column);
      }
    }
  });

  const lastColumn = raster.length - 1;
  for (const [row, startColumn] of openRuns) {
    runs.push({ row, startColumn, endColumn: lastColumn });
  }
  return runs.sort((a, b) => a.startColumn - b.startColumn || a.row - b.row);
}

function beatAccentFor(config: CompositionConfig, column: number): number {
  const accents = config.beatAccents ?? DEFAULT_BEAT_ACCENTS;
  if (accents.length === 0) {
    return 1;
  }
  const beatInBar = Math.floor((column % COLUMNS_PER_BAR) / COLUMNS_PER_BEAT);
  return at(accents, beatInBar % accents.length);
}

/**
 * עוצמה יחסית לפי הסקשן שהבר נמצא בו — intro נכנס רך, build עולה, outro דועך. הציור נקרא
 * פעם אחת על פני כל היצירה, ולכן הדינמיקה של המבנה מגיעה מכאן ולא מחזרה על המוטיב.
 */
function sectionVelocityScale(sections: readonly Section[], barIndex: number): number {
  const section = sections.find(
    (candidate) =>
      barIndex >= candidate.startBar && barIndex < candidate.startBar + candidate.lengthBars,
  );
  if (!section || section.name === 'loop') {
    return 1;
  }
  const progress =
    section.lengthBars <= 1 ? 1 : (barIndex - section.startBar) / (section.lengthBars - 1);
  if (section.name === 'build') {
    return BUILD_ENTRY_VELOCITY_SCALE + (1 - BUILD_ENTRY_VELOCITY_SCALE) * progress;
  }
  return section.name === 'intro' ? 0.62 + 0.28 * progress : 0.9 - 0.3 * progress;
}

/**
 * ⚠️ נדידת-גובה שמעליה נפתח תו חדש (שכבה א', onsetEvents.ts). 2 שורות = בערך צליל שלם
 * בסולם: מתחת לזה השינוי קטן מכדי להצדיק מכה חדשה, ומעליו החזקת התו הישן כבר משקרת
 * לגבי מה שצויר.
 */
const ONSET_DRIFT_ROWS = 2;

/** צורב את הציור על פני **כל** אורך היצירה — הציור נשמע פעם אחת, משמאל לימין. */
function buildBoardRasterForScore(
  intent: RawMusicalIntent,
  config: CompositionConfig,
  totalDurationBars: number,
): BoardRaster | null {
  if (!intent.shapePaths || intent.shapePaths.length === 0) {
    return null;
  }
  return rasterizeShapeToBoard(intent.shapePaths, {
    rowCount: resolveBoardRowCount(config.noteBoardRowCount),
    columnCount: Math.max(1, totalDurationBars * COLUMNS_PER_BAR),
    maxVoicesPerColumn: MAX_VOICES_PER_COLUMN,
  });
}

/**
 * ⭐ שכבה ג' — טמפו מהציור. `intent.rhythmicDensityHint` (vertexCount/64) נמדד ותפס רק
 * 0.08–0.20 מהטווח שלו, ולכן הטמפו נחת על אותו ערך כמעט תמיד (2 ערכים שונים ב-120 ציורים).
 * צפיפות-האירועים לבר היא אות שבאמת משתנה, ולכן היא מחליפה אותו כאן.
 * ⚠️ ה-hint הישן **נשאר במקומו** — הוא עדיין מזין את בחירת-התבניות בנתיב הישן (רגאיי).
 */
const EVENTS_PER_BAR_AT_MIN_TEMPO = 2;
const EVENTS_PER_BAR_AT_MAX_TEMPO = 14;

function tempoFromEventDensity(
  eventsPerBar: number,
  tempoRange: { min: number; max: number },
): number {
  const span = EVENTS_PER_BAR_AT_MAX_TEMPO - EVENTS_PER_BAR_AT_MIN_TEMPO;
  const normalized = Math.min(1, Math.max(0, (eventsPerBar - EVENTS_PER_BAR_AT_MIN_TEMPO) / span));
  return Math.round(lerp(tempoRange.min, tempoRange.max, normalized));
}

/**
 * ⭐ שכבה ד' — הציור בוחר את **גריד הקוונטיזציה**, לא את רזולוציית הלוח.
 *
 * ⚠️ ההבחנה הזו קריטית: הלוח שהמשתמש מצייר עליו נשאר תמיד COLUMNS_PER_BAR (16). אילו
 * הציור היה קובע את מספר העמודות, הרשת שהוא ראה בזמן הציור כבר לא הייתה תואמת למה
 * שמתנגן — וזו גם לולאה לוגית, כי הרשת מוצגת לפני שיש ציור. כאן משתנה רק **הצמדת הזמן**.
 */
function subdivisionFromEventDensity(
  eventsPerBar: number,
  allowed: readonly GridSubdivision[],
): GridSubdivision {
  const preferred: GridSubdivision = eventsPerBar < 3 ? 8 : eventsPerBar > 9 ? 32 : 16;
  return allowed.includes(preferred) ? preferred : at(allowed, allowed.length - 1);
}

/**
 * ⭐ שכבה ב' — מסננת את מכות-הציור דרך מדיניות התפקיד ומחזירה את מה ששרד, כולל עמודת-
 * ההתחלה **אחרי** ההצמדה לגריד של אותו תפקיד.
 *
 * ⚠️ אין כאן שום יצירת-מכה: כל פלט נגזר מ-run שהציור ייצר. זה מה שמאפשר לבדיקה לאמת
 * שהזמנים של כל תפקיד הם תת-קבוצה של אירועי הציור (ראה rolePolicy.ts).
 */
interface SelectedRun {
  run: RasterRun;
  startColumn: number;
  strength: number;
}

function selectRunsByPolicy(
  runs: readonly RasterRun[],
  strengthByColumn: readonly number[],
  policy: RhythmPolicy,
  minimumHits: number,
): SelectedRun[] {
  const candidateByColumn = new Map<number, number>();
  for (const run of runs) {
    const strength = strengthByColumn[run.startColumn] ?? 0;
    candidateByColumn.set(
      run.startColumn,
      Math.max(candidateByColumn.get(run.startColumn) ?? 0, strength),
    );
  }
  const candidates = [...candidateByColumn.entries()].map(([column, strength]) => ({
    column,
    strength,
  }));

  const selections = applyPolicyWithFloor(candidates, policy, minimumHits);
  const bySource = new Map(selections.map((selection) => [selection.sourceColumn, selection]));

  const selected: SelectedRun[] = [];
  for (const run of runs) {
    const selection = bySource.get(run.startColumn);
    if (!selection) {
      continue;
    }
    selected.push({ run, startColumn: selection.column, strength: selection.strength });
  }
  return selected;
}

/**
 * ⚠️ **הומניזציה אחת לכל עמודה, לא לכל תו.** כמה תווים שנפתחים באותה עמודה הם אקורד —
 * מחווה אחת של היד — וריצוד עצמאי לכל אחד מהם היה מפזר אותם על פני מילישניות בודדות.
 * זה גם נשמע רופף וגם מסוכן: קול מונופוני שמקבל שני תווים במרחק 1–4ms מתנגש אחרי הצמדת
 * בלוק-העיבוד (ראה MONOPHONIC_MIN_SEPARATION_SECONDS ב-SynthProvider.ts). עם מטמון-לעמודה
 * אקורד נוחת בזמן **זהה** בדיוק — מקרה שההגנה שם מטפלת בו נקי.
 */
type ColumnTimingCache = Map<number, number>;

function runToNote(
  run: RasterRun,
  startColumn: number,
  pitch: number,
  baseVelocity: number,
  sustainRatio: number,
  sections: readonly Section[],
  config: CompositionConfig,
  random: () => number,
  articulation: NonNullable<Note['articulation']>,
  timingCache: ColumnTimingCache,
): Note {
  const columnTicks = TICKS_PER_BAR / COLUMNS_PER_BAR;
  const rawStartTick = startColumn * columnTicks;
  // ⚠️ המפתח הוא הטיק **אחרי** קוונטיזציה וסווינג, לא העמודה הגולמית: כשהגריד גס מהלוח
  // (למשל קוונטיזציה לשמיניות מול 16 עמודות בבר) שתי עמודות שונות נופלות על אותו טיק,
  // ואז מפתוח-לפי-עמודה היה נותן להן ריצוד שונה ומפזר אותן במילישניות בודדות — בדיוק
  // ההתנגשות שהמטמון הזה נועד למנוע. נמדד: 84 זוגות כאלה בסינמטי לפני התיקון.
  const quantizedStartTick = quantizeToGrid(rawStartTick, config.gridSubdivision);
  const swungStartTick = applySwing(quantizedStartTick, config.gridSubdivision, config.swingAmount);
  const cached = timingCache.get(swungStartTick);
  let startTick: number;
  if (cached !== undefined) {
    startTick = cached;
  } else {
    startTick = humanizeTiming(swungStartTick, config.tempoBpm, random);
    timingCache.set(swungStartTick, startTick);
  }

  const spannedColumns = run.endColumn - run.startColumn + 1;
  const durationTicks = Math.max(
    ticksPerGridUnit(config.gridSubdivision),
    quantizeToGrid(spannedColumns * columnTicks * sustainRatio, config.gridSubdivision),
  );

  const barIndex = Math.floor(startColumn / COLUMNS_PER_BAR);
  const scaled =
    baseVelocity * beatAccentFor(config, startColumn) * sectionVelocityScale(sections, barIndex);
  const velocity = humanizeVelocity(Math.min(1, Math.max(0.05, scaled)), random);

  return { startTick, durationTicks, pitch, velocity, articulation };
}

/** ליד — אירועי הציור, אחרי מדיניות-הקצב של התפקיד. */
function buildRasterLeadNotes(
  raster: BoardRaster,
  strengthByColumn: readonly number[],
  boardRows: readonly number[],
  sections: readonly Section[],
  intent: RawMusicalIntent,
  config: CompositionConfig,
  random: () => number,
): Note[] {
  const isStaccato = intent.articulation === 'staccato';
  const sustainRatio = isStaccato
    ? lerp(0.3, 0.6, intent.durationHint)
    : lerp(0.8, 0.98, intent.durationHint);
  const baseVelocity = 0.45 + intent.velocityHint * 0.45;
  const policy = resolveRolePolicy('lead', config.rolePolicies);
  const timingCache: ColumnTimingCache = new Map();
  const barCount = Math.max(1, Math.ceil(raster.length / COLUMNS_PER_BAR));

  return selectRunsByPolicy(extractRasterRuns(raster), strengthByColumn, policy, barCount).map(
    ({ run, startColumn, strength }) =>
      runToNote(
        run,
        startColumn,
        wrapPitchIntoRealisticRange(at(boardRows, run.row), LEAD_REALISTIC_RANGE),
        baseVelocity * (0.75 + strength * 0.35),
        sustainRatio,
        sections,
        config,
        random,
        intent.articulation,
        timingCache,
      ),
  );
}

/**
 * בס — השורה **הנמוכה ביותר** שנחצתה בכל עמודה, ממוזגת לרצפים. ⚠️ לא "תו בכל פעימה":
 * גם הבס נגזר מהציור בלבד, ולכן קטע שהמשתמש לא צייר בו נשאר שקט גם בבס.
 */
function buildRasterBassNotes(
  raster: BoardRaster,
  strengthByColumn: readonly number[],
  progressionDegrees: readonly number[],
  root: number,
  mode: Mode,
  sections: readonly Section[],
  intent: RawMusicalIntent,
  config: CompositionConfig,
  random: () => number,
): Note[] {
  const lowestPerColumn: BoardRaster = raster.map((rows) => (rows.length > 0 ? [at(rows, 0)] : []));
  const policy = resolveRolePolicy('bass', config.rolePolicies);
  const timingCache: ColumnTimingCache = new Map();
  const barCount = Math.max(1, Math.ceil(raster.length / COLUMNS_PER_BAR));

  return selectRunsByPolicy(
    extractRasterRuns(lowestPerColumn),
    strengthByColumn,
    policy,
    barCount,
  ).map(({ run, startColumn }) =>
    runToNote(
      run,
      startColumn,
      // ⚠️ **הגובה מהאקורד, הקצב מהציור** (סבב ב'). קודם הבס ניגן את השורה הנמוכה שנחצתה —
      // תו-סולם שרירותי שלא מגדיר שום הרמוניה. הבס הוא מה שקובע לאוזן *מהו* האקורד, ולכן
      // הוא חייב לנגן את השורש שלו; בלי זה הפאד יכול לנגן אקורד תקין והאוזן עדיין לא תשמע
      // פונקציה הרמונית. הקצב, לעומת זאת, נשאר נגזר-ציור לגמרי דרך מדיניות-הקצב למעלה —
      // כך שהציור עדיין מוטבע בבס.
      wrapPitchIntoRealisticRange(
        scaleDegreeToMidiPitch(
          root,
          mode,
          degreeAtBar(progressionDegrees, Math.floor(startColumn / COLUMNS_PER_BAR)),
        ),
        ROLE_PITCH_RANGES.bass ?? LEAD_REALISTIC_RANGE,
      ),
      0.62 + intent.velocityHint * 0.2,
      0.92,
      sections,
      config,
      random,
      'legato',
      timingCache,
    ),
  );
}

/**
 * פאד — **אקורד אמיתי** לכל בר, על הדרגה שהציור נתן לאותו בר.
 *
 * ⚠️ **תיקון 2026-08-31 (סבב ב').** קודם הפאד ניגן פשוט את השורות שהציור חצה בבר, מדולל
 * ל-4 קולות. נמדד בסינמטי: `C E F A` — כלומר F מול E, חצי טון. זה **צביר, לא אקורד**: אין
 * בו פונקציה הרמונית, אין מתח ואין פתרון, ולעיתים הוא פשוט צורם. גרוע מזה — `buildChord`
 * ו-`chooseSmoothVoicing` כבר היו קיימים בקוד, בדוקים, ובשימוש בנתיב הישן; נתיב הרסטר פשוט
 * **עקף** אותם.
 *
 * ⚠️ העיקרון נשמר: **הדרגה מגיעה מהציור** (buildAbsoluteBoardProgressionDegrees), והאקורד
 * הוא הלבוש התיאורטי שלה — אותה משפחה כמו קוונטיזציה והדגשות-פעימה. בר שהציור לא נגע בו
 * נשאר שקט, בדיוק כמו קודם.
 *
 * ⚠️ `chooseSmoothVoicing` מקבל את האקורד הקודם ולכן מחבר ביניהם בתנועה מינימלית — זה מה
 * שהופך רצף אקורדים ל"התקדמות" ולא לסדרת קפיצות.
 */
function buildRasterPadNotes(
  raster: BoardRaster,
  boardRows: readonly number[],
  progressionDegrees: readonly number[],
  root: number,
  mode: Mode,
  sections: readonly Section[],
  extendedChords: boolean,
): Note[] {
  const notes: Note[] = [];
  const padRange = ROLE_PITCH_RANGES.pad ?? LEAD_REALISTIC_RANGE;
  const barCount = Math.ceil(raster.length / COLUMNS_PER_BAR);
  let previousChord: number[] | null = null;

  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    // "האם הציור נגע בבר הזה" נשאר התנאי לשקט — הפאד לא ממציא הרמוניה בקטע ריק.
    let lowestRow: number | null = null;
    for (let offset = 0; offset < COLUMNS_PER_BAR; offset += 1) {
      const first = (raster[barIndex * COLUMNS_PER_BAR + offset] ?? [])[0];
      if (first !== undefined && (lowestRow === null || first < lowestRow)) {
        lowestRow = first;
      }
    }
    if (lowestRow === null) {
      continue;
    }

    const chord = buildChord(root, mode, degreeAtBar(progressionDegrees, barIndex), extendedChords);
    const voiced = chooseSmoothVoicing(previousChord, chord);
    previousChord = voiced;

    // ⚠️ **הרגיסטר בא מהציור.** הדרגה מקופלת ב-`% 7`, ולכן שני ציורים במרחק אוקטבה מקבלים
    // בצדק את אותה פונקציה הרמונית — אבל בלי העיגון הזה הם היו גם נשמעים זהים לחלוטין,
    // כי גובה האקורד נקבע רק ע"י voice leading. כאן האקורד מוזז באוקטבות שלמות (השרשור
    // ההרמוני נשמר; רק הגובה זז) כך שהוא יושב סביב הגובה שהמשתמש באמת צייר בבר הזה.
    const anchorPitch = at(boardRows, Math.min(lowestRow, boardRows.length - 1));
    const lowestVoiced = Math.min(...voiced);
    const octaveShift = Math.round((anchorPitch - lowestVoiced) / 12) * 12;

    const velocity = 0.5 * sectionVelocityScale(sections, barIndex);
    for (const pitch of voiced.slice(0, MAX_PAD_VOICES_PER_BAR)) {
      notes.push({
        startTick: barIndex * TICKS_PER_BAR,
        durationTicks: TICKS_PER_BAR,
        pitch: wrapPitchIntoRealisticRange(pitch + octaveShift, padRange),
        velocity: Math.min(1, Math.max(0.05, velocity)),
        articulation: 'legato',
      });
    }
  }
  return notes;
}

/**
 * תופים — אותם תאים בדיוק, אבל נקראים כ**כלי ערכה** לפי גובה (drumKit.ts) במקום כגובה-צליל.
 *
 * ⚠️ פגיעה רק ב**תחילת** רצף, לא בכל עמודה שלו: קו אופקי מוחזק הוא צליל אחד ארוך, ולכן
 * גם מכה אחת — לא גלגול רצוף. כך זיגזג (הרבה רצפים קצרים) מייצר גרוב צפוף וקו חלק מייצר
 * מכות בודדות, וזה בדיוק ההבדל שהמשתמש מצייר.
 *
 * ⚠️ ה-pitch נשאר נגזר-סולם מהשורה — ראה ההסבר ב-drumKit.ts למה לא GM.
 */
/**
 * מקצב ידני → תווים. ⚠️ לא עובר דרך מדיניות-הקצב ולא דרך אירועי-הציור: זו כל הנקודה —
 * המשתמש ביקש גרוב **קבוע** שנותן לסגנון את הזהות שלו, ולא עוד משהו שהציור מזיז.
 * ההומניזציה והסווינג של הסגנון כן חלים, אחרת המקצב נשמע כמו מכונה ולא כמו נגן.
 */
function buildPatternDrumNotes(
  pattern: BeatPattern,
  root: number,
  mode: Mode,
  sections: readonly Section[],
  totalDurationBars: number,
  config: CompositionConfig,
  random: () => number,
): Note[] {
  const notes: Note[] = [];
  const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
  const hitDurationTicks = ticksPerGridUnit(config.gridSubdivision);
  const barHits = beatHitsForBar(pattern);
  // ⚠️ **אותו מטמון-תזמון כמו ב-runToNote, ומאותה סיבה בדיוק.** כשהגריד גס מהתבנית (מקצב
  // בשש-עשרות בהאוס, שמרשה קוונטיזציה לשמיניות) שתי פגיעות סמוכות נופלות על אותו טיק —
  // ובלי מטמון כל אחת מקבלת ריצוד-הומניזציה משלה ונוחתת מילישניות ספורות מהשנייה. זה מרחק
  // שעובר את הגנת-הדילוג אבל נצמד לאותו בלוק-עיבוד, ואז `Tone.Source.start` זורק ומפיל את
  // כל הרינדור. נמדד: 930 זוגות כאלה במקצב `jackin` לבדו.
  const timingCache: ColumnTimingCache = new Map();

  for (let barIndex = 0; barIndex < totalDurationBars; barIndex += 1) {
    const barStartTick = barIndex * TICKS_PER_BAR;
    const sectionScale = sectionVelocityScale(sections, barIndex);
    for (const hit of barHits) {
      const rawStartTick = barStartTick + hit.step * stepTicks;
      const swungStartTick = applySwing(
        quantizeToGrid(rawStartTick, config.gridSubdivision),
        config.gridSubdivision,
        config.swingAmount,
      );
      const cached = timingCache.get(swungStartTick);
      const startTick = cached ?? humanizeTiming(swungStartTick, config.tempoBpm, random);
      timingCache.set(swungStartTick, startTick);
      const pitch = wrapPitchIntoRealisticRange(
        scaleDegreeToMidiPitch(root, mode, DRUM_PIECE_DEGREE_OFFSET[hit.piece]),
        ROLE_PITCH_RANGES.drums ?? LEAD_REALISTIC_RANGE,
      );
      const scaled = hit.velocity * DRUM_PIECE_GAIN[hit.piece] * sectionScale;
      notes.push({
        startTick,
        durationTicks: hitDurationTicks,
        pitch,
        velocity: humanizeVelocity(Math.min(1, Math.max(0.05, scaled)), random),
        articulation: 'staccato',
        drumPiece: hit.piece,
      });
    }
  }
  return notes;
}

function buildRasterDrumNotes(
  raster: BoardRaster,
  strengthByColumn: readonly number[],
  boardRows: readonly number[],
  sections: readonly Section[],
  intent: RawMusicalIntent,
  config: CompositionConfig,
  random: () => number,
): Note[] {
  const rowCount = boardRows.length;
  const hitDurationTicks = ticksPerGridUnit(config.gridSubdivision);
  const baseVelocity = 0.6 + intent.velocityHint * 0.3;
  // ⚠️ החלקים שהמקצב הידני מחזיק **לא** נגזרים מהציור — אחרת היו נשמעות שתי גרסאות של
  // אותו קיק זו על גבי זו. כל השאר (קראש/טום בדרך כלל) ממשיכים לבוא מהציור, וזה מה שהופך
  // את המקצב להיברידי לפי מבנה ולא לפי מתג. ראה beatPattern.ts.
  const ownedByPattern = config.beatPattern
    ? piecesOwnedByPattern(config.beatPattern)
    : new Set<DrumPiece>();

  const runsByPiece = new Map<DrumPiece, RasterRun[]>();
  for (const run of extractRasterRuns(raster)) {
    const piece = drumPieceForRow(run.row, rowCount);
    if (ownedByPattern.has(piece)) {
      continue;
    }
    const existing = runsByPiece.get(piece);
    if (existing) {
      existing.push(run);
    } else {
      runsByPiece.set(piece, [run]);
    }
  }

  const barCount = Math.max(1, Math.ceil(raster.length / COLUMNS_PER_BAR));
  const timingCache: ColumnTimingCache = new Map();
  const hits: Note[] = [];
  for (const [piece, pieceRuns] of runsByPiece) {
    const policy = at([DRUM_PIECE_POLICY[piece]], 0);
    // רצפה נמוכה יותר לתופים: מכה אחת לכל שני ברים מספיקה כדי שחלק לא ייעלם לגמרי.
    const selected = selectRunsByPolicy(
      pieceRuns,
      strengthByColumn,
      policy,
      Math.max(1, Math.floor(barCount / 2)),
    );
    for (const { run, startColumn, strength } of selected) {
      const note = runToNote(
        run,
        startColumn,
        wrapPitchIntoRealisticRange(
          at(boardRows, run.row),
          ROLE_PITCH_RANGES.drums ?? LEAD_REALISTIC_RANGE,
        ),
        baseVelocity * DRUM_PIECE_GAIN[piece] * (0.7 + strength * 0.4),
        1,
        sections,
        config,
        random,
        'staccato',
        timingCache,
      );
      // מכה היא אירוע נקודתי — אורך הרצף קובע *מתי* הבא מגיע, לא כמה זמן המכה נמשכת.
      hits.push({ ...note, durationTicks: hitDurationTicks, drumPiece: piece });
    }
  }

  return collapseSimultaneousDrumHits(hits);
}

/**
 * ⚠️ **תיקון קריטי (2026-08-31, נתפס בבדיקה חיה).** אזור-ערכה משתרע על כמה שורות, ולכן שתי
 * שורות שונות שנחצו באותה עמודה יכולות למפות לאותו כלי בדיוק — ואחרי humanizeTiming (שמעגל
 * לטיק שלם) הן נוחתות באותו startTick. זו לא רק כפילות מיותרת: `Tone.Source.start` דורש
 * זמן **גדול ממש** מהקודם כשהמקור כבר מנגן, ול-DrumKitProvider יש `Player` אחד לכל חלק —
 * כלומר מכה כפולה **מפילה את כל הרינדור** עם "Start time must be strictly greater than
 * previous start time". נמדד ב-11 מתוך 240 צורות אקראיות.
 *
 * הפתרון מאחד אותן למכה אחת בעוצמה החזקה מביניהן. זה גם נכון מוזיקלית: אי אפשר להכות
 * באותו תוף פעמיים באותו רגע, ומקל שמכה חזק יותר הוא בדיוק מה שהאוזן שומעת.
 */
function collapseSimultaneousDrumHits(hits: readonly Note[]): Note[] {
  const lastIndexByPiece = new Map<string, number>();
  const collapsed: Note[] = [];

  for (const hit of [...hits].sort((a, b) => a.startTick - b.startTick)) {
    const piece = hit.drumPiece ?? 'unknown';
    const previousIndex = lastIndexByPiece.get(piece);
    const previous = previousIndex === undefined ? undefined : collapsed[previousIndex];
    // "לא גדול ממש" — בדיוק התנאי ש-Tone אוכף, ולא סף-קרבה שרירותי משלנו.
    if (previous && hit.startTick <= previous.startTick) {
      previous.velocity = Math.max(previous.velocity, hit.velocity);
      continue;
    }
    lastIndexByPiece.set(piece, collapsed.length);
    collapsed.push({ ...hit });
  }
  return collapsed;
}

/**
 * ⭐ 2026-08-24: בונה את טראק ה-lead המלא — loop (buildLoopLeadNotes, ללא שינוי מהתנהגות
 * הישנה) + intro/build/outro (buildRampedLeadNotes, Area 4) — כל הסקשנים ביחד.
 *
 * ⚠️ 2026-08-31: נשאר בשימוש לסגנונות **ללא** absoluteNoteBoard (רגאיי) ולכל קלט בלי
 * shapePaths. סגנון עם לוח אבסולוטי עובר דרך buildRasterLeadNotes למעלה.
 */
function buildLeadTrack(
  intent: RawMusicalIntent,
  root: number,
  mode: Mode,
  sections: readonly Section[],
  config: CompositionConfig,
  random: () => number,
): Track {
  // ⭐ 2026-08-27 (לוח-תווים אבסולוטי): עם absoluteNoteBoard, מנגינה = דגימה ישירה של *כל*
  // intent.pitchContour על פני עמודות-זמן קבועות (COLUMNS_PER_BAR לבר) — לא motifSize
  // (נגזר-קודקודים), ובלי applySymmetryTransform (החצי השני היה "מומצא" משיקוף אלגוריתמי
  // של הראשון, לא נדגם מהציור בפועל — בדיוק מה שהעיקרון האבסולוטי אוסר). כל תו נלקח ישירות
  // מ-noteBoardRows הקבוע (שורש+מוד קבועים, ראה composeMusicalScore) — לא צריך
  // wrapPitchIntoRealisticRange: עם שורש קבוע [60,84]⊂[48,96] מבנייה.
  const fullMelody = config.absoluteNoteBoard
    ? buildAbsoluteBoardMelody(intent, root, mode, sections, config)
    : buildLegacyMelody(intent, root, mode);

  const notes: Note[] = [];
  for (const section of sections) {
    if (section.name === 'loop') {
      notes.push(...buildLoopLeadNotes(fullMelody, section, intent, config, random));
    } else if (section.name === 'build') {
      notes.push(...buildRampedLeadNotes(fullMelody, section, BUILD_RAMP, intent, config, random));
    } else {
      notes.push(...buildRampedLeadNotes(fullMelody, section, EDGE_RAMP, intent, config, random));
    }
  }

  return {
    role: 'lead',
    instrumentId: 'default-lead',
    notes,
    // ⭐ 2026-08-27 (לפי בקשה חיה): 0.85→0.78 — לצד bass/pad (למעלה), כדי שהתופים (כבר
    // ב-volume:1, התקרה של mixSettingsSchema) יבלטו יותר יחסית במיקס.
    mixSettings: { volume: 0.78, pan: 0, reverbSend: 0.2, delaySend: 0.15 },
  };
}

/**
 * התופים הם הקצב, לא מלודיה — pitch קבוע (תחושת "קיק") לכל הפגיעות. שונה במכוון מ-
 * BASS_DEGREE_OFFSET (גם -7): אותה דרגה בדיוק הייתה ממקמת bass/drums באותו pitch,
 * מה שגורם לחפיפה חזותית בסרגל התווים (ScoreStaff.tsx) גם כששניהם מתנגנים בבירור בנפרד.
 */
const DRUMS_DEGREE_OFFSET = -5;

/**
 * ⭐ 2026-08-25 (תיקון ממוקד: תופים תלויי-צורה): מעל הסף הזה, ערך ב-cornerHint (חדות-מתאר
 * מנורמלת, geometryToMusic.ts) נחשב "מספיק חד" כדי להוסיף פגיעת-תופים משלו — לא רק שאריות
 * רעש-דגימה. תבנית-הקצב של הז'אנר (rhythmPatterns.drums) נשארת רצפה (§4.5 "הסגנון קובע
 * לבוש") — הגיאומטריה רק *מוסיפה* פגיעות/הדגשות אמיתיות שמייחדות כל ציור, לא מחליפה אותה.
 */
const CORNER_HIT_THRESHOLD = 0.5;

/**
 * ⭐ 2026-08-25 (תיקון-ביצועים, לפי בקשה חיה: "הסאונד יוצא מקוטע עם קפיצות וחירחורים"):
 * תקרה קשיחה על כמה פגיעות-נוספות (מעבר לתבנית-הז'אנר) cornerHint יכול להוסיף *לכל בר*.
 * לפני התיקון, כל step שעבר את הסף קיבל פגיעה — לצורה מורכבת/משוננת זה יכול היה להפוך
 * "four-on-floor" (4 פגיעות/בר) ל-16+ פגיעות/בר, על כל הבארים בכל אורך היצירה. שילוב של
 * צפיפות-פגיעות כזו עם פריסטים דו-שכבתיים (מאז הרחבת ספריית-התופים) ואוטומציית-הסיידצ'יין
 * שמתוזמנת מחדש בכל פגיעה (sidechain.ts) יכול להעמיס על הרינדור-בזמן-אמת ולגרום לקליקים/
 * חירחורים בפועל. עכשיו: לכל היותר MAX_EXTRA_CORNER_HITS_PER_BAR פגיעות-נוספות לבר,
 * נבחרות top-K לפי עוצמת-cornerHint (לא "כל step שעובר סף") — ראה selectExtraCornerHitSteps.
 */
const MAX_EXTRA_CORNER_HITS_PER_BAR = 3;

/**
 * ⭐ 2026-08-25: פרופיל-פגיעה תלוי-צורה בנקודת-step בודדת (אינדקס גלובלי לאורך כל היצירה,
 * עוטף/חוזר מודולו אורך הפרופיל — אותו דפוס "wrap" כמו fullProgressionDegrees). ריק (0) אם
 * מתחת לסף — לא מוסיף פגיעה שרירותית-נמוכה שרק תעשה רעש.
 */
function cornerHitVelocity(cornerProfile: readonly number[], globalStepIndex: number): number {
  if (cornerProfile.length === 0) {
    return 0;
  }
  const value = at(cornerProfile, globalStepIndex % cornerProfile.length);
  return value > CORNER_HIT_THRESHOLD ? value : 0;
}

/**
 * ⭐ 2026-08-25 (תיקון-ביצועים): בוחר עד MAX_EXTRA_CORNER_HITS_PER_BAR מיקומי-step *בר בודד*
 * שבהם cornerHint עובר את הסף — רק ב-steps שהז'אנר ממילא לא מכה בהם (הוספת-פגיעה אמיתית,
 * לא הדגשת-עוצמה של פגיעה קיימת — זו מטופלת בנפרד ב-Math.max, בלי לעלות בעלות-CPU כי
 * הפגיעה כבר קיימת ממילא). top-K לפי עוצמה, לא "כל step שעובר סף" — זה מה שמבטיח את התקרה.
 */
function selectExtraCornerHitSteps(
  cornerProfile: readonly number[],
  pattern: RhythmStepPattern,
  barGlobalStepStart: number,
): ReadonlyMap<number, number> {
  const candidates: { stepIndex: number; value: number }[] = [];
  for (let stepIndex = 0; stepIndex < pattern.stepsPerBar; stepIndex += 1) {
    const genreVelocity = at(pattern.hits, stepIndex % pattern.hits.length);
    if (genreVelocity > 0) {
      continue;
    }
    const value = cornerHitVelocity(cornerProfile, barGlobalStepStart + stepIndex);
    if (value > 0) {
      candidates.push({ stepIndex, value });
    }
  }
  candidates.sort((a, b) => b.value - a.value);
  const selected = new Map<number, number>();
  for (const candidate of candidates.slice(0, MAX_EXTRA_CORNER_HITS_PER_BAR)) {
    selected.set(candidate.stepIndex, candidate.value);
  }
  return selected;
}

/**
 * ⭐ טראק תופים אמיתי מ-RhythmStepPattern (§5.1 rhythmPatterns) — היה מוגדר ב-GenrePack מ-
 * Sprint 5 אך מעולם לא נצרך (ראה packages/genres/src/schema.ts תיעוד "לא נצרך ב-V1"). זה מה
 * שסוגר את הפער: הופך תבנית ה-hits הספציפית-לסגנון לטראק רביעי אמיתי שמתנגן בפועל.
 *
 * ⭐ 2026-08-24 (Area 4, בדיקה שלישית בסטודיו): מקבל section (לא durationBars גלובלי) —
 * startTick אבסולוטי, אין יותר shiftNotes נפרד. בעבר נקרא *רק* עם loopBars, ולכן תופים
 * מעולם לא ניגנו ב-intro/outro (רק ב-loop, ובנפרד — עם מילוי צפוף יותר — ב-build דרך
 * buildBuildSectionNotes). בבדיקה בפועל זה הורגש כ"הקטע האחרון מושתק": ה-build (עמוס
 * תופים) עובר ל-outro (בלי תופים בכלל, בפתאומיות) — גם כשה-lead/bass כבר מנגנים שם (Area 4
 * הקודם). התיקון: composeMusicalScore קורא לפונקציה הזו על כל section חוץ מ-build (שממשיך
 * לקבל את המילוי הצפוף/עולה-אנרגיה המיוחד שלו, buildBuildSectionNotes — זו כן אבחנת-ארנג'מנט
 * לגיטימית, לא "עיצוב-תוכן" כמו הזזת-רגיסטר במלודיה, כי תופים ממילא נגזרים מהסגנון ולא
 * מהצורה) — כך שיש דופק ריתמי רציף מתחילת היצירה ועד סופה, לא רק באמצע.
 *
 * ⭐ 2026-08-25 (תיקון ממוקד: תופים תלויי-צורה): מקבל גם cornerProfile — velocity בכל step
 * הוא max(תבנית-הז'אנר, פגיעה-נגזרת-מגיאומטריה) — ראה cornerHitVelocity/CORNER_HIT_THRESHOLD.
 */
function buildDrumsSectionNotes(
  pattern: RhythmStepPattern,
  cornerProfile: readonly number[],
  root: number,
  mode: Mode,
  section: Section,
  sectionProgressionDegrees: readonly number[],
  config: CompositionConfig,
  random: () => number,
): Note[] {
  const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
  // ⚠️ §4.3 "הכל מקוונטז לגריד" חל גם על durationTicks (לא רק startTick, שעובר הומניזציה/סווינג
  // בנפרד) — quantizeToGrid+ticksPerGridUnit, לא Math.round(stepTicks*X) גולמי, אחרת התוצאה
  // עלולה לנחות בין נקודות-גריד (validateConstitution's quantized-to-grid, ראה rules.ts).
  const hitDurationTicks = Math.max(
    ticksPerGridUnit(config.gridSubdivision),
    quantizeToGrid(stepTicks * 0.6, config.gridSubdivision),
  );

  // ⚠️ 2026-08-29 (תיקון קריסה אמיתית שנתפסה בסטודיו: "at: אינדקס NaN מחוץ לתחום המערך"):
  // הקורא מעביר `fullProgressionDegrees.slice(startBar, startBar+lengthBars)`, וזה יכול לצאת
  // **ריק** (סקשן שמתחיל בגבול/מעבר לאורך הפרוגרסיה). אז `barOffset % 0` הוא NaN, ו-at()
  // זרק — קריסה שהפילה את כל ה-ScoreStaff. נופלים לדרגה 0, בדיוק כמו המסלול הלא-אבסולוטי
  // (הקורא מעביר שם [0] קבוע). אותה הגנה כבר קיימת ב-buildLoopBassNotes (Math.max(1, length)).
  const safeProgressionDegrees =
    sectionProgressionDegrees.length > 0 ? sectionProgressionDegrees : [0];

  const notes: Note[] = [];
  for (let barOffset = 0; barOffset < section.lengthBars; barOffset += 1) {
    // ⭐ 2026-08-27 (לוח-תווים אבסולוטי — תופים): עם absoluteNoteBoard, ה-pitch נגזר מאותה
    // דרגת-בר שכבר קובעת את הבס/פאד (sectionProgressionDegrees) — לא קבוע-יחיד כמו קודם.
    // אחרת (flag כבוי), הקורא (composeMusicalScore) מעביר [0] קבוע — degree+DRUMS_DEGREE_OFFSET
    // יוצא בדיוק כמו הקבוע הישן, אפס שינוי-התנהגות לסגנונות אחרים.
    const pitch = scaleDegreeToMidiPitch(
      root,
      mode,
      at(safeProgressionDegrees, barOffset % safeProgressionDegrees.length) + DRUMS_DEGREE_OFFSET,
    );
    const barGlobalStepStart = (section.startBar + barOffset) * pattern.stepsPerBar;
    // ⭐ 2026-08-25 (תיקון-ביצועים): עד MAX_EXTRA_CORNER_HITS_PER_BAR פגיעות-*חדשות* לבר —
    // הדגשת-עוצמה על פגיעות קיימות (למטה, בתוך ה-forEach) לא כפופה לתקרה, כי היא לא מוסיפה
    // עלות-CPU (אותה פגיעה ממילא הייתה מנוגנת).
    const extraHitSteps = selectExtraCornerHitSteps(cornerProfile, pattern, barGlobalStepStart);
    pattern.hits.forEach((genreVelocity, stepIndex) => {
      const accentValue =
        genreVelocity > 0
          ? cornerHitVelocity(cornerProfile, barGlobalStepStart + stepIndex)
          : (extraHitSteps.get(stepIndex) ?? 0);
      const velocity = Math.max(genreVelocity, accentValue);
      if (velocity <= 0) {
        return;
      }
      const rawStartTick = (section.startBar + barOffset) * TICKS_PER_BAR + stepIndex * stepTicks;
      const swungStartTick = applySwing(rawStartTick, config.gridSubdivision, config.swingAmount);
      const startTick = humanizeTiming(swungStartTick, config.tempoBpm, random);
      const humanizedVelocity = humanizeVelocity(velocity, random);
      notes.push({
        startTick,
        durationTicks: hitDurationTicks,
        pitch,
        velocity: humanizedVelocity,
        articulation: 'staccato',
      });
    });
  }

  return notes;
}

/**
 * ⭐ 2026-08-22: הזהות המוזיקלית של רגאיי — צ'ופים קצרים על אקורד הבר הנוכחי, בדרך כלל
 * בדיוק על 2+4 (ראה reggae.json's skank-2-and-4). בניגוד ל-buildDrumsTrack (pitch יחיד),
 * skank מנגן את האקורד המלא (כמו pad) אבל בקצב-פגיעות של תבנית, לא sustained — זה מה
 * שהופך אותו לכלי הרמוני-ריתמי נפרד, לא רק "תופים בפיץ' אחר".
 */
function buildSkankTrack(
  pattern: RhythmStepPattern,
  root: number,
  mode: Mode,
  progressionDegrees: readonly number[],
  config: CompositionConfig,
  random: () => number,
): Track {
  const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
  const hitDurationTicks = Math.max(
    ticksPerGridUnit(config.gridSubdivision),
    quantizeToGrid(stepTicks * 0.5, config.gridSubdivision),
  );

  const notes: Note[] = [];
  let previousChord: number[] | null = null;
  progressionDegrees.forEach((degree, barIndex) => {
    const chord = buildChord(root, mode, degree, false);
    const voiced = chooseSmoothVoicing(previousChord, chord);
    previousChord = voiced;

    pattern.hits.forEach((hitVelocity, stepIndex) => {
      if (hitVelocity <= 0) {
        return;
      }
      const rawStartTick = barIndex * TICKS_PER_BAR + stepIndex * stepTicks;
      const swungStartTick = applySwing(rawStartTick, config.gridSubdivision, config.swingAmount);
      const startTick = humanizeTiming(swungStartTick, config.tempoBpm, random);
      const velocity = humanizeVelocity(hitVelocity, random);
      for (const pitch of voiced) {
        notes.push({
          startTick,
          durationTicks: hitDurationTicks,
          pitch,
          velocity,
          articulation: 'staccato',
        });
      }
    });
  });

  return {
    role: 'skank',
    instrumentId: 'default-skank',
    notes,
    // ⚠️ 2026-09-02: הווליום ירד מ-0.7. נמדדה חלוקת האנרגיה במיקס והסקאנק היה **50%-59%**
    // ממנה — כלומר האלמנט הראשי, בעוד התופים 17%-31%. ברגאיי היחס הפוך: התופים והבס הם
    // ה"רידים" (היסוד), והסקאנק הוא טקסטורה מעליהם. הוא גם פוליפוני, כך שכל נגיחה היא
    // אקורד מלא — פי שלושה אנרגיה מכל מכת-תוף. ⚠️ הערך הזה כויל במדידה, לא באוזן.
    mixSettings: { volume: 0.3, pan: 0, reverbSend: 0.15, delaySend: 0.1 },
  };
}

const DEFAULT_SECTION_ORDER: readonly Section['name'][] = ['loop'];

function shiftNotes(notes: readonly Note[], tickOffset: number): Note[] {
  if (tickOffset === 0) {
    return [...notes];
  }
  return notes.map((note) => ({ ...note, startTick: note.startTick + tickOffset }));
}

/**
 * ⭐ 2026-08-22: הופך sectionOrder (§5.1) לרשימת Section אמיתית עם startBar/lengthBars —
 * 'loop' תמיד מקבל את loopBars (התוכן מהצורה, §4.5, לא נוגעים בו); כל section אחר
 * (intro/build/outro) מקבל אורך פרופורציונלי-קצר (חצי מ-loopBars, מינימום בר אחד) —
 * מבנה אמיתי סביב התוכן, לא הארכה שרירותית.
 */
function buildSectionPlan(sectionOrder: readonly Section['name'][], loopBars: number): Section[] {
  const sideBars = Math.max(1, Math.round(loopBars / 2));
  let cursor = 0;
  return sectionOrder.map((name) => {
    const lengthBars = name === 'loop' ? loopBars : sideBars;
    const section: Section = { name, startBar: cursor, lengthBars };
    cursor += lengthBars;
    return section;
  });
}

/**
 * ⭐ 2026-08-22: אקורד מתמשך-שקט ל-intro/outro — "נשימה" לפני/אחרי הלולאה המלאה, לא שקט
 * מוחלט. מנוגן על pad אם קיים, אחרת skank (רגאיי) — ראה composeMusicalScore. ⭐ 2026-08-24:
 * לצד ה"נשימה" הזו, lead/bass מקבלים עכשיו תוכן משלהם באותם הסקשנים (Area 4) — זה נשאר
 * ללא שינוי, רק כבר לא לבד.
 */
function buildSwellNotes(
  root: number,
  mode: Mode,
  degree: number,
  extendedChords: boolean,
  startBar: number,
  lengthBars: number,
  velocity: number,
): Note[] {
  const chord = buildChord(root, mode, degree, extendedChords);
  return chord.map((pitch) => ({
    startTick: startBar * TICKS_PER_BAR,
    durationTicks: lengthBars * TICKS_PER_BAR,
    pitch,
    velocity,
    articulation: 'legato',
  }));
}

/**
 * ⭐ 2026-08-22: סקשן "build" — אנרגיה עולה לקראת חזרת ה-loop: אותה התקדמות הרמונית
 * (voice-led כרגיל) בעוצמה עולה, ותופים בצפיפות כפולה (כל hit + נקודת-האמצע שלו) שגם
 * עולים בעוצמה — טכניקת "בנייה" קלאסית, בלי צורך במודולציית פילטר (זה מגיע ב-Item 5).
 * ⭐ 2026-08-24: lead/bass מקבלים את חלקם ב"בנייה" בנפרד (buildRampedLeadNotes/
 * buildRampedBassNotes, קרוא מתוך buildLeadTrack/buildBassTrack) — כאן רק pad/skank+drums.
 *
 * ⭐ 2026-08-25 (תיקון ממוקד: תופים תלויי-צורה): drumsCornerProfile מוזן לתוך fillVelocity
 * באותה שיטה כמו buildDrumsSectionNotes — max(מילוי-קבוע, פגיעה-נגזרת-מגיאומטריה).
 */
function buildBuildSectionNotes(
  root: number,
  mode: Mode,
  progressionDegrees: readonly number[],
  extendedChords: boolean,
  drumsPattern: RhythmStepPattern | undefined,
  drumsCornerProfile: readonly number[],
  startBar: number,
  lengthBars: number,
  config: CompositionConfig,
  random: () => number,
): { swellNotes: Note[]; drumsNotes: Note[] } {
  const swellNotes: Note[] = [];
  let previousChord: number[] | null = null;
  for (let barOffset = 0; barOffset < lengthBars; barOffset += 1) {
    const degree = at(progressionDegrees, barOffset % progressionDegrees.length);
    const chord = buildChord(root, mode, degree, extendedChords);
    const voiced = chooseSmoothVoicing(previousChord, chord);
    previousChord = voiced;
    const energyRamp = 0.5 + 0.5 * ((barOffset + 1) / lengthBars);
    const startTick = (startBar + barOffset) * TICKS_PER_BAR;
    for (const pitch of voiced) {
      swellNotes.push({
        startTick,
        durationTicks: TICKS_PER_BAR,
        pitch,
        velocity: energyRamp * 0.6,
        articulation: 'legato',
      });
    }
  }

  // ⚠️ "מילוי" ל-build נשאר *בדיוק* על גריד ה-drumsPattern.stepsPerBar הקיים (לא מוסיף
  // חצאי-צעד/32nd) — §4.3 "הכל מקוונטז לגריד" הוא כלל קשיח שנבדק מול config.gridSubdivision;
  // ניסיון קודם להכפיל צפיפות דרך חצאי-צעד הפר את זה (16 הפרות quantized-to-grid, נתפס
  // ע"י בדיקה אמיתית). "מילוי" אמיתי כאן = פגיעה בכל steps (גם מה שהיה rest בלולאה), לא צעד עדין יותר.
  const drumsNotes: Note[] = [];
  if (drumsPattern) {
    // ⭐ 2026-08-27 (לוח-תווים אבסולוטי — תופים): כמו buildDrumsSectionNotes — progressionDegrees
    // כבר הדרגות-הנכונות-לבר (בורד-אבסולוטי כש-flag דלוק, chordProgression הישן אחרת), אבל
    // בלי ה-flag אסור להזין אותו ישירות ל-drums (זה ישנה את ה-pitch-הקבוע הישן) — [0] קבוע
    // שקול בדיוק להתנהגות הישנה.
    const drumsProgressionDegrees = config.absoluteNoteBoard ? progressionDegrees : [0];
    const stepTicks = TICKS_PER_BAR / drumsPattern.stepsPerBar;
    const hitDurationTicks = Math.max(
      ticksPerGridUnit(config.gridSubdivision),
      quantizeToGrid(stepTicks * 0.6, config.gridSubdivision),
    );
    for (let barOffset = 0; barOffset < lengthBars; barOffset += 1) {
      const pitch = scaleDegreeToMidiPitch(
        root,
        mode,
        at(drumsProgressionDegrees, barOffset % drumsProgressionDegrees.length) +
          DRUMS_DEGREE_OFFSET,
      );
      const energyRamp = 0.5 + 0.5 * ((barOffset + 1) / lengthBars);
      const barStartTick = (startBar + barOffset) * TICKS_PER_BAR;
      for (let stepIndex = 0; stepIndex < drumsPattern.stepsPerBar; stepIndex += 1) {
        const originalVelocity = at(drumsPattern.hits, stepIndex % drumsPattern.hits.length);
        const globalStepIndex = (startBar + barOffset) * drumsPattern.stepsPerBar + stepIndex;
        const shapeVelocity = cornerHitVelocity(drumsCornerProfile, globalStepIndex);
        const fillVelocity = Math.max(originalVelocity, 0.45, shapeVelocity);
        const rawStartTick = barStartTick + stepIndex * stepTicks;
        const swungStartTick = applySwing(rawStartTick, config.gridSubdivision, config.swingAmount);
        const startTick = humanizeTiming(swungStartTick, config.tempoBpm, random);
        const velocity = humanizeVelocity(fillVelocity * energyRamp, random);
        drumsNotes.push({
          startTick,
          durationTicks: hitDurationTicks,
          pitch,
          velocity,
          articulation: 'staccato',
        });
      }
    }
  }

  return { swellNotes, drumsNotes };
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/**
 * ⭐ 2026-08-25: מוד בפועל — allowedModes (אם מוגדר ובאורך>1) נבחר לפי intent.articulation
 * (בינארי גיאומטרי: זווית/staccato → אינדקס 0, חלק/legato → אינדקס 1, modulo אורך).
 * בלי allowedModes (או אורך≤1) — נופל ל-mode הקבוע הרגיל.
 */
function selectMode(rawConfig: CompositionConfig, intent: RawMusicalIntent): Mode {
  if (rawConfig.allowedModes && rawConfig.allowedModes.length > 1) {
    const index = intent.articulation === 'staccato' ? 0 : 1;
    return at(rawConfig.allowedModes, index % rawConfig.allowedModes.length);
  }
  return rawConfig.mode;
}

/**
 * ⭐ 2026-08-25: פרוגרסיית-אקורדים בפועל — chordProgressionOptions (אם מוגדר) נבחר לפי
 * intent.rotationalOrder כשיש סימטריה-סיבובית אמיתית (rotationalOrder>1 — משושה/משולש וכו',
 * ראה symmetryDetector.ts), אחרת seeded-random (אותו random() שכבר קיים ב-composeMusicalScore,
 * §1 דטרמיניזם). בלי chordProgressionOptions — נופל ל-chordProgression הקבוע הרגיל.
 */
function selectChordProgression(
  rawConfig: CompositionConfig,
  intent: RawMusicalIntent,
  random: () => number,
): readonly number[] {
  const options = rawConfig.chordProgressionOptions;
  if (!options || options.length === 0) {
    return rawConfig.chordProgression;
  }
  const index =
    intent.rotationalOrder > 1
      ? intent.rotationalOrder % options.length
      : Math.floor(random() * options.length);
  return at(options, index);
}

/**
 * ⭐ 2026-08-25: תבנית-קצב בפועל לתפקיד בודד — rhythmPatternOptions[role] (אם מוגדר) נבחר
 * לפי intent.rhythmicDensityHint, מדולל ("bucketed") למספר-האפשרויות בפועל. בלי options —
 * נופל ל-fallback (rhythmPatterns[role] הקבוע הרגיל).
 */
function selectRhythmPatternForRole(
  options: readonly RhythmStepPattern[] | undefined,
  fallback: RhythmStepPattern | undefined,
  intent: RawMusicalIntent,
): RhythmStepPattern | undefined {
  if (!options || options.length === 0) {
    return fallback;
  }
  const bucket = Math.min(
    options.length - 1,
    Math.floor(intent.rhythmicDensityHint * options.length),
  );
  return at(options, bucket);
}

function selectRhythmPatterns(
  rawConfig: CompositionConfig,
  intent: RawMusicalIntent,
): Partial<Record<TrackRole, RhythmStepPattern>> | undefined {
  if (!rawConfig.rhythmPatternOptions) {
    return rawConfig.rhythmPatterns;
  }
  const roles = new Set<TrackRole>([
    ...(Object.keys(rawConfig.rhythmPatterns ?? {}) as TrackRole[]),
    ...(Object.keys(rawConfig.rhythmPatternOptions) as TrackRole[]),
  ]);
  const result: Partial<Record<TrackRole, RhythmStepPattern>> = {};
  for (const role of roles) {
    const selected = selectRhythmPatternForRole(
      rawConfig.rhythmPatternOptions[role],
      rawConfig.rhythmPatterns?.[role],
      intent,
    );
    if (selected) {
      result[role] = selected;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * ⭐⭐ ממיר RawMusicalIntent ל-MusicalScore תקף — אוכף את §4.3 (סולם, קוונטיזציה,
 * voice leading) ומיישם את §4.4 (סימטריה → רטרוגרד/אינוורסיה) על מבנה היצירה בפועל.
 *
 * ⭐ 2026-08-25 (מגוון מוזיקלי לפי-צורה): rawConfig הוא מה שהסגנון *מציע* (כולל האופציות
 * tempoRange/allowedModes/chordProgressionOptions/rhythmPatternOptions, אם קיימות) —
 * config למטה הוא הבחירה בפועל, אחרי שהוצלבו מול intent (הצורה). זה מה שהופך "אותו סגנון,
 * צורה אחרת" ליצירה שנשמעת שונה בפועל (טמפו/מוד/פרוגרסיה/גרוב), לא רק במלודיה.
 * @param rawConfig  טמפו/מוד/גריד/סווינג + אופציות מה-GenrePack שנבחר (הקורא ממיר GenrePack → CompositionConfig).
 */
export function composeMusicalScore(
  intent: RawMusicalIntent,
  rawConfig: CompositionConfig,
): MusicalScore {
  const random = createSeededRandom(intent.seed);
  // ⭐ 2026-08-27 (לוח-תווים אבסולוטי): עם absoluteNoteBoard, שורש+מוד קבועים לסגנון (לא
  // אקראיים-לפי-seed/לא נבחרים לפי חדות-הצורה) — כדי שאותה שורה בלוח תמיד תייצג אותו תו,
  // בכל ציור. ראה CompositionConfig.absoluteNoteBoard.
  // ⭐ 2026-08-30: השורש נלקח מהסגנון כשהוגדר (noteBoardRootPitchClass), אחרת ברירת-המחדל
  // ההיסטורית — כך שטראנס/האוס ממשיכים לקבל בדיוק את אותו לוח.
  const rootPitchClass = rawConfig.absoluteNoteBoard
    ? (rawConfig.noteBoardRootPitchClass ?? ABSOLUTE_BOARD_ROOT_PITCH_CLASS)
    : Math.floor(random() * 12);

  const mode = rawConfig.absoluteNoteBoard ? rawConfig.mode : selectMode(rawConfig, intent);
  const chordProgression = selectChordProgression(rawConfig, intent, random);
  const rhythmPatterns = selectRhythmPatterns(rawConfig, intent);

  const root = ROOT_OCTAVE_BASE_MIDI + rootPitchClass;

  const baseBarsFromMotif = Math.max(1, Math.ceil(intent.motifSize / NOTES_PER_BAR));
  // ⭐ 2026-08-24 (Area 3): sizeHint (אלכסון bounding-box מנורמל, geometryToMusic.ts) מכפיל
  // את בסיס-החישוב הישן (motifSize/NOTES_PER_BAR) — ציור פיזית-גדול יוצר יצירה ארוכה יותר,
  // לא רק ציור עם הרבה קודקודים.
  const sizeMultiplier =
    SIZE_MULTIPLIER_MIN + (SIZE_MULTIPLIER_MAX - SIZE_MULTIPLIER_MIN) * intent.sizeHint;
  const baseBars = Math.min(
    MAX_LOOP_BASE_BARS,
    Math.max(1, Math.round(baseBarsFromMotif * sizeMultiplier)),
  );
  const hasSecondPhrase = intent.symmetryTransform !== 'none';
  // ⭐ loopBars = "התוכן" מהצורה (§4.5) — לא נוגעים בו. sectionOrder (למטה) קובע אם מסביבו
  // יש גם intro/build/outro, אבל אורך ה-loop עצמו תמיד נגזר מה-motif+size בלבד.
  const loopBars = hasSecondPhrase ? baseBars * 2 : baseBars;

  const sections = buildSectionPlan(rawConfig.sectionOrder ?? DEFAULT_SECTION_ORDER, loopBars);
  const loopSection = sections.find((section) => section.name === 'loop');
  const loopStartBar = loopSection?.startBar ?? 0;
  const loopStartTicks = loopStartBar * TICKS_PER_BAR;
  const totalDurationBars = sections.reduce((sum, section) => sum + section.lengthBars, 0);

  // ⭐ 2026-08-31: כשיש לוח אבסולוטי **וגם** הצורה עצמה זמינה, ארבעת התפקידים נקראים
  // מאותו רסטר — ארבעה מבטים על אותו ציור. אחרת (רגאיי, או intent ישן בלי shapePaths)
  // הנתיב הישן ממשיך כרגיל, בלי שינוי התנהגות.
  const rawBoardRaster =
    rawConfig.absoluteNoteBoard === true
      ? buildBoardRasterForScore(intent, rawConfig, totalDurationBars)
      : null;
  // ⭐ שכבה א': הגובה מוחזק בין אירועים — זה מה שהופך את הזרם הרציף לקצב.
  const eventResult = rawBoardRaster
    ? buildEventRaster(rawBoardRaster, { driftRows: ONSET_DRIFT_ROWS })
    : null;
  const eventsPerBar = eventResult ? eventResult.eventCount / Math.max(1, totalDurationBars) : 0;

  // ⭐ שכבות ג'+ד': טמפו וגריד-הקוונטיזציה נגזרים מצפיפות-האירועים בפועל. בלי רסטר
  // (רגאיי) נשמרת בדיוק הנוסחה הישנה, כולל ההינט הישן — אין שינוי התנהגות שם.
  const tempoBpm = !rawConfig.tempoRange
    ? rawConfig.tempoBpm
    : eventResult
      ? tempoFromEventDensity(eventsPerBar, rawConfig.tempoRange)
      : Math.round(
          lerp(rawConfig.tempoRange.min, rawConfig.tempoRange.max, intent.rhythmicDensityHint),
        );
  const gridSubdivision = eventResult
    ? subdivisionFromEventDensity(
        eventsPerBar,
        rawConfig.allowedSubdivisions ?? [rawConfig.gridSubdivision],
      )
    : rawConfig.gridSubdivision;

  const config: CompositionConfig = {
    ...rawConfig,
    tempoBpm,
    gridSubdivision,
    mode,
    chordProgression,
    ...(rhythmPatterns && { rhythmPatterns }),
  };

  // ⭐ 2026-08-24 (Area 4, תיקון-אגב): התקדמות הרמונית אחת רציפה על פני כל היצירה (לא
  // restart מ-index 0 בכל section בנפרד) — מסלק אי-רציפות הרמונית בגבולות intro/build/
  // outro↔loop. progressionDegrees (המשמש את pad/bass-loop/skank/build) נשאר "פרוסת ה-loop"
  // מתוך הרצף המלא, לא מ-index 0 שרירותי — כך שהוא ממשיך את מה שקרה לפניו ב-intro.
  // ⭐ 2026-08-27 (לוח-תווים אבסולוטי — שלב 2): עם absoluteNoteBoard, ההרמוניה (בס/פאד/
  // build) גם היא נגזרת ישירות ממיקום הצורה על הלוח לכל בר — לא ממחזור chordProgression
  // קבוע. ראה buildAbsoluteBoardProgressionDegrees למעלה.
  // ⚠️ 2026-08-31 (סבב ב'): כשיש רסטר, הדרגות נגזרות **ממנו** ולא מ-intent.pitchContour.
  // pitchContour הוא המתאר הממוצע, והוא קורס לקו ישר בכל צורה סגורה — הבאג שתוקן למנגינה
  // נשאר חי בהרמוניה, ונתן לעיגול אקורד אחד לכל אורך היצירה. ראה progressionDegreesFromRaster.
  const drawnProgressionDegrees = rawBoardRaster
    ? progressionDegreesFromRaster(rawBoardRaster, COLUMNS_PER_BAR, totalDurationBars)
    : rawConfig.absoluteNoteBoard
      ? buildAbsoluteBoardProgressionDegrees(intent, totalDurationBars, rawConfig.noteBoardRowCount)
      : getHarmonicProgressionDegrees(totalDurationBars, config.chordProgression);
  // ⭐ סבב ב': קדנצה V→I בסוף כל סקשן — ההרמוניה מקבלת **כיוון**, לא רק גיוון. הדרגות
  // עצמן עדיין מגיעות מהציור; רק שני הברים האחרונים של סקשן נצמדים כדי שהמשפט ייסגר.
  // ⚠️ רק בנתיב הרסטר. הנתיב הישן (רגאיי) מקבל את הדרגות בדיוק כמו קודם, בלי שינוי התנהגות.
  const fullProgressionDegrees = rawBoardRaster
    ? applyCadences(drawnProgressionDegrees, sections)
    : drawnProgressionDegrees;
  const progressionDegrees = fullProgressionDegrees.slice(loopStartBar, loopStartBar + loopBars);

  // ⚠️ הפאד ממשיך לקרוא את הרסטר ה**גולמי** ולא את רסטר-האירועים: הוא מחזיק אקורד לכל בר,
  // ולכן צריך את מלוא התוכן ההרמוני של הבר — לא רק את הגבהים שנפתחו בהם מכות.
  const boardRaster = eventResult ? eventResult.raster : null;
  const strengthByColumn = eventResult ? eventResult.strengthByColumn : [];
  const boardRows = boardRaster ? buildNoteBoardRows(root, mode, config.noteBoardRowCount) : [];

  // ⭐ 2026-08-24: lead/bass מקבלים את כל הסקשנים (לא רק loop+shift אחר-כך) — מייצרים תוכן
  // בעצמם לכל אורך היצירה, כולל intro/build/outro (Area 4).
  const leadTrack = boardRaster
    ? {
        role: 'lead' as const,
        instrumentId: 'default-lead',
        notes: buildRasterLeadNotes(
          boardRaster,
          strengthByColumn,
          boardRows,
          sections,
          intent,
          config,
          random,
        ),
        mixSettings: { volume: 0.52, pan: 0, reverbSend: 0.2, delaySend: 0.15 },
      }
    : buildLeadTrack(intent, root, mode, sections, config, random);
  const bassTrack = boardRaster
    ? {
        role: 'bass' as const,
        instrumentId: 'default-bass',
        notes: buildRasterBassNotes(
          boardRaster,
          strengthByColumn,
          fullProgressionDegrees,
          root,
          mode,
          sections,
          intent,
          config,
          random,
        ),
        mixSettings: { volume: 0.45, pan: 0, reverbSend: 0.1, delaySend: 0.05 },
      }
    : buildBassTrack(
        root,
        mode,
        sections,
        fullProgressionDegrees,
        config.rhythmPatterns?.bass,
        config,
        random,
      );

  const tracks: Track[] = [leadTrack, bassTrack];

  // ⭐ 2026-08-22: pad נבנה כברירת מחדל (תואם-לאחור עבור configs/בדיקות שלא מגדירים
  // rhythmPatterns בכלל) — אלא אם הסגנון מגדיר rhythmPatterns בלי מפתח pad (בדיוק המקרה של
  // רגאיי, שיש לו skank במקום). זה מדיר pad מרגאיי בלי לשבור אף config אחר.
  const shouldBuildPad = !config.rhythmPatterns || config.rhythmPatterns.pad !== undefined;
  let swellTrack: Track | null = null;
  if (shouldBuildPad) {
    if (boardRaster) {
      swellTrack = {
        role: 'pad',
        instrumentId: 'default-pad',
        notes: buildRasterPadNotes(
          rawBoardRaster ?? boardRaster,
          boardRows,
          fullProgressionDegrees,
          root,
          mode,
          sections,
          config.extendedChords,
        ),
        mixSettings: { volume: 0.26, pan: 0, reverbSend: 0.3, delaySend: 0.1 },
      };
    } else {
      swellTrack = buildPadTrack(root, mode, progressionDegrees, config.extendedChords);
      swellTrack.notes = shiftNotes(swellTrack.notes, loopStartTicks);
    }
    tracks.push(swellTrack);
  }

  // ⭐ 2026-08-25 (תיקון ממוקד: תופים תלויי-צורה): פרופיל-פגיעה נגזר-גיאומטריה, בגודל הלולאה
  // (loopBars*stepsPerBar) — intro/build/outro עוטפים מודולו אורך זה (cornerHitVelocity),
  // אותו דפוס "wrap" כמו fullProgressionDegrees. מחושב פעם אחת, נצרך גם למטה בבניית ה-loop
  // וגם ב-build section.
  const drumsPattern = config.rhythmPatterns?.drums;
  const drumsCornerProfile = drumsPattern
    ? sampleEvenly(intent.cornerHint, Math.max(1, loopBars * drumsPattern.stepsPerBar))
    : [];

  // ⭐ 2026-08-24 (Area 4, בדיקה שלישית): תופים על כל section חוץ מ-build (שמקבל את המילוי
  // המיוחד שלו למטה, buildBuildSectionNotes) — לא רק ה-loop. ראה buildDrumsSectionNotes.
  // ⭐ 2026-08-31: עם רסטר, גם התופים נגזרים מהציור — כל תא שנחצה הופך למכה, והכלי בערכה
  // נקבע לפי גובה השורה (drumKit.ts). אין יותר תבנית-קצב קבועה שמכתיבה מה מנגן.
  // ⭐ 2026-08-27 (לוח-תווים אבסולוטי — תופים): הנתיב הישן נשאר לרגאיי ולכל קלט בלי רסטר.
  let drumsNotes: Note[] | null = null;
  if (boardRaster) {
    drumsNotes = buildRasterDrumNotes(
      boardRaster,
      strengthByColumn,
      boardRows,
      sections,
      intent,
      config,
      random,
    );
    // ⭐ סבב א': המקצב הידני מתווסף לחלקים שהוא מחזיק. הציור כבר דילג עליהם למעלה
    // (ownedByPattern), ולכן אין כאן שתי גרסאות של אותו קיק זו על גבי זו.
    // ⚠️ collapse רץ שוב על האיחוד: הוא מה שמבטיח שאין שתי מכות של אותו חלק באותו רגע,
    // וזו ההנחה ש-DrumKitProvider בנוי עליה (Tone.Source.start זורק אחרת ומפיל רינדור).
    if (config.beatPattern) {
      drumsNotes = collapseSimultaneousDrumHits([
        ...drumsNotes,
        ...buildPatternDrumNotes(
          config.beatPattern,
          root,
          mode,
          sections,
          totalDurationBars,
          config,
          random,
        ),
      ]);
    }
  } else if (drumsPattern) {
    const pattern = drumsPattern;
    drumsNotes = sections
      .filter((section) => section.name !== 'build')
      .flatMap((section) =>
        buildDrumsSectionNotes(
          pattern,
          drumsCornerProfile,
          root,
          mode,
          section,
          config.absoluteNoteBoard
            ? fullProgressionDegrees.slice(section.startBar, section.startBar + section.lengthBars)
            : [0],
          config,
          random,
        ),
      );
  }

  let drumsTrack: Track | null = null;
  if (drumsNotes) {
    drumsTrack = {
      role: 'drums',
      instrumentId: 'default-drums',
      notes: drumsNotes,
      // ⭐ 2026-08-25 (לפי בקשה חיה: "התופים נבלעים, לא מורגשים כלל"): volume 0.75→1
      // (התקרה המותרת ע"י mixSettingsSchema, scoreSchema.ts — §4.3 hard cap, לא עוקפים).
      // הקיק אמור להיות מהאלמנטים הכי בולטים במיקס EDM אמיתי, לא מתחרה בעוצמה שווה מול
      // bass/lead/pad שיש להם תווים ארוכים/מתמשכים (הקיק קצר-מטבעו, אז "אותה עוצמה נומינלית"
      // עדיין נשמע חלש יותר) — ראה גם buildBassTrack/buildPadTrack למטה (volume הופחת קצת
      // כדי שהאיזון היחסי יעבוד גם בתוך התקרה המשותפת של 1). reverbSend 0.1→0 — ריוורב
      // מטשטש טרנזיינטים, ההיפך מ"מורגש חד" (מיקסים אמיתיים כמעט תמיד משאירים קיק יבש).
      mixSettings: { volume: 1, pan: 0, reverbSend: 0, delaySend: 0 },
    };
    tracks.push(drumsTrack);
  }

  if (config.rhythmPatterns?.skank) {
    // ⚠️ 2026-09-01 (בדיקה חיה: "לא נשמע כמו רגאיי"): הסקאנק נבנה קודם על **פרוסת ה-loop
    // בלבד** והוזז ב-loopStartTicks, כלומר ה-intro וה-outro יצאו בלעדיו. נמדד: הסקאנק כיסה
    // בר אחד מתוך שלושה. הסקאנק הוא האלמנט שמגדיר את הסגנון — יצירה שנפתחת בלעדיו לא
    // נשמעת רגאיי בכלל, וזה גם מה שדווח כ"צליל קבוע בפתיחה" (נשארו רק בס ותופים).
    // עכשיו הוא נבנה על כל הברים, כמו bass/lead/drums, ובלי הזזה.
    const skankTrack = buildSkankTrack(
      config.rhythmPatterns.skank,
      root,
      mode,
      fullProgressionDegrees,
      config,
      random,
    );
    tracks.push(skankTrack);
    swellTrack ??= skankTrack; // ⭐ בלי pad (רגאיי) — intro/outro/build "נושמים" על skank במקום.
  }

  // ⭐ 2026-08-22: intro/build/outro אמיתיים — לא רק שם, אלא תוכן שונה בפועל (§11 item 4).
  // ⭐ 2026-08-24: lead/bass/drums כבר קיבלו תוכן משלהם לכל הסקשנים למעלה (Area 4) — כאן רק
  // pad/skank ("נשימה") + המילוי המיוחד/צפוף-יותר של תופים ב-build ספציפית (buildBuildSectionNotes).
  //
  // ⚠️ 2026-08-31: מדולג לגמרי בנתיב הרסטר. שם כל ארבעת התפקידים כבר נגזרים מהציור על פני
  // **כל** הברים (הרסטר נפרס על totalDurationBars), והדינמיקה של המבנה מגיעה מ-
  // sectionVelocityScale. בלי הדילוג הזה ה-pad וה-drums היו מקבלים שכבה שנייה כפולה
  // ב-intro/build/outro — ובנוסף מכות-תופים בלי drumPiece, שדוגם-הערכה לא יודע לנגן.
  for (const section of boardRaster ? [] : sections) {
    if (section.name === 'intro' && swellTrack) {
      const firstDegree = at(progressionDegrees, 0);
      swellTrack.notes.push(
        ...buildSwellNotes(
          root,
          mode,
          firstDegree,
          config.extendedChords,
          section.startBar,
          section.lengthBars,
          0.3,
        ),
      );
    } else if (section.name === 'outro' && swellTrack) {
      const lastDegree = at(progressionDegrees, progressionDegrees.length - 1);
      swellTrack.notes.push(
        ...buildSwellNotes(
          root,
          mode,
          lastDegree,
          config.extendedChords,
          section.startBar,
          section.lengthBars,
          0.25,
        ),
      );
    } else if (section.name === 'build') {
      const { swellNotes, drumsNotes } = buildBuildSectionNotes(
        root,
        mode,
        progressionDegrees,
        config.extendedChords,
        drumsPattern,
        drumsCornerProfile,
        section.startBar,
        section.lengthBars,
        config,
        random,
      );
      swellTrack?.notes.push(...swellNotes);
      drumsTrack?.notes.push(...drumsNotes);
    }
  }
  swellTrack?.notes.sort((a, b) => a.startTick - b.startTick);
  drumsTrack?.notes.sort((a, b) => a.startTick - b.startTick);

  const totalNotes = tracks.reduce((sum, track) => sum + track.notes.length, 0);
  const avgNoteDensity = totalNotes / totalDurationBars;

  const score: MusicalScore = {
    version: SCORE_FORMAT_VERSION,
    seed: intent.seed,
    tempo: config.tempoBpm,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    // key.root הוא pitch class (0–11) לפי scoreSchema — לא ה-MIDI המוחלט ששימש לייצור
    // (root, כולל אוקטבה). rootFrequencyHz למטה כן מבוסס על ה-MIDI המוחלט, כי היא תדירות אמיתית.
    key: { root: rootPitchClass, mode },
    genreId: config.genreId,
    durationBars: totalDurationBars,
    gridSubdivision: config.gridSubdivision,
    tracks,
    sections,
    metadata: {
      avgNoteDensity,
      dominantMode: mode,
      rootFrequencyHz: midiToFrequencyHz(root),
    },
  };

  // .parse() כאן לבדיקת תקינות (זורק אם לא תקף) — לא לכתיבת ה-return, כי הטיפוס המוסק
  // מ-Zod .optional() (מפתח חובה שערכו יכול להיות undefined) לא זהה ל-interface היד-כתוב
  // (מפתח אופציונלי) תחת exactOptionalPropertyTypes. score כבר בנוי נכון בלי סתירה.
  musicalScoreSchema.parse(score);
  return score;
}
