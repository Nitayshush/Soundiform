/**
 * @file        rasterToShapeData.ts
 * @description ⭐ raster (PNG/JPEG/WebP) → ShapeData: sharp re-encode (§8 שלב 4, מסיר
 *              EXIF/payloads) → potrace (מעקב-קונטור, כמו Inkscape) → אותו path-parsing
 *              כמו SVG. ראה PROJECT.md §11 (הערה ליד Sprint 2 — נדרש אלגוריתם נפרד מ-SVG).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ ה-SVG שיוצא מ-potrace הוא תוצר-שלנו (מבּיטמאפ שכבר עבר sharp re-encode), לא markup
 * שהמשתמש שלט בו ישירות — אין צורך להעביר אותו דרך sanitizeSvg.ts (DOMPurify). עדיין מפורש
 * דרך svgMarkupToShapeData (jsdom parse-only, אין הרצת script) כדי לחלץ את הנקודות.
 */

import sharp from 'sharp';
import { posterize, trace, type PotraceOptions } from 'potrace';
import type { ShapeData } from '@soundiform/shared';
import { svgMarkupToShapeData } from './svgToShapeData';

/**
 * ⭐ 2026-09-02: **גודל עבודה קבוע** לסריקה, לא תקרה.
 *
 * ⚠️ קודם זה היה "הקטן ל-2000 אם צריך, לעולם אל תגדיל" — כלומר תמונה של 300px נסרקה ב-300
 * ותמונה של 1200px ב-1200. נמדד: **אותה תמונה בגדלים שונים ייצרה שלד שונה ולכן מוזיקה
 * שונה** (300/600/1200/3000 נתנו ארבע תוצאות שונות). עכשיו כל תמונה מובאת לאותו קנה מידה
 * לפני הסריקה, כך שהגודל שבו היא הגיעה מפסיק להשפיע.
 *
 * ⚠️ תמונה **קטנה** מהגודל הזה נסרקת כמות שהיא ולא מוגדלת (ראה ההערה ליד resize) — ולכן
 * שתי גרסאות של אותה תמונה מתחת ל-1024 עדיין יכולות להישמע שונה. זה המחיר של אחידות-
 * הפורמטים, והוא נמדד: הגדלה שברה את JPEG/WebP. כל מה ש**מעל** הגודל הזה מתכנס.
 */
const TRACE_DIMENSION = 1024;
/** תקרת גודל לגרסה שנשמרת ב-R2 (תצוגה/מודרציה) — נדיבה יותר, לא צריכה להיות מדויקת לניתוח. */
const MAX_STORED_DIMENSION = 4096;

/**
 * ⚠️ 2026-09-02: `turdSize` הועלה מ-4 ל-12 — הוא מוחק קונטורים קטנים מהערך הזה. נמדד
 * שכתם של 9 פיקסלים הפך לקו מלא ונכנס למוזיקה. 12 מסלק אבק, רעש-סריקה ופיקסלים בודדים
 * בלי לגעת בצורות אמיתיות (בדיקה על ציור עם 6 צורות: 31 → 34 פקודות, כלומר ללא שינוי מהותי).
 */
const POTRACE_OPTIONS: PotraceOptions = {
  threshold: 128,
  turdSize: 12,
  optCurve: true,
  blackOnWhite: true,
};

/*
 * ⚠️ 2026-09-02: **נוסה טשטוש לפני הסף — והוסר אחרי מדידה.** הרעיון היה לנטרל את רעש
 * ה-dithering של GIF ואת רעש הסריקה. בפועל הוא **פגע באחידות**: טשטוש מרכך קצה חד
 * לגרדיאנט, ואז שגיאת הדחיסה של JPEG/WebP — שקודם הייתה רחוקה מהסף — נופלת עליו.
 *
 * נמדד דרך ה-API על אותה תמונה:
 *   בלי טשטוש:  png = jpg = webp = tiff = avif  (אותו shapeHash בדיוק)
 *   עם טשטוש:   png = tiff = avif, אבל jpg ו-webp נפרדו לתוצאות שונות
 *
 * ובנוסף מספר הנקודות קפץ מ-18 ל-106 על ציור נקי, כי הקצה המרוכך נסרק בפירוט מיותר.
 * הבעיה שהטשטוש נועד לפתור (קריסה על תמונה רועשת) נפתרה נכון יותר בתקרת-הנקודות
 * שכבר לא זורקת — ראה svgPathFlatten.ts.
 */

function traceToSvg(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    trace(buffer, POTRACE_OPTIONS, (error, svg) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(svg);
    });
  });
}

/**
 * ⭐ 2026-09-02: מחלץ קווים ב**כמה רמות בהירות** במקום באחת.
 *
 * ⚠️ **הבעיה שזה פותר.** סף יחיד רואה רק "כהה מאוד" מול "בהיר מאוד" — כל הגוונים שביניהם
 * נעלמים. בצילום של אדם זה אומר שנשארת רק הצללית, ולכן **כל הפורטרטים נשמעים דומה**:
 * אותו קו ראש-וכתפיים, אותו טווח תווים.
 *
 * נמדד על שתי תמונות עם צללית זהה, שאחת מהן עם פסים בחולצה ואובייקטים ברקע:
 *   סף יחיד:      1 קו,  27 נקודות,  8 רצועות-גובה
 *   posterize 4:  4 קווים, 126 נקודות, 16 רצועות-גובה
 * פי 4.7 נקודות ופי 2 טווח-תווים — כלומר מוזיקה שבאמת נגזרת מהתמונה הזו ולא מהצללית שלה.
 *
 * ⚠️ ותמונה שאין בה גוונים **לא מושפעת בכלל**: אותה מדידה על צללית טהורה נתנה 18 נקודות
 * בכל ספירת-רמות. לוגו וציור נקי ממשיכים לצאת בדיוק כמו קודם.
 *
 * ⚠️ 4 ולא יותר: מ-5 ואילך אין תוספת (16 רצועות בשניהם), ו-potrace עצמו מזהיר על זמן חישוב.
 */
const POSTERIZE_STEPS = 4;

function posterizeToSvg(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    posterize(
      buffer,
      { ...POTRACE_OPTIONS, steps: POSTERIZE_STEPS },
      (error: Error | null, svg: string) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(svg);
      },
    );
  });
}

/**
 * ⚠️ תקציב-נקודות לשלד. תמונה רועשת מכפילה את הרעש בכל רמת-בהירות — נמדד שתמונה רועשת
 * הגיעה ל-39,852 פקודות ב-4 רמות. מעבר לתקציב חוזרים לסף יחיד: עדיף שלד פשוט ונכון
 * מאשר רעש שנשמע כמו רעש. ⚠️ זו נפילה-לאחור, לא שגיאה — המשתמש מקבל יצירה בכל מקרה.
 */
const MAX_SKELETON_POINTS = 6000;

function countPoints(shape: ShapeData): number {
  return shape.paths.reduce((sum, path) => sum + path.points.length, 0);
}

export interface RasterConversionResult {
  shapeData: ShapeData;
  /** PNG נקי (rotate()+strip metadata) — נשמר ב-R2 תחת uploads/, לתצוגה/מודרציה. */
  sanitizedPngBuffer: Buffer;
}

/**
 * הופך תמונת raster גולמית (עדיין לא-סמוכה!) ל-ShapeData + גרסה נקייה לאחסון.
 * זורק אם sharp לא מצליח לפענח את הקובץ (לא תמונה תקינה חרף magic bytes תקינים) או אם
 * potrace לא מוצא אף קונטור (למשל תמונה חלקה/ריקה לגמרי).
 */
export async function rasterToShapeData(originalBuffer: Buffer): Promise<RasterConversionResult> {
  const traceInput = await sharp(originalBuffer)
    .rotate()
    // ⚠️ **רק הקטנה, לעולם לא הגדלה** — וזה נמדד, לא הנחה. ניסיתי להגדיל תמונות קטנות
    // לאותו קנה מידה כדי לסגור את פער-הרזולוציה; ההגדלה מפעילה אינטרפולציה, וזו מפזרת את
    // שגיאת הדחיסה של JPEG/WebP אל מעבר לסף — כך ששני הפורמטים האלה נפרדו משאר הפורמטים
    // ונתנו מוזיקה אחרת לאותה תמונה. הקטנה בלבד שומרת על שניהם זהים ל-PNG.
    .resize({
      width: TRACE_DIMENSION,
      height: TRACE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .grayscale()
    .png()
    .toBuffer();

  // ⭐ 2026-09-02: קודם מנסים חילוץ רב-רמות, ורק אם התוצאה חורגת מהתקציב נופלים לסף יחיד.
  let shapeData = svgMarkupToShapeData(await posterizeToSvg(traceInput));
  if (countPoints(shapeData) > MAX_SKELETON_POINTS) {
    shapeData = svgMarkupToShapeData(await traceToSvg(traceInput));
  }

  const sanitizedPngBuffer = await sharp(originalBuffer)
    .rotate()
    .resize({
      width: MAX_STORED_DIMENSION,
      height: MAX_STORED_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  return { shapeData, sanitizedPngBuffer };
}
