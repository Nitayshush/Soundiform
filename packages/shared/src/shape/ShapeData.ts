/**
 * @file        ShapeData.ts
 * @description ⭐ הפורמט המשותף של "צורה כווקטור" — בין הציור (apps/web) לניתוח (packages/core, Sprint 2).
 *              נשמר ב-DB תחת projects.shape_data (§6).
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה כאן ולא ב-core:
 * זה פורמט חליפין (interchange format) בין קלט הציור לשכבת הניתוח — לא לוגיקת ניתוח בעצמה.
 * core תלוי ב-shared (לא להפך), כך ששני הצדדים יכולים להשתמש באותו טיפוס בלי תלות מעגלית.
 */

/** נקודה על הצורה, מנורמלת לטווח 0–1 בשני הצירים (בלתי תלויה ברזולוציית הקנבס). */
export interface ShapePoint {
  x: number;
  y: number;
}

/** מסלול רציף אחד (stroke) — ציור עשוי יכול להכיל כמה מסלולים. */
export interface ShapePath {
  points: ShapePoint[];
  closed: boolean;
}

/**
 * ⭐ 2026-09-21 (לפי בקשה חיה: "שצבעי הציור יישמרו גם ביצירת המוזיקה"): עיצוב חזותי
 * (צבע/עובי-קו) של path בודד — index-aligned עם ShapeData.paths. הוגדר כאן (לא רק ב-
 * apps/web's shapeStore.ts, שם נולד לראשונה ב-Kids Studio) כדי שיוכל לנסוע בתוך ShapeData
 * עצמו דרך כל הצנרת הקיימת (שמירה→DB→רינדור-במכשיר/worker) בלי שרשור נפרד בכל שכבה.
 */
export interface PathStyle {
  color: string;
  strokeWidth: number;
}

export interface ShapeData {
  version: string;
  paths: ShapePath[];
  /**
   * ⚠️ אופציונלי ולא חלק מ-computeShapeHash (shapeHash.ts בונה אובייקט-קנוני ידני שקורא
   * רק paths) — צבע לעולם לא משפיע על המוזיקה שנוצרת, רק על התצוגה (§4.2). כשחסר/קצר
   * מ-paths, כל צרכן נופל לברירת-המחדל שלו (ראה DrawingCanvas.tsx/ScoreStaff.tsx/drawFrame.ts).
   */
  pathStyles?: PathStyle[];
}
