/**
 * @file        kidsSceneSnapshot.ts
 * @description ⭐ 2026-09-13 (Kids Studio, לפי בקשה חיה): מרכיב את הסצנה הצבעונית שהילד
 *              רואה על הלוח (קווים בצבעים שונים + אימוג'ים) לתמונה אחת (PNG, כ-Blob מקומי
 *              — ראה useDownload.ts להסבר למה לא דרך R2/store), כדי שהיא תוצג בפוסטר/
 *              בווידאו/בגלריה **במקום** השלד השחור-לבן שממנו נגזר הצליל.
 * @author      Soundiform
 * @created     2026-09-13
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מכפיל בכוונה (לא מייבא) את לוגיקת-הציור של DrawingCanvas.tsx: כאן זו פונקציה טהורה
 * חד-פעמית על קנבס offscreen, שם זה state מחובר ל-ref שמתעדכן על כל שינוי — שילוב שלהם
 * תחת חתימה משותפת היה מסבך את שניהם בלי תועלת אמיתית. הצבעים/עוביים המשמשים כברירת
 * מחדל (STROKE_COLOR/LINE_WIDTH) **חייבים** להישאר זהים לשם, אחרת התצלום לא יתאם למסך.
 *
 * ⚠️ font-size של אימוג'י: EmojiStickerLayer שומר `size` בפיקסלים **ביחס לרוחב-הקונטיינר
 * בזמן ההצבה** (ראה שם). מנרמלים כאן לפי `containerWidthPx` (רוחב הבמה החי *ברגע הצילום*,
 * לא ברגע ההצבה) — קירוב סביר: הבמה כמעט תמיד נשארת באותו גודל בין הצבה לשמירה באותה הפעלה.
 */

import type { ShapePath } from '@soundiform/shared';
import type { PathStyle } from '@/stores/shapeStore';
import type { EmojiSticker } from '@/components/kids/EmojiStickerLayer';

/** אותו ערך בדיוק כמו DrawingCanvas.tsx — ראה ⚠️ למעלה. */
const STROKE_COLOR = '#211b4a';
const LINE_WIDTH = 6;
/** ריבועי בכוונה — לא תלוי ביחס-הבמה בפועל; drawContainedImage (drawFrame.ts) מבצע contain בכל מקרה. */
const SNAPSHOT_SIZE = 1024;

export interface KidsSceneSnapshotInput {
  paths: ShapePath[];
  pathStyles: PathStyle[];
  stickers: EmojiSticker[];
  /** רוחב הבמה החי בפיקסלים, לנרמול font-size של אימוג'ים — ראה ⚠️ למעלה. 0/undefined מדלג על ציור אימוג'ים. */
  containerWidthPx: number;
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  path: ShapePath,
  color: string,
  strokeWidth: number,
): void {
  if (path.points.length < 2 || color === 'transparent') {
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  const [first, ...rest] = path.points;
  ctx.moveTo(first.x * SNAPSHOT_SIZE, first.y * SNAPSHOT_SIZE);
  for (const point of rest) {
    ctx.lineTo(point.x * SNAPSHOT_SIZE, point.y * SNAPSHOT_SIZE);
  }
  if (path.closed) {
    ctx.closePath();
    ctx.fillStyle = `${color}33`;
    ctx.fill();
  }
  ctx.stroke();
}

function drawSticker(
  ctx: CanvasRenderingContext2D,
  sticker: EmojiSticker,
  containerWidthPx: number,
): void {
  if (containerWidthPx <= 0) {
    return;
  }
  const normalizedFontSize = sticker.size / containerWidthPx;
  ctx.font = `${String(normalizedFontSize * SNAPSHOT_SIZE)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sticker.emoji, sticker.x * SNAPSHOT_SIZE, sticker.y * SNAPSHOT_SIZE);
}

/** מרכיב את הסצנה לתמונה אחת. null אם הדפדפן לא מצליח ליצור 2d context (לא אמור לקרות בפועל). */
export async function captureKidsSceneSnapshot(
  input: KidsSceneSnapshotInput,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = SNAPSHOT_SIZE;
  canvas.height = SNAPSHOT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SNAPSHOT_SIZE, SNAPSHOT_SIZE);

  input.paths.forEach((path, index) => {
    const style = input.pathStyles[index];
    drawPath(ctx, path, style?.color ?? STROKE_COLOR, style?.strokeWidth ?? LINE_WIDTH);
  });

  for (const sticker of input.stickers) {
    drawSticker(ctx, sticker, input.containerWidthPx);
  }

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}
