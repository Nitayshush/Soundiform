/**
 * @file        canvas2d.ts
 * @description ⭐ 2026-08-29: ממשק מבני צר ל-2D context — בדיוק המתודות/התכונות שציור
 *              הפריים משתמש בהן, ולא יותר.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ למה זה קיים: עד עכשיו ציור-פריים-הווידאו היה כתוב פעם אחת ב-apps/worker (מול
 * @napi-rs/canvas) — וההערה בראש הקובץ ההוא אף הודתה בכפילות ("אם ScoreStaff.tsx משתנה,
 * יש לעדכן גם כאן"). מאז שההורדה עברה לרוץ **במכשיר** (ראה apps/web/src/lib/video), אותו
 * ציור בדיוק נדרש גם מול ה-canvas של הדפדפן. שני ה-context-ים כמעט זהים ב-API אבל הטיפוסים
 * שלהם שונים לגמרי, ולכן ההפשטה כאן היא **מבנית** (structural): כל אובייקט שמקיים את
 * המתודות האלה מתאים, בלי לייבא אף אחד מהטיפוסים הספציפיים לסביבה.
 *
 * ⚠️ הוספת מתודה כאן = דרישה חדשה משתי הסביבות. לפני שמוסיפים, לוודא ש-@napi-rs/canvas
 * *וגם* ה-canvas של הדפדפן תומכים בה (למשל roundRect לא בשימוש בכוונה — ראה drawFrame.ts).
 */

export interface Canvas2DLike {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  globalAlpha: number;
  shadowBlur: number;
  shadowColor: string;
  font: string;
  textBaseline: string;

  fillRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  save(): void;
  restore(): void;
}

export interface FrameDimensions {
  width: number;
  height: number;
}
