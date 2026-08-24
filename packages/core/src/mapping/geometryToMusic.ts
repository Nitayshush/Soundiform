/**
 * @file        geometryToMusic.ts
 * @description ⭐ הליבה הקניינית — שכבה 2 (Mapping) של מנוע ההמרה. ראה PROJECT.md §4.1, §4.2.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ הפלט כאן הוא RawMusicalIntent — לא MusicalScore. לפי הארכיטקטורה (§4.1), שכבה 2 ממפה
 * גאומטריה לפרמטרים מוזיקליים "גולמיים" בלי אכיפת סולם/הרמוניה/voice-leading — זו עבודת
 * שכבה 3 (Theory & Taste, Sprint 3) שעדיין לא קיימת. אין לאלץ את הפלט הזה לתוך MusicalScore
 * בטרם עת — זה בדיוק מה ש"רשת הביטחון" ההרמונית (§4.3) אמורה למנוע.
 *
 * ⭐ 2026-08-23 (§4.2 תיקון): pitchContour עבר מ-contour.points (שדוגם מחדש לפי אורך-קשת,
 * כלומר בפועל "סדר-ציור → זמן") ל-resampleByX (xAxisResample.ts, "מיקום-X → זמן" האמיתי —
 * זה מה ש-§4.2 תמיד תיאר, רק לא היה ממומש כך). contour עצמו (arc-length) נשאר ללא שינוי
 * ומשמש כאן רק את analyzeShape/detectSymmetry, שצריכים נאמנות גאומטרית, לא פרשנות-זמן.
 *
 * ⭐ 2026-08-23: כל משיכת-עט תורמת ליצירה, לא רק ה-path הדומיננטי — pitchContour נבנה מכל
 * ה-paths יחד (resampleByX מקבל את כולם), ו-motifSize (→ אורך היצירה בבארים + מספר תווי
 * המלודיה בפועל) מצטבר תוספתית: ה-path הדומיננטי משתמש ב-computeMotifSize הקיים (בלי שינוי
 * להתנהגות המוכרת), וכל path *נוסף* תורם max(vertexCount, 3) משלו — כך שציור עם יותר
 * משיכות באמת יוצר יצירה ארוכה/עשירה יותר, לא רק ויזואל נוסף. loop/symmetryTransform
 * נשארים נגזרים מה-path הדומיננטי בלבד (האופי הכללי של הצורה, לא "כמה צויר").
 *
 * ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 3): sizeHint חדש — אלכסון ה-bounding-box
 * *המאוחד* (כל ה-paths יחד, לא רק הדומיננטי) מנורמל לאלכסון הקנבס המלא. harmonyEngine.ts
 * מכפיל בו את בסיס-חישוב durationBars, כך שציור פיזית-גדול יוצר יצירה ארוכה יותר — לא רק
 * ציור עם הרבה קודקודים (motifSize, שממשיך לקבוע *כמות תווים*, מושג נפרד). נבחר אלכסון-
 * bbox ולא shapeAnalyzer.ts's `area` כי area=0 לצורות פתוחות (קו בודד) — בדיוק המקרה
 * הכי-בעייתי שדווח (יצירה שרובה שקטה, §11 שיפור-סאונד).
 */

import type { ShapeData, ShapePath } from '@soundiform/shared';
import { z } from 'zod';
import { extractContour, pickPrimaryPath, isNearlyClosed } from '../analysis/contourExtractor';
import { analyzeShape } from '../analysis/shapeAnalyzer';
import { detectSymmetry, type SymmetryResult } from '../analysis/symmetryDetector';
import type { ShapeFeatures } from '../analysis/shapeAnalyzer';
import { resampleByX } from '../analysis/xAxisResample';

const RESAMPLE_COUNT = 64;
/** יחס קודקודים/נקודות-דגימה שמעליו הצורה נחשבת "חדה" (סטקטו) ולא "חלקה" (לגאטו). */
const SHARPNESS_THRESHOLD = 0.15;
/** מנרמל היקף (לא שטח — לצורה פתוחה אין שטח מוגדר) לטווח 0–1 כקירוב ל"מילוי". */
const OPEN_SHAPE_PERIMETER_NORMALIZER = 4;
/** תרומה מינימלית ל-motifSize מ-path נוסף (לא-דומיננטי) — גם משיכה חלקה תורם משהו. */
const MIN_MOTIF_CONTRIBUTION_PER_STROKE = 3;
/** תקרת motifSize כוללת — תואם RESAMPLE_COUNT: ל-pitchContour יש רק 64 ערכים נבדלים ממילא. */
const MAX_MOTIF_SIZE = RESAMPLE_COUNT;
/** אלכסון קנבס מלא בקואורדינטות מנורמלות [0,1]×[0,1] — המנרמל של sizeHint (Area 3). */
const MAX_SIZE_DIAGONAL = Math.SQRT2;

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
  sizeHint: z.number().min(0).max(1),
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

/** תרומת path בודד (לא-דומיננטי) ל-motifSize הכולל — משתמש ב-extractContour/analyzeShape
 * הקיימים על צורה סינתטית עם ה-path הזה בלבד, בלי שום קוד גיאומטריה חדש. */
function computeStrokeContribution(path: ShapePath): number {
  const contour = extractContour({ version: '1.0.0', paths: [path] }, RESAMPLE_COUNT);
  const features = analyzeShape(contour);
  return Math.max(features.vertexCount, MIN_MOTIF_CONTRIBUTION_PER_STROKE);
}

/** motifSize הכולל: ה-path הדומיננטי כרגיל, ועוד תרומה מכל path נוסף — יותר משיכות = יצירה ארוכה יותר. */
function computeTotalMotifSize(
  shape: ShapeData,
  primaryPath: ShapePath,
  primaryFeatures: ShapeFeatures,
  primarySymmetry: SymmetryResult,
): number {
  const primaryContribution = computeMotifSize(primaryFeatures, primarySymmetry);
  const otherContributions = shape.paths
    .filter((path) => path !== primaryPath)
    .map(computeStrokeContribution);
  const total = primaryContribution + otherContributions.reduce((sum, value) => sum + value, 0);
  return Math.min(MAX_MOTIF_SIZE, total);
}

/**
 * גודל הציור (0–1): אלכסון bounding-box *מאוחד* על פני כל ה-paths (לא רק הדומיננטי) —
 * ציור עם כמה משיכות פזורות נחשב "גדול" גם אם כל משיכה בודדת קטנה. אלכסון (לא שטח) כי
 * גם צורה פתוחה (קו בודד) חייבת אות-גודל משמעותי — §11 שיפור-סאונד.
 */
function computeSizeHint(shape: ShapeData): number {
  const allPoints = shape.paths.flatMap((path) => path.points);
  if (allPoints.length === 0) {
    return 0;
  }
  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return clamp01(diagonal / MAX_SIZE_DIAGONAL);
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
  const primaryPath = pickPrimaryPath(shape.paths);
  const resamplePaths = shape.paths.map((path) => ({
    points: path.points,
    closed: path.closed || isNearlyClosed(path.points),
  }));

  const intent: RawMusicalIntent = {
    seed: shapeHash,
    loop: contour.closed,
    motifSize: computeTotalMotifSize(shape, primaryPath, features, symmetry),
    sizeHint: computeSizeHint(shape),
    pitchContour: resampleByX(resamplePaths, RESAMPLE_COUNT),
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
