/**
 * @file        scales.ts
 * @description ⭐ הגדרת שבעת המודים והמרות פיץ' — הבסיס לכל שכבת ה-Theory. ראה PROJECT.md §4.3.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה דרגת סולם ולא תו כרומטי (ראה גם דוגמת ה-JSDoc ב-PROJECT.md §0.6):
 * מיפוי כרומטי מייצר דיסוננס על כל צורה לא-מיושרת. מיפוי לדרגות סולם מבטיח קונסוננס תמיד.
 */

import type { Mode } from '../score/MusicalScore';
import { at } from '../internal/arrayUtils';

/** מרווחים (בחצי-טונים מהשורש) של כל מוד, בתוך אוקטבה אחת — 7 תווים כל אחד. */
const SCALE_INTERVALS: Record<Mode, readonly number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

const SEMITONES_PER_OCTAVE = 12;
/** טווח MIDI חוקי (§4.3: "טווחי כלים ריאליסטיים" — זהו הגבול המוחלט, לא טווח כלי ספציפי).
 * ⭐ מיוצא — voiceLeading.ts's pickClosestOctave צריך אותו (ראה שם, 2026-08-23). */
export const MIDI_MIN = 0;
export const MIDI_MAX = 127;

export const ALL_MODES: readonly Mode[] = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
];

export function getScaleIntervals(mode: Mode): readonly number[] {
  return SCALE_INTERVALS[mode];
}

function clampMidiPitch(pitch: number): number {
  return Math.min(MIDI_MAX, Math.max(MIDI_MIN, Math.round(pitch)));
}

/**
 * מרווח (בחצי-טונים, יחסית לשורש המוד) של אינדקס דרגת-סולם — ללא הצמדה לטווח MIDI.
 * שימושי לחישובי אינטרוול טהורים (למשל chords.ts: איכות אקורד), לא רק לפיצ'ים מוחלטים.
 */
export function getScaleDegreeInterval(mode: Mode, degreeIndex: number): number {
  const intervals = getScaleIntervals(mode);
  const degreesPerOctave = intervals.length;
  const octaveOffset = Math.floor(degreeIndex / degreesPerOctave);
  const degreeWithinOctave =
    ((degreeIndex % degreesPerOctave) + degreesPerOctave) % degreesPerOctave;
  return octaveOffset * SEMITONES_PER_OCTAVE + at(intervals, degreeWithinOctave);
}

/**
 * ממיר אינדקס דרגת-סולם (יכול להיות שלילי או גדול מ-7 — חוצה אוקטבות) לפיץ' MIDI מוחלט,
 * תמיד בתוך הסולם (§4.3: "כל תו בסולם הפעיל" — כלל קשיח).
 */
export function scaleDegreeToMidiPitch(root: number, mode: Mode, degreeIndex: number): number {
  return clampMidiPitch(root + getScaleDegreeInterval(mode, degreeIndex));
}

/**
 * מצמיד פיץ' כרומטי שרירותי לתו הקרוב ביותר בסולם — רשת הביטחון של §4.3 בפעולה: גם קלט
 * "רועש" לחלוטין (למשל טעות עיגול, או קלט חיצוני עתידי) חוזר תמיד בתוך הסולם.
 */
export function snapToScale(midiPitch: number, root: number, mode: Mode): number {
  const intervals = getScaleIntervals(mode);
  const relativePitch = midiPitch - root;
  const octave = Math.floor(relativePitch / SEMITONES_PER_OCTAVE);
  const pitchClassInOctave =
    ((relativePitch % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;

  let closestInterval = at(intervals, 0);
  let smallestDistance = Infinity;
  for (const interval of intervals) {
    const distance = Math.abs(interval - pitchClassInOctave);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestInterval = interval;
    }
  }
  return clampMidiPitch(root + octave * SEMITONES_PER_OCTAVE + closestInterval);
}

/** true אם הפיץ' הנתון הוא בדיוק תו בסולם (root+mode) — משמש ל-rules.ts. */
export function isInScale(midiPitch: number, root: number, mode: Mode): boolean {
  return snapToScale(midiPitch, root, mode) === clampMidiPitch(midiPitch);
}
