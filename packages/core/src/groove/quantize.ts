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
