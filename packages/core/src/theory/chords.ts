/**
 * @file        chords.ts
 * @description בונה טריאדות דיאטוניות מדרגת סולם, וקובע את איכותן (מז'ור/מינור/דימיניש/אוגמנטד)
 *              לפי המרווחים בפועל של המוד — לא רשימה קבועה מראש.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה איכות האקורד נגזרת מהמוד ולא טבלה קבועה:
 * איכות הדרגה ה-ii באאוליאן (מינור) שונה מהדרגה ה-ii בלידיאן (מז'ור) — חישוב מהמרווחים
 * בפועל של המוד הנתון הוא הדרך היחידה שנכונה בכל שבעת המודים בלי טעויות העתקה.
 */

import type { Mode } from '../score/MusicalScore';
import { scaleDegreeToMidiPitch, getScaleDegreeInterval } from './scales';

export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented';

const MAJOR_THIRD = 4;
const DIMINISHED_FIFTH = 6;
const AUGMENTED_FIFTH = 8;

/**
 * בונה טריאדה דיאטונית (שורש-שלישית-חמישית) על דרגת סולם נתונה — כל התווים בסולם (§4.3).
 * @param root           MIDI של שורש הסולם (לא בהכרח שורש האקורד עצמו)
 * @param scaleDegreeIndex  דרגת הסולם עליה נבנה האקורד (0-based, יכול לחצות אוקטבות)
 */
export function buildTriad(root: number, mode: Mode, scaleDegreeIndex: number): number[] {
  return [0, 2, 4].map((thirdOffset) =>
    scaleDegreeToMidiPitch(root, mode, scaleDegreeIndex + thirdOffset),
  );
}

/** קובע את איכות הטריאדה הדיאטונית על דרגת סולם, מהמרווחים בפועל של המוד. */
export function getChordQuality(mode: Mode, scaleDegreeIndex: number): ChordQuality {
  const rootInterval = getScaleDegreeInterval(mode, scaleDegreeIndex);
  const thirdInterval = getScaleDegreeInterval(mode, scaleDegreeIndex + 2) - rootInterval;
  const fifthInterval = getScaleDegreeInterval(mode, scaleDegreeIndex + 4) - rootInterval;

  if (fifthInterval === DIMINISHED_FIFTH) {
    return 'diminished';
  }
  if (fifthInterval === AUGMENTED_FIFTH) {
    return 'augmented';
  }
  // חמישית מושלמת — המקרה השכיח בשבעת המודים הדיאטוניים; האיכות נקבעת לפי השלישית בלבד.
  return thirdInterval === MAJOR_THIRD ? 'major' : 'minor';
}
