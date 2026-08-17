/**
 * @file        shapeHash.ts
 * @description ⭐ חישוב hash דטרמיניסטי לצורה — הבסיס ל-seed של MusicalScore (§4.6, עקרון הדטרמיניזם §1).
 * @author      Shape-to-Sound
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה Web Crypto (crypto.subtle) ולא ספריית hash חיצונית:
 * crypto.subtle.digest קיים גם בדפדפן וגם ב-Node 22 (globalThis.crypto) עם אותה התנהגות בדיוק —
 * מבטיח שאותה צורה מייצרת את אותו hash גם בפריוויו וגם ברנדור בשרת, בלי תלות נוספת.
 *
 * למה עיגול הקואורדינטות לפני החישוב:
 * רעש תת-פיקסלי (float jitter) בין מכשירי קלט שונים לא יכול לשבור את הדטרמיניזם —
 * "אותה צורה" מוגדרת כשווה עד רזולוציה של 4 ספרות אחרי הנקודה.
 */

import type { ShapeData, ShapePoint } from './ShapeData';

const COORDINATE_PRECISION = 4;

function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

function canonicalizePoint(point: ShapePoint): ShapePoint {
  return { x: roundCoordinate(point.x), y: roundCoordinate(point.y) };
}

function canonicalizeShapeData(shape: ShapeData): string {
  const canonical = {
    paths: shape.paths.map((path) => ({
      closed: path.closed,
      points: path.points.map(canonicalizePoint),
    })),
  };
  return JSON.stringify(canonical);
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * מחשב hash דטרמיניסטי (SHA-256, hex) עבור ShapeData נתון.
 * שני ShapeData "שווים מבחינה גאומטרית" (עד רזולוציית העיגול) תמיד יניבו את אותו hash.
 */
export async function computeShapeHash(shape: ShapeData): Promise<string> {
  const canonical = canonicalizeShapeData(shape);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(digest);
}
