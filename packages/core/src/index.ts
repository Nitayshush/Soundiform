/**
 * @file        index.ts
 * @description נקודת הכניסה של packages/core.
 * @author      Shape-to-Sound
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

// TODO(Sprint 3+): ייצוא theory/, groove/, arrangement/ ככל שייבנו.
