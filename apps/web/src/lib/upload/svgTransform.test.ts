import { describe, expect, it } from 'vitest';
import {
  applyMatrix,
  IDENTITY_MATRIX,
  multiplyMatrices,
  parseTransformAttribute,
} from './svgTransform';

describe('parseTransformAttribute + applyMatrix', () => {
  it('מחזיר זהות עבור ערך ריק/null', () => {
    expect(parseTransformAttribute(null)).toEqual(IDENTITY_MATRIX);
    expect(parseTransformAttribute('')).toEqual(IDENTITY_MATRIX);
  });

  it('translate(x,y) מזיז נקודה', () => {
    const matrix = parseTransformAttribute('translate(10,20)');
    expect(applyMatrix(matrix, { x: 0, y: 0 })).toEqual({ x: 10, y: 20 });
  });

  it('scale(s) מכפיל שני הצירים כשיש ארגומנט יחיד', () => {
    const matrix = parseTransformAttribute('scale(2)');
    expect(applyMatrix(matrix, { x: 3, y: 4 })).toEqual({ x: 6, y: 8 });
  });

  it('scale(sx,sy) מכפיל כל ציר בנפרד', () => {
    const matrix = parseTransformAttribute('scale(2,3)');
    expect(applyMatrix(matrix, { x: 1, y: 1 })).toEqual({ x: 2, y: 3 });
  });

  it('rotate(90) סביב הראשית הופך (1,0) ל-(0,1) בקירוב', () => {
    const matrix = parseTransformAttribute('rotate(90)');
    const result = applyMatrix(matrix, { x: 1, y: 0 });
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  it('rotate(deg,cx,cy) סובב סביב נקודה שאינה הראשית', () => {
    const matrix = parseTransformAttribute('rotate(180,5,5)');
    const result = applyMatrix(matrix, { x: 5, y: 0 });
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(10);
  });

  it('matrix(a,b,c,d,e,f) משמש ישירות', () => {
    const matrix = parseTransformAttribute('matrix(1,0,0,1,7,8)');
    expect(applyMatrix(matrix, { x: 0, y: 0 })).toEqual({ x: 7, y: 8 });
  });

  it('משרשר כמה טוקנים בסדר הופעתם', () => {
    const matrix = parseTransformAttribute('translate(10,0) scale(2)');
    // per spec: translate(10,0) * scale(2) — מפעילים scale על הנקודה קודם, ואז translate
    expect(applyMatrix(matrix, { x: 1, y: 1 })).toEqual({ x: 12, y: 2 });
  });

  it('multiplyMatrices עם הזהות לא משנה כלום', () => {
    const matrix = parseTransformAttribute('translate(3,4)');
    expect(multiplyMatrices(IDENTITY_MATRIX, matrix)).toEqual(matrix);
  });

  it('מתעלם בשקט מ-skewX/skewY (לא נתמך, אבל לא זורק)', () => {
    expect(() => parseTransformAttribute('skewX(20)')).not.toThrow();
  });
});
