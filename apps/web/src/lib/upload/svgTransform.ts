/**
 * @file        svgTransform.ts
 * @description מטריצות 2D אפיניות (affine) — לצבירת transform לאורך עץ ה-SVG (הורה←ילד),
 *              כדי שנקודות מ-<path>/<rect>/וכו' יומרו למרחב הקואורדינטות הגלובלי הנכון לפני
 *              נרמול ל-0–1. jsdom לא מממש getCTM()/getScreenCTM() ל-SVG — אין דרך "מובנית".
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מכסה רק translate/scale/rotate/matrix (הנפוצים בפועל בלוגואים/אייקונים מיוצאים) —
 * skewX/skewY לא נתמכים (נדירים, ומתעלמים מהם בשקט — לא זורקים, כדי לא לחסום קבצים תקינים).
 */

export type Matrix2D = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0];

export function multiplyMatrices(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function applyMatrix(
  matrix: Matrix2D,
  point: { x: number; y: number },
): {
  x: number;
  y: number;
} {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

const NUMBER_LIST = /-?[\d.]+(?:e-?\d+)?/gi;

function numbersOf(argsText: string): number[] {
  return (argsText.match(NUMBER_LIST) ?? []).map(Number);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function matrixForToken(name: string, argsText: string): Matrix2D | null {
  const args = numbersOf(argsText);
  switch (name) {
    case 'matrix': {
      if (args.length !== 6) return null;
      return args as unknown as Matrix2D;
    }
    case 'translate': {
      const [tx = 0, ty = 0] = args;
      return [1, 0, 0, 1, tx, ty];
    }
    case 'scale': {
      const [sx = 1, sy = sx] = args;
      return [sx, 0, 0, sy, 0, 0];
    }
    case 'rotate': {
      const [deg = 0, cx = 0, cy = 0] = args;
      const rad = toRadians(deg);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rotation: Matrix2D = [cos, sin, -sin, cos, 0, 0];
      if (cx === 0 && cy === 0) {
        return rotation;
      }
      return multiplyMatrices(multiplyMatrices([1, 0, 0, 1, cx, cy], rotation), [
        1,
        0,
        0,
        1,
        -cx,
        -cy,
      ]);
    }
    default:
      return null;
  }
}

const TRANSFORM_TOKEN = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;

/** מפרסר `transform="..."` לרשימת טוקנים, מרכיב מטריצה אחת (סדר-שמאל-לימין לפי מפרט ה-SVG). */
export function parseTransformAttribute(value: string | null | undefined): Matrix2D {
  if (!value) {
    return IDENTITY_MATRIX;
  }
  let result = IDENTITY_MATRIX;
  for (const match of value.matchAll(TRANSFORM_TOKEN)) {
    const [, name, argsText] = match;
    if (!name || argsText === undefined) continue;
    const tokenMatrix = matrixForToken(name.toLowerCase(), argsText);
    if (tokenMatrix) {
      result = multiplyMatrices(result, tokenMatrix);
    }
  }
  return result;
}
