/**
 * @file        ShapeData.ts
 * @description ⭐ הפורמט המשותף של "צורה כווקטור" — בין הציור (apps/web) לניתוח (packages/core, Sprint 2).
 *              נשמר ב-DB תחת projects.shape_data (§6).
 * @author      Shape-to-Sound
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

export interface ShapeData {
  version: string;
  paths: ShapePath[];
}
