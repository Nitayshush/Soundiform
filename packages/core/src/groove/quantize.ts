/**
 * @file        quantize.ts
 * @description מצמיד תזמון (ticks) לגריד ריתמי — §4.3 כלל קשיח "הכל מקוונטז לגריד".
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

/** רזולוציית MIDI סטנדרטית — ticks לרבע-תו. ראה גם apps/worker/src/encoders/midi.ts העתידי. */
export const TICKS_PER_BEAT = 480;
const BEATS_PER_WHOLE_NOTE = 4;

export type GridSubdivision = 8 | 16 | 32;

/** מספר ה-ticks של יחידת גריד אחת (למשל, subdivision=16 → אורך של תו-שש-עשרה). */
export function ticksPerGridUnit(subdivision: GridSubdivision): number {
  return (TICKS_PER_BEAT * BEATS_PER_WHOLE_NOTE) / subdivision;
}

/** מצמיד tick גולמי לגריד הקרוב ביותר. */
export function quantizeToGrid(rawTick: number, subdivision: GridSubdivision = 16): number {
  const gridUnit = ticksPerGridUnit(subdivision);
  return Math.round(rawTick / gridUnit) * gridUnit;
}

/** true אם ה-tick כבר מיושר בדיוק לגריד. */
export function isOnGrid(tick: number, subdivision: GridSubdivision = 16): boolean {
  return distanceFromGrid(tick, subdivision) === 0;
}

/** המרחק (ב-ticks) בין tick נתון לנקודת הגריד הקרובה ביותר — משמש ל-rules.ts עם טולרנס הומניזציה. */
export function distanceFromGrid(tick: number, subdivision: GridSubdivision = 16): number {
  const gridUnit = ticksPerGridUnit(subdivision);
  const remainder = ((tick % gridUnit) + gridUnit) % gridUnit;
  return Math.min(remainder, gridUnit - remainder);
}

/**
 * מזיז tick שכבר מקוונטז (על step מדויק) לפי סווינג (§5.1 grid.swingAmount) — כל step שני
 * ("off-beat") נדחה עד חצי יחידת-גריד, יחסית ל-swingAmount. swing הוא עדיין "מקוונטז" במובן
 * המהותי של §4.3: התזמון נגזר לגמרי מהגריד + פרמטר קבוע, לא שרירותי.
 */
export function applySwing(
  quantizedTick: number,
  subdivision: GridSubdivision = 16,
  swingAmount = 0,
): number {
  if (swingAmount <= 0) {
    return quantizedTick;
  }
  const gridUnit = ticksPerGridUnit(subdivision);
  const stepIndex = Math.round(quantizedTick / gridUnit);
  const isOffBeatStep = ((stepIndex % 2) + 2) % 2 === 1;
  if (!isOffBeatStep) {
    return quantizedTick;
  }
  return quantizedTick + gridUnit * 0.5 * swingAmount;
}

/**
 * המרחק בין tick בפועל לבין המיקום ה"מקוונטז-מוסווג" הצפוי שלו (הגריד הקרוב ביותר + סווינג) —
 * גרסת rules.ts של applySwing, לבדיקת עמידה בגריד גם כשיש סווינג פעיל.
 */
export function distanceFromSwingGrid(
  tick: number,
  subdivision: GridSubdivision = 16,
  swingAmount = 0,
): number {
  const gridUnit = ticksPerGridUnit(subdivision);
  const rawGridTick = Math.round(tick / gridUnit) * gridUnit;
  const swungTick = applySwing(rawGridTick, subdivision, swingAmount);
  return Math.abs(tick - swungTick);
}
