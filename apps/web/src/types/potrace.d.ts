/**
 * @file        potrace.d.ts
 * @description הצהרת טיפוסים מינימלית ל-potrace — החבילה לא משדרת .d.ts משלה ו-@types/potrace
 *              (2.1.5) פיגר אחרי הגרסה המותקנת (2.1.8). מכסה רק את משטח ה-API שבו אנחנו
 *              משתמשים בפועל (rasterToShapeData.ts) — לא תרגום מלא של הספרייה.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

declare module 'potrace' {
  export interface PotraceOptions {
    turdSize?: number;
    turnPolicy?: string;
    alphaMax?: number;
    optCurve?: boolean;
    optTolerance?: number;
    threshold?: number;
    blackOnWhite?: boolean;
    color?: string;
    background?: string;
    width?: number;
    height?: number;
  }

  /**
   * ⭐ 2026-09-02: אפשרויות ה-Posterizer. `steps` הוא מספר רמות-הבהירות שמהן מחלצים קווים —
   * ראה rasterToShapeData.ts למדידה שהובילה לבחירת הערך.
   */
  export interface PosterizeOptions extends PotraceOptions {
    steps?: number;
    fillStrategy?: string;
    rangeDistribution?: string;
  }

  export type TraceCallback = (error: Error | null, svg: string) => void;

  export function trace(file: Buffer, options: PotraceOptions, callback: TraceCallback): void;
  export function posterize(file: Buffer, options: PosterizeOptions, callback: TraceCallback): void;
}
