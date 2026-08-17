/**
 * @file        geometryToMusic.ts
 * @description ⭐ הליבה הקניינית — שכבה 2 (Mapping) של מנוע ההמרה. ראה PROJECT.md §4.1, §4.2.
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ הפלט כאן הוא RawMusicalIntent — לא MusicalScore. לפי הארכיטקטורה (§4.1), שכבה 2 ממפה
 * גאומטריה לפרמטרים מוזיקליים "גולמיים" בלי אכיפת סולם/הרמוניה/voice-leading — זו עבודת
 * שכבה 3 (Theory & Taste, Sprint 3) שעדיין לא קיימת. אין לאלץ את הפלט הזה לתוך MusicalScore
 * בטרם עת — זה בדיוק מה ש"רשת הביטחון" ההרמונית (§4.3) אמורה למנוע.
 */

import type { ShapeData } from '@shape-sound/shared';
import { z } from 'zod';
import { extractContour } from '../analysis/contourExtractor';
import { analyzeShape } from '../analysis/shapeAnalyzer';
import { detectSymmetry, type SymmetryResult } from '../analysis/symmetryDetector';
import type { ShapeFeatures } from '../analysis/shapeAnalyzer';

const RESAMPLE_COUNT = 64;
/** יחס קודקודים/נקודות-דגימה שמעליו הצורה נחשבת "חדה" (סטקטו) ולא "חלקה" (לגאטו). */
const SHARPNESS_THRESHOLD = 0.15;
/** מנרמל היקף (לא שטח — לצורה פתוחה אין שטח מוגדר) לטווח 0–1 כקירוב ל"מילוי". */
const OPEN_SHAPE_PERIMETER_NORMALIZER = 4;

export const symmetryTransformSchema = z.enum([
  'none',
  'retrograde',
  'inversion',
  'retrograde-inversion',
]);
export type SymmetryTransform = z.infer<typeof symmetryTransformSchema>;

export const articulationHintSchema = z.enum(['staccato', 'legato']);
export type ArticulationHint = z.infer<typeof articulationHintSchema>;

export const rawMusicalIntentSchema = z.object({
  seed: z.string().min(1),
  loop: z.boolean(),
  motifSize: z.number().int().positive(),
  pitchContour: z.array(z.number().min(0).max(1)).min(1),
  symmetryTransform: symmetryTransformSchema,
  rotationalOrder: z.number().int().positive(),
  articulation: articulationHintSchema,
  velocityHint: z.number().min(0).max(1),
  durationHint: z.number().min(0).max(1),
  rhythmicDensityHint: z.number().min(0).max(1),
});

/**
 * "כוונה מוזיקלית גולמית" — פלט שכבת ה-Mapping, לפני אכיפת חוקה מוזיקלית (§4.3, Sprint 3).
 */
export type RawMusicalIntent = z.infer<typeof rawMusicalIntentSchema>;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toSymmetryTransform(symmetry: SymmetryResult): SymmetryTransform {
  if (symmetry.horizontalMirror && symmetry.verticalMirror) {
    return 'retrograde-inversion';
  }
  if (symmetry.horizontalMirror) {
    return 'retrograde';
  }
  if (symmetry.verticalMirror) {
    return 'inversion';
  }
  return 'none';
}

/** גודל מוטיב ממספר קודקודים (§4.2: משולש→3 תווים) — לצורות חלקות (עיגול) נופל חזרה לסדר הסיבוב. */
function computeMotifSize(features: ShapeFeatures, symmetry: SymmetryResult): number {
  if (features.vertexCount >= 3) {
    return features.vertexCount;
  }
  return Math.max(symmetry.rotationalOrder, 3);
}

function computeArticulation(features: ShapeFeatures): ArticulationHint {
  const sharpness = features.vertexCount / RESAMPLE_COUNT;
  return sharpness > SHARPNESS_THRESHOLD ? 'staccato' : 'legato';
}

/**
 * "מילוי" נורמלי (0–1) לשימוש כבסיס ל-velocity/duration (§4.2: שטח/מילוי → וולוסיטי + משך).
 * לצורה סגורה — שטח בפועל. לצורה פתוחה אין שטח מוגדר — נעזרים בהיקף כקירוב.
 */
function computeFillHint(features: ShapeFeatures): number {
  if (features.closed) {
    return clamp01(features.area);
  }
  return clamp01(features.perimeter / OPEN_SHAPE_PERIMETER_NORMALIZER);
}

/**
 * ממפה צורה גאומטרית (ShapeData) ל-RawMusicalIntent.
 *
 * @param shape     הצורה כווקטור (Sprint 1)
 * @param shapeHash  ה-hash הדטרמיניסטי של הצורה — מועבר כ-seed לשימור עקרון הדטרמיניזם (§1)
 */
export function geometryToMusic(shape: ShapeData, shapeHash: string): RawMusicalIntent {
  const contour = extractContour(shape, RESAMPLE_COUNT);
  const features = analyzeShape(contour);
  const symmetry = detectSymmetry(contour);

  const fillHint = computeFillHint(features);

  const intent: RawMusicalIntent = {
    seed: shapeHash,
    loop: contour.closed,
    motifSize: computeMotifSize(features, symmetry),
    pitchContour: contour.points.map((point) => point.y),
    symmetryTransform: toSymmetryTransform(symmetry),
    rotationalOrder: symmetry.rotationalOrder,
    articulation: computeArticulation(features),
    // v1: velocity ו-duration נגזרים מאותו אות "מילוי" גולמי — Sprint 4/5 (genre packs, mixSettings)
    // צפויים להבחין ביניהם לפי סגנון. ראה §4.5: הצורה קובעת תוכן, הסגנון קובע לבוש.
    velocityHint: fillHint,
    durationHint: fillHint,
    // v1: אותו אות קודקודים/דגימות כמו articulation — מדד "צפיפות קצוות" ייעודי (למשל אורך-קשת
    // בין שינויי כיוון) הוא שיפור עתידי אם יתברר שהמיפוי הזה גס מדי בפועל.
    rhythmicDensityHint: features.vertexCount / RESAMPLE_COUNT,
  };

  return rawMusicalIntentSchema.parse(intent);
}
