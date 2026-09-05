/**
 * @file        kidsShapes.ts
 * @description ⭐ 2026-09-04 (Kids Studio v1): מחולל נקודות לצורות מוכנות (עיגול/ריבוע/
 *              משולש/כוכב/לב) — הפלט הוא ShapePoint[] רגיל, בדיוק כמו קו-יד לאחר פישוט
 *              (Ramer-Douglas-Peucker), אז הוא נכנס ל-shapeStore.addPath בלי שום שינוי
 *              במודל הנתונים/hash. ראה shapeStore.ts.
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ פונקציות טהורות ודטרמיניסטיות בכוונה — קלט זהה => פלט זהה, כמו כל שאר צינור הצורה
 * (shapeHash תלוי בזה). מרחב קואורדינטות מנורמל [0,1] בשני הצירים, זהה למוסכמה הקיימת
 * (ראה toNormalizedPoint ב-DrawingCanvas.tsx) — כל נקודה מהודקת (clamp) ל-[0,1].
 */

import type { ShapePath, ShapePoint } from '@soundiform/shared';

export type KidsShapeKind = 'circle' | 'square' | 'triangle' | 'star' | 'heart';

export const KIDS_SHAPE_KINDS: readonly KidsShapeKind[] = [
  'circle',
  'square',
  'triangle',
  'star',
  'heart',
];

const CIRCLE_SEGMENTS = 48;
const HEART_SEGMENTS = 48;
const STAR_TIPS = 5;
const STAR_INNER_RATIO = 0.4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function point(x: number, y: number): ShapePoint {
  return { x: clamp01(x), y: clamp01(y) };
}

function circlePoints(cx: number, cy: number, radius: number): ShapePoint[] {
  const points: ShapePoint[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i += 1) {
    const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    points.push(point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)));
  }
  return points;
}

function squarePoints(cx: number, cy: number, radius: number): ShapePoint[] {
  return [
    point(cx - radius, cy - radius),
    point(cx + radius, cy - radius),
    point(cx + radius, cy + radius),
    point(cx - radius, cy + radius),
  ];
}

function trianglePoints(cx: number, cy: number, radius: number): ShapePoint[] {
  // ⚠️ מתחיל מ- -90° (קודקוד למעלה) — מראה "משולש" מוכר, לא צורה שרירותית מסובבת.
  const angles = [0, 1, 2].map((i) => (i / 3) * Math.PI * 2 - Math.PI / 2);
  return angles.map((angle) => point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)));
}

function starPoints(cx: number, cy: number, radius: number): ShapePoint[] {
  const innerRadius = radius * STAR_INNER_RATIO;
  const tips = STAR_TIPS * 2;
  const points: ShapePoint[] = [];
  for (let i = 0; i < tips; i += 1) {
    const angle = (i / tips) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? radius : innerRadius;
    points.push(point(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
  }
  return points;
}

function heartPoints(cx: number, cy: number, radius: number): ShapePoint[] {
  const points: ShapePoint[] = [];
  for (let i = 0; i < HEART_SEGMENTS; i += 1) {
    const t = (i / HEART_SEGMENTS) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    // ⚠️ hy מוחסר (לא מתווסף) — הנוסחה הקלאסית מניחה y-כלפי-מעלה (חוד הלב ב-y שלילי,
    // כלומר "למטה" במובן מתמטי). במרחב מסך y-כלפי-מטה חייבים להפוך סימן כדי שהחוד יישאר
    // למטה על המסך ולא יתהפך.
    points.push(point(cx + (hx / 17) * radius, cy - (hy / 17) * radius));
  }
  return points;
}

/**
 * @param cx,cy מרכז הצורה, מנורמל [0,1].
 * @param size קוטר-בערך (הצורה משתרעת size/2 מהמרכז) — כך שגרירת "הגדל/הקטן" בתצוגה
 * המקדימה (ShapePlacementOverlay) ממפה ישירות ל-size בלי המרה נוספת.
 *
 * ⚠️ מניח מרחב **מרובע** (רדיוס שווה מנורמל בשני הצירים) — נכון רק כשהמיכל שהצורה תצויר
 * עליו הוא בעצמו מרובע. על מיכל 16:9 (כמו לוח הציור בפועל) "עיגול" עם רדיוס שווה מנורמל
 * יוצא אליפסה: יחידת-y מנורמלת מכסה מרחק פיזי שונה מיחידת-x. ראה applyAspectRatio למטה —
 * הקורא (ShapePlacementOverlay) **חייב** להפעיל אותה עם יחס-הרוחב/גובה האמיתי של המיכל.
 */
export function generateShapePoints(
  kind: KidsShapeKind,
  cx: number,
  cy: number,
  size: number,
): ShapePoint[] {
  const radius = size / 2;
  switch (kind) {
    case 'circle':
      return circlePoints(cx, cy, radius);
    case 'square':
      return squarePoints(cx, cy, radius);
    case 'triangle':
      return trianglePoints(cx, cy, radius);
    case 'star':
      return starPoints(cx, cy, radius);
    case 'heart':
      return heartPoints(cx, cy, radius);
  }
}

/**
 * ⭐ 2026-09-04: מתקן צורה מ-generateShapePoints (מרחב מרובע) כך שתיראה נכונה על מיכל
 * שאינו מרובע — ראה האזהרה למעלה. aspectRatio = רוחב/גובה המיכל בפועל (פיקסלים).
 *
 * למה רק ציר y זז: x נשאר "ציר הייחוס" ללא שינוי; y מוזז ביחס ל-cy לפי aspectRatio, כך
 * שאחרי ש-DrawingCanvas ימתח כל נקודה חזרה ב-(canvasWidth, canvasHeight) בנפרד — בדיוק
 * כמו שקרה כאן בכיוון ההפוך — הרדיוס הפיזי בפועל שווה בשני הצירים.
 */
export function applyAspectRatio(
  points: ShapePoint[],
  cy: number,
  aspectRatio: number,
): ShapePoint[] {
  return points.map((p) => point(p.x, cy + (p.y - cy) * aspectRatio));
}

/**
 * ⭐ 2026-09-05 (Kids Studio — סטיקר אימוג'י כצורה): מייצר בבת אחת עיגול מתוקן-aspect,
 * מוכן ל-addPath/updatePath. מרוכז כאן כי הוא נקרא משני מקומות (ShapePlacementOverlay
 * בהצבה ראשונה, EmojiStickerLayer בעדכון אחרי גרירה) — לא לשכפל את הצירוף
 * generateShapePoints+applyAspectRatio פעמיים.
 */
export function generateStickerCirclePath(
  cx: number,
  cy: number,
  size: number,
  aspectRatio: number,
): ShapePath {
  return {
    points: applyAspectRatio(generateShapePoints('circle', cx, cy, size), cy, aspectRatio),
    closed: true,
  };
}
