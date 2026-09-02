import { describe, expect, it } from 'vitest';
import { flattenPathData, MAX_POINTS_PER_SUBPATH } from './svgPathFlatten';

describe('flattenPathData', () => {
  it('משטח קו ישר (M/L) לשני נקודות, לא-סגור', () => {
    const [subpath] = flattenPathData('M0,0 L10,10');
    expect(subpath?.closed).toBe(false);
    expect(subpath?.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it('מזהה Z כסגור וחוזר לנקודת ההתחלה', () => {
    const [subpath] = flattenPathData('M0,0 L10,0 L10,10 Z');
    expect(subpath?.closed).toBe(true);
    expect(subpath?.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('משטח cubic bezier (C) למספר נקודות ביניים, לא רק לנקודת הקצה', () => {
    const [subpath] = flattenPathData('M0,0 C0,10 10,10 10,0');
    expect(subpath?.points.length).toBeGreaterThan(2);
    const last = subpath?.points.at(-1);
    expect(last).toEqual({ x: 10, y: 0 });
  });

  it('ממיר quadratic bezier (Q) ל-cubic (qtToC) ומשטח באותה צורה', () => {
    const [subpath] = flattenPathData('M0,0 Q5,10 10,0');
    expect(subpath?.points.length).toBeGreaterThan(2);
    const last = subpath?.points.at(-1);
    expect(last?.x).toBeCloseTo(10);
    expect(last?.y).toBeCloseTo(0);
  });

  it('ממיר קשת (A) ל-cubic (aToC) ומשטח אותה — למשל חצי מעגל', () => {
    const [subpath] = flattenPathData('M0,0 A5,5 0 0 1 10,0');
    expect(subpath?.points.length).toBeGreaterThan(2);
    // חצי מעגל ברדיוס 5 — נקודת האמצע אמורה להיות רחוקה מהקו הישר בין הקצוות (עקומה אמיתית,
    // לא קו ישר) — כיוון ה-y תלוי ב-sweep-flag, בודקים רק את המרחק (ערך מוחלט).
    const middle = subpath?.points[Math.floor((subpath.points.length - 1) / 2)];
    expect(Math.abs(middle?.y ?? 0)).toBeGreaterThan(1);
  });

  it('מפריד בין תתי-מסלולים כשיש כמה M', () => {
    const subpaths = flattenPathData('M0,0 L1,1 Z M5,5 L6,6 L7,5 Z');
    expect(subpaths.length).toBe(2);
    expect(subpaths[0]?.closed).toBe(true);
    expect(subpaths[1]?.closed).toBe(true);
  });

  it('מתעלם מתת-מסלול עם פחות משתי נקודות (M בודד ללא המשך)', () => {
    const subpaths = flattenPathData('M0,0 M5,5 L6,6');
    expect(subpaths.length).toBe(1);
    expect(subpaths[0]?.points[0]).toEqual({ x: 5, y: 5 });
  });

  it('תומך ב-H/V (קווים אופקיים/אנכיים)', () => {
    const [subpath] = flattenPathData('M0,0 H10 V10 Z');
    expect(subpath?.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  /**
   * ⚠️ 2026-09-02: הבדיקה הזו קבעה קודם שקו ענק **זורק**. זה השתנה בכוונה: זריקה הפילה את
   * **כל ההעלאה** עם "File processing failed", והיא קרתה על כל צילום מפורט או סרוק (נמדד:
   * תמונה רועשת ייצרה 14,667 פקודות בקו אחד). המשתמש לא יכול היה להבין למה התמונה נדחתה.
   *
   * ⚠️ **ההגנה עצמה לא בוטלה** — זה מה שנבדק כאן עכשיו: הקלט חסום בדיוק כמו קודם, פשוט
   * ע"י הפסקת-איסוף ולא ע"י קריסה. זו הכוונה המקורית של §8 (חסימת DoS על קלט לא-סמוך),
   * רק בלי לקחת איתה את חוויית המשתמש.
   */
  it('קו ענק נחתך לתקרה ולא מפיל את העיבוד (הגנת DoS — §8 קלט לא-סמוך)', () => {
    const hugeLine = Array.from({ length: 6000 }, (_, i) => `L${String(i)},${String(i)}`).join(' ');
    const subpaths = flattenPathData(`M0,0 ${hugeLine}`);
    expect(subpaths).toHaveLength(1);
    expect(subpaths[0]?.points.length).toBeLessThanOrEqual(MAX_POINTS_PER_SUBPATH);
    // ⚠️ ולא ריק: הצורה נשמרת עד התקרה, לא נזרקת.
    expect(subpaths[0]?.points.length).toBeGreaterThan(1000);
  });
});
