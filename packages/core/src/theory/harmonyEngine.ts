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
/** טווח דרגות-סולם למלודיה (~אוקטבה) — Y=0 (למעלה) → הדרגה הגבוהה, Y=1 (למטה) → הנמוכה. */
const MELODY_DEGREE_RANGE = 8;
/** המלודיה יושבת אוקטבה מעל השורש (רגיסטר lead טיפוסי). */
const MELODY_DEGREE_OFFSET = 7;
/** הבס יושב אוקטבה מתחת לשורש. */
const BASS_DEGREE_OFFSET = -7;

const TICKS_PER_BAR = TICKS_PER_BEAT * DEFAULT_TIME_SIGNATURE[0];

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
 * ⭐ 2026-08-22: כל מיקומי ה"פגיעה" (hits>0) של תבנית ריתמית, פרושים על פני durationBars
 * בארים (חוזר על התבנית כל בר) — ticks יחסית לתחילת היצירה. משמש הן ל-bass (כל הפגיעות
 * מנוגנות) והן ל-lead (נדגם מהן מספר-קבוע התואם את motifSize, ראה buildLeadTrack).
 */
function patternHitTicks(pattern: RhythmStepPattern, durationBars: number): number[] {
  const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
  const hitStepIndices = pattern.hits
    .map((velocity, stepIndex) => (velocity > 0 ? stepIndex : null))
    .filter((stepIndex): stepIndex is number => stepIndex !== null);
  if (hitStepIndices.length === 0) {
    return [];
  }
  const ticks: number[] = [];
  for (let barIndex = 0; barIndex < durationBars; barIndex += 1) {
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
    mixSettings: { volume: 0.6, pan: 0, reverbSend: 0.3, delaySend: 0.1 },
  };
}

/**
 * ⭐ 2026-08-22: כשהסגנון מגדיר rhythmPatterns.bass, כל בר מנגן את פגיעות התבנית (במקום
 * "תו אחד לכל בר" קבוע) — זה מה שהופך "פועם 16th" (טראנס) ל-groove אמיתי שונה מ-"one-drop"
 * (רגאיי), בלי לגעת בהרמוניה (כל הפגיעות בתוך בר נתון עדיין ב-pitch של אקורד אותו בר).
 * בלי pattern (config.rhythmPatterns?.bass undefined) — נופל חזרה לתו-אחד-לכל-בר הישן.
 */
function buildBassTrack(
  root: number,
  mode: Mode,
  progressionDegrees: readonly number[],
  pattern: RhythmStepPattern | undefined,
  config: CompositionConfig,
  random: () => number,
): Track {
  // ⚠️ BASS_DEGREE_OFFSET מוסף ל-degreeIndex (לא ל-root!) — הוא נמדד ב"דרגות סולם" (7=אוקטבה),
  // בדיוק כמו MELODY_DEGREE_OFFSET. הוספה ישירה ל-root ב-semitones הייתה משנה את ה-pitch class
  // בפועל (offset שאינו כפולה של 12) ומייצרת תווים "בסולם" ביחס לשורש שגוי — לא ביחס ל-score.key.root.
  const rawPitches = progressionDegrees.map((degree) =>
    scaleDegreeToMidiPitch(root, mode, degree + BASS_DEGREE_OFFSET),
  );
  const smoothedPitches = smoothMelodicLine(rawPitches);

  let notes: Note[];
  if (pattern) {
    const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
    const hitDurationTicks = Math.max(1, Math.round(stepTicks * 0.85));
    notes = [];
    smoothedPitches.forEach((pitch, barIndex) => {
      pattern.hits.forEach((hitVelocity, stepIndex) => {
        if (hitVelocity <= 0) {
          return;
        }
        const rawStartTick = barIndex * TICKS_PER_BAR + stepIndex * stepTicks;
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
    notes = smoothedPitches.map((pitch, barIndex) => ({
      startTick: barIndex * TICKS_PER_BAR,
      durationTicks: TICKS_PER_BAR,
      pitch,
      velocity: 0.7,
      articulation: 'staccato',
    }));
  }

  return {
    role: 'bass',
    instrumentId: 'default-bass',
    notes,
    mixSettings: { volume: 0.8, pan: 0, reverbSend: 0, delaySend: 0 },
  };
}

function buildLeadTrack(
  intent: RawMusicalIntent,
  root: number,
  mode: Mode,
  durationBars: number,
  hasSecondPhrase: boolean,
  config: CompositionConfig,
  random: () => number,
): Track {
  const sampledY = sampleEvenly(intent.pitchContour, intent.motifSize);
  const primaryMotif = sampledY.map((y) => scaleDegreeToMidiPitch(root, mode, yToMelodyDegree(y)));
  const secondaryMotif = hasSecondPhrase
    ? applySymmetryTransform(primaryMotif, intent.symmetryTransform, root, mode)
    : [];
  const fullMelody = hasSecondPhrase ? [...primaryMotif, ...secondaryMotif] : primaryMotif;

  const totalTicks = durationBars * TICKS_PER_BAR;
  const noteCount = fullMelody.length;
  const evenSlotTicks = noteCount > 0 ? totalTicks / noteCount : totalTicks;
  const isStaccato = intent.articulation === 'staccato';
  const gapRatio = isStaccato ? 0.4 : 0.98;

  // ⭐ 2026-08-22: מספר-התווים תמיד מהצורה (§4.5, fullMelody.length לא משתנה) — הסגנון
  // משפיע רק על *מיקומם* בזמן: כשיש rhythmPatterns.lead, אותם תווים "נדגמים" (sampleEvenly)
  // אל תוך מיקומי-הפגיעה הסינקופטיים של הסגנון, במקום חלוקה שווה גנרית. בלי pattern —
  // נופל לחלוקה השווה הישנה.
  const patternTicks = config.rhythmPatterns?.lead
    ? patternHitTicks(config.rhythmPatterns.lead, durationBars)
    : [];
  const startTicksRaw =
    patternTicks.length >= noteCount && noteCount > 0
      ? sampleEvenly(patternTicks, noteCount)
      : Array.from({ length: noteCount }, (_, index) => index * evenSlotTicks);

  const notes: Note[] = fullMelody.map((pitch, index) => {
    const rawStartTick = at(startTicksRaw, index);
    const nextRawStartTick =
      index + 1 < startTicksRaw.length
        ? at(startTicksRaw, index + 1)
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
 * ⭐ טראק תופים אמיתי מ-RhythmStepPattern (§5.1 rhythmPatterns) — היה מוגדר ב-GenrePack מ-
 * Sprint 5 אך מעולם לא נצרך (ראה packages/genres/src/schema.ts תיעוד "לא נצרך ב-V1"). זה מה
 * שסוגר את הפער: הופך תבנית ה-hits הספציפית-לסגנון לטראק רביעי אמיתי שמתנגן בפועל.
 */
function buildDrumsTrack(
  pattern: RhythmStepPattern,
  root: number,
  mode: Mode,
  durationBars: number,
  config: CompositionConfig,
  random: () => number,
): Track {
  const pitch = scaleDegreeToMidiPitch(root, mode, DRUMS_DEGREE_OFFSET);
  const stepTicks = TICKS_PER_BAR / pattern.stepsPerBar;
  const hitDurationTicks = Math.max(1, Math.round(stepTicks * 0.6));

  const notes: Note[] = [];
  for (let barIndex = 0; barIndex < durationBars; barIndex += 1) {
    pattern.hits.forEach((hitVelocity, stepIndex) => {
      if (hitVelocity <= 0) {
        return;
      }
      const rawStartTick = barIndex * TICKS_PER_BAR + stepIndex * stepTicks;
      const swungStartTick = applySwing(rawStartTick, config.gridSubdivision, config.swingAmount);
      const startTick = humanizeTiming(swungStartTick, config.tempoBpm, random);
      const velocity = humanizeVelocity(hitVelocity, random);
      notes.push({
        startTick,
        durationTicks: hitDurationTicks,
        pitch,
        velocity,
        articulation: 'staccato',
      });
    });
  }

  return {
    role: 'drums',
    instrumentId: 'default-drums',
    notes,
    mixSettings: { volume: 0.75, pan: 0, reverbSend: 0.1, delaySend: 0 },
  };
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
  const hitDurationTicks = Math.max(1, Math.round(stepTicks * 0.5));

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

/**
 * ⭐⭐ ממיר RawMusicalIntent ל-MusicalScore תקף — אוכף את §4.3 (סולם, קוונטיזציה,
 * voice leading) ומיישם את §4.4 (סימטריה → רטרוגרד/אינוורסיה) על מבנה היצירה בפועל.
 * @param config  טמפו/מוד/גריד/סווינג מה-GenrePack שנבחר (הקורא ממיר GenrePack → CompositionConfig).
 */
export function composeMusicalScore(
  intent: RawMusicalIntent,
  config: CompositionConfig,
): MusicalScore {
  const random = createSeededRandom(intent.seed);
  const rootPitchClass = Math.floor(random() * 12);
  const mode = config.mode;
  const root = ROOT_OCTAVE_BASE_MIDI + rootPitchClass;

  const baseBars = Math.max(1, Math.ceil(intent.motifSize / NOTES_PER_BAR));
  const hasSecondPhrase = intent.symmetryTransform !== 'none';
  const durationBars = hasSecondPhrase ? baseBars * 2 : baseBars;

  const progressionDegrees = getHarmonicProgressionDegrees(durationBars, config.chordProgression);

  const tracks: Track[] = [
    buildLeadTrack(intent, root, mode, durationBars, hasSecondPhrase, config, random),
    buildBassTrack(root, mode, progressionDegrees, config.rhythmPatterns?.bass, config, random),
  ];
  // ⭐ 2026-08-22: pad נבנה כברירת מחדל (תואם-לאחור עבור configs/בדיקות שלא מגדירים
  // rhythmPatterns בכלל) — אלא אם הסגנון מגדיר rhythmPatterns בלי מפתח pad (בדיוק המקרה של
  // רגאיי, שיש לו skank במקום). זה מדיר pad מרגאיי בלי לשבור אף config אחר.
  const shouldBuildPad = !config.rhythmPatterns || config.rhythmPatterns.pad !== undefined;
  if (shouldBuildPad) {
    tracks.push(buildPadTrack(root, mode, progressionDegrees, config.extendedChords));
  }
  if (config.rhythmPatterns?.drums) {
    tracks.push(
      buildDrumsTrack(config.rhythmPatterns.drums, root, mode, durationBars, config, random),
    );
  }
  if (config.rhythmPatterns?.skank) {
    tracks.push(
      buildSkankTrack(config.rhythmPatterns.skank, root, mode, progressionDegrees, config, random),
    );
  }

  const sections: Section[] = [{ name: 'loop', startBar: 0, lengthBars: durationBars }];

  const totalNotes = tracks.reduce((sum, track) => sum + track.notes.length, 0);
  const avgNoteDensity = totalNotes / durationBars;

  const score: MusicalScore = {
    version: SCORE_FORMAT_VERSION,
    seed: intent.seed,
    tempo: config.tempoBpm,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    // key.root הוא pitch class (0–11) לפי scoreSchema — לא ה-MIDI המוחלט ששימש לייצור
    // (root, כולל אוקטבה). rootFrequencyHz למטה כן מבוסס על ה-MIDI המוחלט, כי היא תדירות אמיתית.
    key: { root: rootPitchClass, mode },
    genreId: config.genreId,
    durationBars,
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
