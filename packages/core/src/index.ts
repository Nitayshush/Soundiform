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
export * from './mapping/geometryToMusic';

export * from './theory/scales';
export * from './theory/chords';
export * from './theory/voiceLeading';
export * from './theory/rules';
export * from './theory/harmonyEngine';
export * from './groove/quantize';
export * from './groove/humanize';

// TODO(Sprint 4+): ייצוא arrangement/ ככל שייבנה (intro/build/outro — לא בהיקף Sprint 3).
