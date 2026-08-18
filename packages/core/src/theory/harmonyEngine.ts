/**
 * @file        harmonyEngine.ts
 * @description ⭐⭐ הפרק המחבר — RawMusicalIntent → MusicalScore אמיתי ותקף. סוגר את שכבה 3
 *              (Theory & Taste, §4.1): אוכף סולם, הרמוניה, voice leading, קוונטיזציה, הומניזציה.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ Sprint 5: מקבל CompositionConfig (טמפו/מוד/גריד/סווינג) מהקורא — לא מ-GenrePack
 * ישירות! §3 קובע "core → shared" בלבד, core לא תלוי ב-@shape-sound/genres. apps/web הוא
 * זה שממיר GenrePack ל-CompositionConfig לפני הקריאה. השורש (pitch class) נשאר נגזר
 * דטרמיניסטית מ-seed בכל הסגנונות — זה ה"תוכן" של הצורה (§4.5), לא ה"לבוש" של הסגנון.
 */

import type { Mode, MusicalScore, Note, Section, Track } from '../score/MusicalScore';
import { musicalScoreSchema } from '../score/scoreSchema';
import type { RawMusicalIntent, SymmetryTransform } from '../mapping/geometryToMusic';
import { scaleDegreeToMidiPitch, snapToScale } from './scales';
import { buildTriad } from './chords';
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
/** התקדמות הרמונית סטנדרטית ונעימה (I–vi–IV–V כדרגות-סולם 0-based) — safety net הרמונית. */
const HARMONIC_PROGRESSION_DEGREES: readonly number[] = [0, 5, 3, 4];

const TICKS_PER_BAR = TICKS_PER_BEAT * DEFAULT_TIME_SIGNATURE[0];

/**
 * מה ש-composeMusicalScore צריך מסגנון (GenrePack) בלי לתלות ב-@shape-sound/genres.
 * apps/web בונה את זה מ-GenrePack שנבחר; ברירת המחדל (ללא סגנון עדיין) היא באחריות הקורא.
 */
export interface CompositionConfig {
  genreId: string;
  tempoBpm: number;
  mode: Mode;
  gridSubdivision: GridSubdivision;
  /** 0–1, ראה GenrePack.grid.swingAmount ב-§5.1. */
  swingAmount: number;
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

function getHarmonicProgressionDegrees(barCount: number): number[] {
  return Array.from({ length: barCount }, (_, index) =>
    at(HARMONIC_PROGRESSION_DEGREES, index % HARMONIC_PROGRESSION_DEGREES.length),
  );
}

function buildPadTrack(root: number, mode: Mode, progressionDegrees: readonly number[]): Track {
  const notes: Note[] = [];
  let previousChord: number[] | null = null;

  progressionDegrees.forEach((degree, barIndex) => {
    const triad = buildTriad(root, mode, degree);
    const voiced = chooseSmoothVoicing(previousChord, triad);
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

function buildBassTrack(root: number, mode: Mode, progressionDegrees: readonly number[]): Track {
  // ⚠️ BASS_DEGREE_OFFSET מוסף ל-degreeIndex (לא ל-root!) — הוא נמדד ב"דרגות סולם" (7=אוקטבה),
  // בדיוק כמו MELODY_DEGREE_OFFSET. הוספה ישירה ל-root ב-semitones הייתה משנה את ה-pitch class
  // בפועל (offset שאינו כפולה של 12) ומייצרת תווים "בסולם" ביחס לשורש שגוי — לא ביחס ל-score.key.root.
  const rawPitches = progressionDegrees.map((degree) =>
    scaleDegreeToMidiPitch(root, mode, degree + BASS_DEGREE_OFFSET),
  );
  const smoothedPitches = smoothMelodicLine(rawPitches);

  const notes: Note[] = smoothedPitches.map((pitch, barIndex) => ({
    startTick: barIndex * TICKS_PER_BAR,
    durationTicks: TICKS_PER_BAR,
    pitch,
    velocity: 0.7,
    articulation: 'staccato',
  }));

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
  const slotTicks = noteCount > 0 ? totalTicks / noteCount : totalTicks;
  const isStaccato = intent.articulation === 'staccato';
  const gapRatio = isStaccato ? 0.4 : 0.98;

  const notes: Note[] = fullMelody.map((pitch, index) => {
    const rawStartTick = index * slotTicks;
    const quantizedStartTick = quantizeToGrid(rawStartTick, config.gridSubdivision);
    const swungStartTick = applySwing(
      quantizedStartTick,
      config.gridSubdivision,
      config.swingAmount,
    );
    const startTick = humanizeTiming(swungStartTick, config.tempoBpm, random);
    const durationTicks = Math.max(
      ticksPerGridUnit(config.gridSubdivision),
      quantizeToGrid(slotTicks * gapRatio, config.gridSubdivision),
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

  const progressionDegrees = getHarmonicProgressionDegrees(durationBars);

  const tracks: Track[] = [
    buildLeadTrack(intent, root, mode, durationBars, hasSecondPhrase, config, random),
    buildBassTrack(root, mode, progressionDegrees),
    buildPadTrack(root, mode, progressionDegrees),
  ];

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
