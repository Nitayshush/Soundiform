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
const MELODY_DEGREE_RANGE = 15;
/** המלודיה יושבת אוקטבה מעל השורש (רגיסטר lead טיפוסי). */
const MELODY_DEGREE_OFFSET = 7;
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
    // ⭐ 2026-08-25: 0.6→0.45 — לצד volume:1 של התופים (למטה, composeMusicalScore), כדי
    // שהאיזון היחסי יעניק לקיק מקום להישמע בולט (ראה תיעוד שם).
    mixSettings: { volume: 0.45, pan: 0, reverbSend: 0.3, delaySend: 0.1 },
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
    // ⭐ 2026-08-25: 0.8→0.65 — אותה סיבה כמו buildPadTrack (מפנה מקום-תדר/עוצמה לתופים,
    // volume:1, שחולקים איתו את אותו טווח-תדרים נמוך).
    mixSettings: { volume: 0.65, pan: 0, reverbSend: 0, delaySend: 0 },
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
 * ⭐ 2026-08-24: בונה את טראק ה-lead המלא — loop (buildLoopLeadNotes, ללא שינוי מהתנהגות
 * הישנה) + intro/build/outro (buildRampedLeadNotes, Area 4) — כל הסקשנים ביחד.
 */
function buildLeadTrack(
  intent: RawMusicalIntent,
  root: number,
  mode: Mode,
  sections: readonly Section[],
  config: CompositionConfig,
  random: () => number,
): Track {
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
  const fullMelody = hasSecondPhrase ? [...primaryMotif, ...secondaryMotif] : primaryMotif;

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
    mixSettings: { volume: 0.85, pan: 0, reverbSend: 0.2, delaySend: 0.15 },
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
const CORNER_HIT_THRESHOLD = 0.3;

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
  config: CompositionConfig,
  random: () => number,
): Note[] {
  const pitch = scaleDegreeToMidiPitch(root, mode, DRUMS_DEGREE_OFFSET);
  const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
  // ⚠️ §4.3 "הכל מקוונטז לגריד" חל גם על durationTicks (לא רק startTick, שעובר הומניזציה/סווינג
  // בנפרד) — quantizeToGrid+ticksPerGridUnit, לא Math.round(stepTicks*X) גולמי, אחרת התוצאה
  // עלולה לנחות בין נקודות-גריד (validateConstitution's quantized-to-grid, ראה rules.ts).
  const hitDurationTicks = Math.max(
    ticksPerGridUnit(config.gridSubdivision),
    quantizeToGrid(stepTicks * 0.6, config.gridSubdivision),
  );

  const notes: Note[] = [];
  for (let barOffset = 0; barOffset < section.lengthBars; barOffset += 1) {
    pattern.hits.forEach((genreVelocity, stepIndex) => {
      const globalStepIndex = (section.startBar + barOffset) * pattern.stepsPerBar + stepIndex;
      const velocity = Math.max(genreVelocity, cornerHitVelocity(cornerProfile, globalStepIndex));
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
    mixSettings: { volume: 0.7, pan: 0, reverbSend: 0.15, delaySend: 0.1 },
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
    const pitch = scaleDegreeToMidiPitch(root, mode, DRUMS_DEGREE_OFFSET);
    const stepTicks = TICKS_PER_BAR / drumsPattern.stepsPerBar;
    const hitDurationTicks = Math.max(
      ticksPerGridUnit(config.gridSubdivision),
      quantizeToGrid(stepTicks * 0.6, config.gridSubdivision),
    );
    for (let barOffset = 0; barOffset < lengthBars; barOffset += 1) {
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
  const rootPitchClass = Math.floor(random() * 12);

  const tempoBpm = rawConfig.tempoRange
    ? Math.round(
        lerp(rawConfig.tempoRange.min, rawConfig.tempoRange.max, intent.rhythmicDensityHint),
      )
    : rawConfig.tempoBpm;
  const mode = selectMode(rawConfig, intent);
  const chordProgression = selectChordProgression(rawConfig, intent, random);
  const rhythmPatterns = selectRhythmPatterns(rawConfig, intent);

  const config: CompositionConfig = {
    ...rawConfig,
    tempoBpm,
    mode,
    chordProgression,
    ...(rhythmPatterns && { rhythmPatterns }),
  };

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

  const sections = buildSectionPlan(config.sectionOrder ?? DEFAULT_SECTION_ORDER, loopBars);
  const loopSection = sections.find((section) => section.name === 'loop');
  const loopStartBar = loopSection?.startBar ?? 0;
  const loopStartTicks = loopStartBar * TICKS_PER_BAR;
  const totalDurationBars = sections.reduce((sum, section) => sum + section.lengthBars, 0);

  // ⭐ 2026-08-24 (Area 4, תיקון-אגב): התקדמות הרמונית אחת רציפה על פני כל היצירה (לא
  // restart מ-index 0 בכל section בנפרד) — מסלק אי-רציפות הרמונית בגבולות intro/build/
  // outro↔loop. progressionDegrees (המשמש את pad/bass-loop/skank/build) נשאר "פרוסת ה-loop"
  // מתוך הרצף המלא, לא מ-index 0 שרירותי — כך שהוא ממשיך את מה שקרה לפניו ב-intro.
  const fullProgressionDegrees = getHarmonicProgressionDegrees(
    totalDurationBars,
    config.chordProgression,
  );
  const progressionDegrees = fullProgressionDegrees.slice(loopStartBar, loopStartBar + loopBars);

  // ⭐ 2026-08-24: lead/bass מקבלים את כל הסקשנים (לא רק loop+shift אחר-כך) — מייצרים תוכן
  // בעצמם לכל אורך היצירה, כולל intro/build/outro (Area 4).
  const leadTrack = buildLeadTrack(intent, root, mode, sections, config, random);
  const bassTrack = buildBassTrack(
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
    swellTrack = buildPadTrack(root, mode, progressionDegrees, config.extendedChords);
    swellTrack.notes = shiftNotes(swellTrack.notes, loopStartTicks);
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
  let drumsTrack: Track | null = null;
  if (drumsPattern) {
    const drumsNotes = sections
      .filter((section) => section.name !== 'build')
      .flatMap((section) =>
        buildDrumsSectionNotes(
          drumsPattern,
          drumsCornerProfile,
          root,
          mode,
          section,
          config,
          random,
        ),
      );
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
    const skankTrack = buildSkankTrack(
      config.rhythmPatterns.skank,
      root,
      mode,
      progressionDegrees,
      config,
      random,
    );
    skankTrack.notes = shiftNotes(skankTrack.notes, loopStartTicks);
    tracks.push(skankTrack);
    swellTrack ??= skankTrack; // ⭐ בלי pad (רגאיי) — intro/outro/build "נושמים" על skank במקום.
  }

  // ⭐ 2026-08-22: intro/build/outro אמיתיים — לא רק שם, אלא תוכן שונה בפועל (§11 item 4).
  // ⭐ 2026-08-24: lead/bass/drums כבר קיבלו תוכן משלהם לכל הסקשנים למעלה (Area 4) — כאן רק
  // pad/skank ("נשימה") + המילוי המיוחד/צפוף-יותר של תופים ב-build ספציפית (buildBuildSectionNotes).
  for (const section of sections) {
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
