/**
 * @file        watermark.ts
 * @description ⭐ 2026-08-29 (לפי בקשה חיה: "להוסיף את הלוגו המלא כווטרמארק לחשבונות
 *              חינמיים"): הלוקאפ המלא — הסמל (משולש + 4 עמודות) **וגם** המילה "soundiform".
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ הגיאומטריה נגזרה מ-apps/web/src/components/branding/Logo.tsx (ה-lockup המלא,
 * viewBox="0 0 380 84") — לא הומצאה כאן. אם הלוגו שם משתנה, לעדכן גם כאן.
 *
 * ⭐⭐ למה מצויר בפרימיטיבים של 2D ולא כתמונת SVG: הגרסה הקודמת רסטרה SVG דרך `sharp`
 * (node בלבד) — מה שלא היה עובד בכלל בדפדפן, שם ההורדה רצה עכשיו. וחשוב מזה: ה-lockup
 * המלא מכיל `<text>`, ורסטור של טקסט בתוך SVG הוא בלתי-אמין בשתי הסביבות (בדפדפן, SVG
 * שנטען כתמונה **לא** טוען פונטים חיצוניים בכלל). ציור ישיר בקנבס — נתיבים ל-סמל
 * ו-fillText ל-wordmark — עובד זהה בשתיהן, בלי טעינת תמונה ובלי תלות חדשה.
 *
 * ⚠️ ההבדל היחיד שנשאר בין הסביבות הוא הפונט בפועל ל-wordmark (משפחה גנרית sans-serif):
 * בדפדפן זה פונט המערכת, ב-@napi-rs/canvas זה מה שמותקן שם. מקובל — הצורה, הצבעים
 * והפרופורציות זהות, וההורדה בפועל רצה בדפדפן.
 */

import type { Canvas2DLike } from './canvas2d';

/** צבעי הלוקאפ הכהה מ-Logo.tsx — הווטרמארק יושב על הווידאו הלבן, ולכן נדרשת גרסה כהה. */
const MARK_STROKE = '#211b4a';
const BAR_LIGHT = '#6c5fc4';
const BAR_LIGHTER = '#4f46a3';
const BAR_BRIGHT = '#211b4a';
const WORDMARK_PRIMARY = '#211b4a';
const WORDMARK_ACCENT = '#6c5fc4';

/** מידות ה-lockup במרחב-העיצוב המקורי (viewBox של Logo.tsx). */
const LOCKUP_WIDTH = 380;
const LOCKUP_HEIGHT = 84;

/** יחס-רוחב הווטרמארק מרוחב הפריים, ושוליים כיחס מגובה הלוקאפ שנוצר. */
const WIDTH_RATIO = 0.22;
const MIN_WIDTH_PX = 120;
const MARGIN_RATIO = 0.6;
const OPACITY = 0.55;

/** מלבן מעוגל בנתיבים בלבד — `roundRect` לא בשימוש בכוונה (תמיכה לא אחידה בין הסביבות). */
function roundedRect(
  ctx: Canvas2DLike,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * מצייר את הלוגו המלא בפינה הימנית-תחתונה.
 * @param scaleUnit  אורך יחידת-העיצוב אחת בפיקסלים של הפריים (ראה drawWatermark למטה).
 */
function drawLockup(ctx: Canvas2DLike, originX: number, originY: number, scaleUnit: number): void {
  const at = (value: number): number => value * scaleUnit;

  // ── הסמל: משולש + 4 עמודות (translate(24,13) scale(0.8) ב-Logo.tsx, מוטמע כאן ישירות) ──
  const markX = originX + at(24);
  const markY = originY + at(13);
  const markUnit = scaleUnit * 0.8;
  const mark = (value: number): number => value * markUnit;

  ctx.strokeStyle = MARK_STROKE;
  ctx.lineWidth = Math.max(1, mark(4));
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(markX + mark(40), markY + mark(8));
  ctx.lineTo(markX + mark(70), markY + mark(60));
  ctx.lineTo(markX + mark(10), markY + mark(60));
  ctx.closePath();
  ctx.stroke();

  const bars: { x: number; y: number; height: number; fill: string }[] = [
    { x: 82, y: 42, height: 18, fill: BAR_LIGHT },
    { x: 97, y: 30, height: 30, fill: BAR_LIGHTER },
    { x: 112, y: 16, height: 44, fill: BAR_BRIGHT },
    { x: 127, y: 30, height: 30, fill: BAR_LIGHTER },
  ];
  for (const bar of bars) {
    ctx.fillStyle = bar.fill;
    roundedRect(
      ctx,
      markX + mark(bar.x),
      markY + mark(bar.y),
      mark(9),
      mark(bar.height),
      mark(2.5),
    );
  }

  // ── ה-wordmark: "sound" בכהה + "iform" בסגול, בדיוק כמו ב-Logo.tsx ──
  const textX = originX + at(148);
  const textY = originY + at(61);
  ctx.font = `500 ${String(at(46))}px sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = WORDMARK_PRIMARY;
  ctx.fillText('sound', textX, textY);
  const soundWidth = ctx.measureText('sound').width;
  ctx.fillStyle = WORDMARK_ACCENT;
  ctx.fillText('iform', textX + soundWidth, textY);
}

/**
 * מצייר את הווטרמארק בפינה הימנית-תחתונה של הפריים. נקרא **רק** כשה-plan מחייב זאת —
 * ההחלטה עצמה נעשית בשרת (PLAN_VIDEO_WATERMARK ב-api/render), לעולם לא כאן ולא בקליינט.
 */
export function drawWatermark(ctx: Canvas2DLike, frameWidth: number, frameHeight: number): void {
  const lockupWidth = Math.max(MIN_WIDTH_PX, frameWidth * WIDTH_RATIO);
  const scaleUnit = lockupWidth / LOCKUP_WIDTH;
  const lockupHeight = LOCKUP_HEIGHT * scaleUnit;
  const margin = lockupHeight * MARGIN_RATIO;

  ctx.save();
  ctx.globalAlpha = OPACITY;
  ctx.shadowBlur = 0;
  drawLockup(
    ctx,
    frameWidth - lockupWidth - margin,
    frameHeight - lockupHeight - margin,
    scaleUnit,
  );
  ctx.restore();
}
