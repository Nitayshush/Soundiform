/**
 * @file        humanize.ts
 * @description מוסיף סטיית תזמון/וולוסיטי קלה ("רעד יד" ריתמי, ±10ms) — §3 עץ התיקיות.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי: משתמש **רק** ב-createSeededRandom (internal/seededRandom.ts), אף פעם לא
 * Math.random() — אחרת עקרון הדטרמיניזם (§1) נשבר: אותה צורה תישמע שונה בכל רנדור.
 */

import { TICKS_PER_BEAT } from './quantize';

const MAX_TIMING_JITTER_MS = 10;
const DEFAULT_VELOCITY_JITTER_AMOUNT = 0.05;

function millisecondsToTicks(milliseconds: number, tempoBpm: number): number {
  const millisecondsPerBeat = 60000 / tempoBpm;
  return (milliseconds / millisecondsPerBeat) * TICKS_PER_BEAT;
}

/**
 * הסטייה המקסימלית (בטיקים) שהומניזציה יכולה להזיז תזמון, בטמפו נתון — מיוצא כדי ש-rules.ts
 * יוכל לאמת "מקוונטז לגריד" בטולרנס הנכון (הומניזציה היא סטייה *מכוונת* מהגריד, לא הפרה שלו).
 */
export function maxTimingJitterTicks(tempoBpm: number): number {
  return millisecondsToTicks(MAX_TIMING_JITTER_MS, tempoBpm);
}

/**
 * מזיז tick ב-±MAX_TIMING_JITTER_MS מילישניות (מתורגם ל-ticks לפי הטמפו), דטרמיניסטית.
 * @param random  פונקציית [0,1) דטרמיניסטית — ראה internal/seededRandom.ts
 */
export function humanizeTiming(tick: number, tempoBpm: number, random: () => number): number {
  const maxJitterTicks = maxTimingJitterTicks(tempoBpm);
  const jitter = (random() * 2 - 1) * maxJitterTicks;
  return Math.max(0, Math.round(tick + jitter));
}

/** מזיז וולוסיטי ב-±amount (יחסי לטווח 0-1), דטרמיניסטית, בלי לחצות את גבולות [0,1]. */
export function humanizeVelocity(
  velocity: number,
  random: () => number,
  amount: number = DEFAULT_VELOCITY_JITTER_AMOUNT,
): number {
  const jitter = (random() * 2 - 1) * amount;
  return Math.min(1, Math.max(0, velocity + jitter));
}
