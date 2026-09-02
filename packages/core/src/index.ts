/**
 * @file        index.ts
 * @description נקודת הכניסה של packages/core.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

export * from './score/MusicalScore';
export * from './score/scoreSchema';

export * from './analysis/contourExtractor';
export * from './analysis/shapeAnalyzer';
export * from './analysis/symmetryDetector';
export * from './analysis/boardRaster';
export * from './analysis/onsetEvents';
export * from './mapping/geometryToMusic';

export * from './theory/scales';
export * from './theory/chords';
export * from './theory/voiceLeading';
export * from './theory/rules';
export * from './theory/harmonyEngine';
export * from './theory/noteBoard';
export * from './theory/drumKit';
export * from './theory/beatPattern';
export * from './theory/rolePolicy';
export * from './theory/progression';
export * from './groove/quantize';
export * from './groove/humanize';

// ⚠️ 2026-09-01: כאן היה ייצוא של arrangement/. הפיצ'ר נבנה והוסר באותו יום לבקשת הפאונדר —
// ראה docs/DECISIONS.md לסיבה המבנית (הוא רץ אחרי קביעת הכלים ולכן יכול היה רק להסיר תווים).
// התיקייה נשארת ריקה, כמו שהייתה מ-Sprint 3.
