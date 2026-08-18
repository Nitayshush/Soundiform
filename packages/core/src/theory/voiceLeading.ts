/**
 * @file        voiceLeading.ts
 * @description ⭐ קריטי לאיכות — ראה PROJECT.md §11 Sprint 3. בוחר אוקטבה/היפוך לכל אקורד/תו
 *              כך שהתנועה מהתו/אקורד הקודם תהיה מינימלית ("voice leading חלק").
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה זה קריטי לאיכות:
 * בלי voice leading, כל תו/אקורד נבחר "נכון" מבחינת סולם אבל קופץ אוקטבות אקראית —
 * זו הסיבה שמנועים גיאומטריים נאיביים נשמעים "קופצניים" ולא כמו הפקה מכוונת. ראה גם §4.3
 * הכלל "אין קווינטות/אוקטבות מקבילות" — הבחירה כאן חייבת לכבד גם אותו, לא רק מרחק מינימלי.
 */

import { at } from '../internal/arrayUtils';

const SEMITONES_PER_OCTAVE = 12;
/** כמה אוקטבות למעלה/מטה לנסות בחיפוש ההיפוך הקרוב ביותר. */
const OCTAVE_SEARCH_RANGE = 3;

/**
 * בוחר, מתוך כל ה"היפוכים" האפשריים של pitchClass נתון (אותו class בכל האוקטבות בטווח
 * החיפוש), את הפיץ' הקרוב ביותר לתו הקודם — ליצירת קו מלודי חלק בלי קפיצות מיותרות.
 */
export function pickClosestOctave(pitchClass: number, previousPitch: number | null): number {
  if (previousPitch === null) {
    return pitchClass;
  }
  const basePitchClass = ((pitchClass % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % 12;
  // מרכז את החיפוש סביב האוקטבה של previousPitch עצמו — לא סביב אוקטבת ה-pitchClass הגולמי,
  // אחרת "הקרוב ביותר" לא נמצא כשה-pitchClass וה-previousPitch רחוקים זה מזה ברישום המוחלט.
  const previousOctave = Math.floor(previousPitch / SEMITONES_PER_OCTAVE);
  let closestPitch = basePitchClass;
  let smallestDistance = Infinity;
  for (
    let octaveOffset = -OCTAVE_SEARCH_RANGE;
    octaveOffset <= OCTAVE_SEARCH_RANGE;
    octaveOffset += 1
  ) {
    const candidate = basePitchClass + (previousOctave + octaveOffset) * SEMITONES_PER_OCTAVE;
    const distance = Math.abs(candidate - previousPitch);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestPitch = candidate;
    }
  }
  return closestPitch;
}

/**
 * מיישר קו מלודי שלם (רצף פיצ'ים, כבר בסולם) כך שכל תו נמצא באוקטבה הקרובה ביותר לקודמו —
 * שומר על ה-pitch class (דרגת הסולם) של כל תו, רק בוחר אוקטבה חלקה.
 */
export function smoothMelodicLine(pitches: readonly number[]): number[] {
  const result: number[] = [];
  let previousPitch: number | null = null;
  for (const pitch of pitches) {
    const smoothed = pickClosestOctave(pitch, previousPitch);
    result.push(smoothed);
    previousPitch = smoothed;
  }
  return result;
}

/**
 * בודק אם המעבר בין שני אקורדים (מסודרים שורש-שלישית-חמישית) מכיל קווינטה/אוקטבה מקבילה —
 * §4.3 כלל קשיח: "אין קווינטות או אוקטבות מקבילות". מיוצא (לא רק פנימי) כדי שגם rules.ts
 * וגם הבדיקות יוכלו לאמת את התכונה הזו ישירות, לא רק בעקיפין דרך chooseSmoothVoicing.
 */
export function hasParallelMotion(chordA: readonly number[], chordB: readonly number[]): boolean {
  const PERFECT_INTERVALS = new Set([0, 7]); // אוקטבה (mod 12 = 0), חמישית מושלמת (7)
  for (let voiceIndex = 0; voiceIndex < chordA.length; voiceIndex += 1) {
    for (
      let otherVoiceIndex = voiceIndex + 1;
      otherVoiceIndex < chordA.length;
      otherVoiceIndex += 1
    ) {
      const intervalA = mod12(at(chordA, otherVoiceIndex) - at(chordA, voiceIndex));
      const intervalB = mod12(at(chordB, otherVoiceIndex) - at(chordB, voiceIndex));
      if (!PERFECT_INTERVALS.has(intervalA) || !PERFECT_INTERVALS.has(intervalB)) {
        continue;
      }
      const movedSameDirection =
        Math.sign(at(chordB, voiceIndex) - at(chordA, voiceIndex)) ===
        Math.sign(at(chordB, otherVoiceIndex) - at(chordA, otherVoiceIndex));
      const actuallyMoved = at(chordB, voiceIndex) !== at(chordA, voiceIndex);
      if (movedSameDirection && actuallyMoved) {
        return true;
      }
    }
  }
  return false;
}

function mod12(value: number): number {
  return ((value % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
}

function totalMovement(chordA: readonly number[], chordB: readonly number[]): number {
  return chordA.reduce((sum, pitch, index) => sum + Math.abs(at(chordB, index) - pitch), 0);
}

/** כל ההיפוכים האפשריים של טריאדה (סיבוב סדר התווים + הזזת אוקטבה של הראשון/הראשונים). */
function generateInversions(triad: readonly number[]): number[][] {
  const inversions: number[][] = [];
  for (let rotation = 0; rotation < triad.length; rotation += 1) {
    const rotated = [
      ...triad.slice(rotation),
      ...triad.slice(0, rotation).map((pitch) => pitch + SEMITONES_PER_OCTAVE),
    ];
    inversions.push(rotated);
  }
  return inversions;
}

/**
 * בוחר, מתוך היפוכי האקורד הבא, את זה שממזער תנועה כוללת מהאקורד הקודם — ותוך כדי כך
 * דוחה היפוכים שיוצרים קווינטות/אוקטבות מקבילות (§4.3, כלל קשיח, גובר על מינימום-תנועה).
 *
 * ⚠️ מגבלת V1: לטריאדה יש רק 3 היפוכים אפשריים; אם **כולם** יוצרים תנועה מקבילה
 * (נדיר, אך אפשרי בין זוגות אקורדים מסוימים), נופלים חזרה לבחירת מינימום-תנועה בכל זאת —
 * כלל "אין מקבילות" הוא best-effort כאן, לא הבטחה מוחלטת כמו "כל תו בסולם" (§4.3).
 */
export function chooseSmoothVoicing(
  previousChord: readonly number[] | null,
  nextTriad: readonly number[],
): number[] {
  if (previousChord === null) {
    return [...nextTriad];
  }
  const candidates = generateInversions(nextTriad);
  const legalCandidates = candidates.filter(
    (candidate) => !hasParallelMotion(previousChord, candidate),
  );
  const pool = legalCandidates.length > 0 ? legalCandidates : candidates;

  return pool.reduce((best, candidate) =>
    totalMovement(previousChord, candidate) < totalMovement(previousChord, best) ? candidate : best,
  );
}
