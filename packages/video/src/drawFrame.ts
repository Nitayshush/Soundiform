/**
 * @file        drawFrame.ts
 * @description ⭐ מצייר פריים בודד של וידאו — סרגל התווים (piano-roll), הצורה המקורית
 *              שנחשפת לפי קצב הנגינה, קו סורק, ווטרמארק אופציונלי.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ הועבר לכאן מ-apps/worker/src/video/frameRenderer.ts (2026-08-29) כדי שאותו ציור בדיוק
 * ישרת גם את הרינדור **במכשיר** (apps/web/src/lib/video) וגם את ה-worker. ראה canvas2d.ts.
 *
 * ⚠️ קריטי — "פריוויו ≈ פלט סופי" (§11): הצבעים/מתמטיקת X=זמן/Y=פיץ' והזוהר כאן זהים
 * בכוונה ל-apps/web/src/components/canvas/ScoreStaff.tsx (הפריוויו החי). אם אחד משתנה,
 * לעדכן את השני — כולל **סדר השכבות** (ראה התיקון למטה).
 *
 * ⭐⭐ 2026-08-29 — תיקון באג שדווח ("בסרטון לא רואים את הציור, הוא לא נחשף"): הצורה
 * צוירה **ראשונה** (מתחת), ומיד אחריה drawNotes צייר פסים ב-alpha 0.85 עם זוהר 14px —
 * שביצירה צפופה פשוט כיסו קו של 3px. הצורה לא "לא נחשפה", היא **נקברה**. עכשיו היא
 * מצוירת **אחרונה, מעל הכל** (חוץ מקו הסורק), ועבה/ברורה יותר. ⚠️ אותו שינוי בוצע גם
 * ב-ScoreStaff.tsx, אחרת הפריוויו והפלט מתפצלים.
 *
 * ⚠️ סטייטלס לחלוטין בכוונה: גיל כל "פרץ-אור" נגזר ישירות מ-progress, לא ממעקב בין
 * פריימים — כל קריאה כאן עצמאית (המקודד קורא לה 1200+ פעמים, לא בהכרח ברצף משותף-מצב).
 */

import type { MusicalScore, Note, TrackRole } from '@soundiform/core';
import { TICKS_PER_BEAT } from '@soundiform/core';
import type { ShapeData } from '@soundiform/shared';
import { projectShapeToStaff, revealedSegments } from '@soundiform/shared';
import type { Canvas2DLike, CanvasImageLike, FrameDimensions } from './canvas2d';
import { drawWatermark } from './watermark';

const BACKGROUND_COLOR = '#ffffff';
const SCAN_LINE_COLOR = '#211b4a';
const SCAN_LINE_WIDTH = 2;
const NOTE_BAR_MIN_HEIGHT = 4;
const NOTE_BAR_ALPHA = 0.85;
const GLOW_BLUR_PX = 14;
const BACKGROUND_PULSE_COLOR = '#8b7cf6';
const SHAPE_TRACE_COLOR = '#211b4a';
const SHAPE_TRACE_GLOW_PX = 10;
const SHAPE_TRACE_ALPHA = 0.95;
/** יחס מרוחב הפריים — קו בעובי קבוע נעלם ב-4K ומגושם ב-720p. */
const SHAPE_TRACE_WIDTH_RATIO = 0.0035;
const SHAPE_TRACE_MIN_WIDTH = 3;
const BURST_LIFETIME_SECONDS = 0.45;
const BURST_MAX_RADIUS = 22;

/** = ScoreStaff.tsx ROLE_COLORS — חייב להישאר בסנכרון. */
const ROLE_COLORS: Record<TrackRole, string> = {
  lead: '#8b7cf6',
  bass: '#f59e0b',
  pad: '#34d399',
  drums: '#e11d48',
  skank: '#f472b6',
};

interface ScoreLayout {
  totalTicks: number;
  minPitch: number;
  pitchRange: number;
  barHeight: number;
  secondsPerTick: number;
}

function computeScoreLayout(score: MusicalScore, dimensions: FrameDimensions): ScoreLayout | null {
  const totalTicks = score.durationBars * score.timeSignature[0] * TICKS_PER_BEAT;
  const allPitches = score.tracks.flatMap((track) => track.notes.map((note) => note.pitch));
  if (allPitches.length === 0) {
    return null;
  }
  const minPitch = Math.min(...allPitches);
  const maxPitch = Math.max(...allPitches);
  const pitchRange = Math.max(1, maxPitch - minPitch);
  const barHeight = Math.max(NOTE_BAR_MIN_HEIGHT, dimensions.height / (pitchRange + 4));
  const secondsPerTick = 60 / (score.tempo * TICKS_PER_BEAT);
  return { totalTicks, minPitch, pitchRange, barHeight, secondsPerTick };
}

interface NoteRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function noteRect(note: Note, layout: ScoreLayout, dimensions: FrameDimensions): NoteRect {
  const { width, height } = dimensions;
  const x = (note.startTick / layout.totalTicks) * width;
  const noteWidth = Math.max(2, (note.durationTicks / layout.totalTicks) * width);
  const pitchNormalized = (note.pitch - layout.minPitch) / layout.pitchRange;
  const y = (1 - pitchNormalized) * (height - layout.barHeight);
  return { x, y, width: noteWidth, height: layout.barHeight };
}

function drawNotes(
  ctx: Canvas2DLike,
  score: MusicalScore,
  layout: ScoreLayout,
  dimensions: FrameDimensions,
): void {
  for (const track of score.tracks) {
    const color = ROLE_COLORS[track.role];
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = GLOW_BLUR_PX;
    for (const note of track.notes) {
      const rect = noteRect(note, layout, dimensions);
      ctx.globalAlpha = NOTE_BAR_ALPHA * (0.5 + note.velocity * 0.5);
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/** אנרגיה כוללת (סכום velocity) של התווים שמתנגנים ברגע נתון — = ScoreStaff.tsx energyAtTick. */
function energyAtSeconds(score: MusicalScore, layout: ScoreLayout, timeSeconds: number): number {
  let energy = 0;
  for (const track of score.tracks) {
    for (const note of track.notes) {
      const startSeconds = note.startTick * layout.secondsPerTick;
      const endSeconds = (note.startTick + note.durationTicks) * layout.secondsPerTick;
      if (timeSeconds >= startSeconds && timeSeconds < endSeconds) {
        energy += note.velocity;
      }
    }
  }
  return energy;
}

function drawBackgroundPulse(
  ctx: Canvas2DLike,
  score: MusicalScore,
  layout: ScoreLayout,
  dimensions: FrameDimensions,
  progress: number,
  frameTimeSeconds: number,
): void {
  const energy = energyAtSeconds(score, layout, frameTimeSeconds);
  const normalizedEnergy = Math.min(1, energy / 3);
  if (normalizedEnergy <= 0.02) {
    return;
  }
  ctx.globalAlpha = normalizedEnergy * 0.14;
  ctx.fillStyle = BACKGROUND_PULSE_COLOR;
  ctx.shadowColor = BACKGROUND_PULSE_COLOR;
  ctx.shadowBlur = GLOW_BLUR_PX * 2;
  ctx.beginPath();
  ctx.arc(
    progress * dimensions.width,
    dimensions.height / 2,
    dimensions.height * (0.12 + normalizedEnergy * 0.18),
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawBursts(
  ctx: Canvas2DLike,
  score: MusicalScore,
  layout: ScoreLayout,
  dimensions: FrameDimensions,
  frameTimeSeconds: number,
): void {
  for (const track of score.tracks) {
    const color = ROLE_COLORS[track.role];
    for (const note of track.notes) {
      const startSeconds = note.startTick * layout.secondsPerTick;
      const age = (frameTimeSeconds - startSeconds) / BURST_LIFETIME_SECONDS;
      if (age < 0 || age >= 1) {
        continue;
      }
      const rect = noteRect(note, layout, dimensions);
      ctx.globalAlpha = Math.max(0, 1 - age) * 0.7;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(rect.x, rect.y + rect.height / 2, BURST_MAX_RADIUS * age, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * מצייר את הצורה המקורית — רק החלק שכבר "נחשף" לפי progress (מיקום-X מול קו הסורק,
 * לא סדר-הציור). ראה @soundiform/shared's shapeReveal.ts.
 */
function drawShapeTrace(
  ctx: Canvas2DLike,
  shapeData: ShapeData,
  dimensions: FrameDimensions,
  progress: number,
): void {
  const polylines = revealedSegments(projectShapeToStaff(shapeData, dimensions), progress);
  if (polylines.length === 0) {
    return;
  }
  ctx.strokeStyle = SHAPE_TRACE_COLOR;
  ctx.shadowColor = SHAPE_TRACE_COLOR;
  ctx.shadowBlur = SHAPE_TRACE_GLOW_PX;
  ctx.lineWidth = Math.max(SHAPE_TRACE_MIN_WIDTH, dimensions.width * SHAPE_TRACE_WIDTH_RATIO);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = SHAPE_TRACE_ALPHA;
  for (const points of polylines) {
    const [first, ...rest] = points;
    if (!first) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const point of rest) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

export interface DrawFrameInput {
  score: MusicalScore;
  shapeData: ShapeData;
  /** [0,1] — גם מיקום קו הסורק וגם כמה מהצורה כבר נחשף. */
  progress: number;
  dimensions: FrameDimensions;
  watermark: boolean;
  /**
   * ⭐ 2026-09-02: התמונה המקורית שהמשתמש העלה. undefined/null = ציור-יד או SVG, ואז
   * הפריים נראה בדיוק כמו קודם — אין שינוי התנהגות ליצירות קיימות.
   *
   * ⚠️ כשהיא קיימת, **מתאר-הצורה לא מצויר**: הצורה כבר נראית לעין בתמונה עצמה, וקו שחור
   * מעליה היה מכסה אותה — ההפך ממה שהתבקש ("שיראו את התמונה ולא את השלד"). הבזקי-האור
   * וקו-הסורק כן נשארים, והם מה שמראה איפה הסאונד נוגע בשלד שמתחת.
   */
  backgroundImage?: CanvasImageLike | null;
}

/**
 * מצייר פריים שלם על ה-context שסופק. סדר השכבות (מלמטה למעלה):
 * רקע → פעימת-רקע → תווים → פרצי-אור → **הצורה הנחשפת** → קו סורק → ווטרמארק.
 */
/**
 * מצייר את התמונה בתוך הפריים בלי לחתוך אותה (contain), ממורכזת.
 *
 * ⚠️ contain ולא cover: הצורה שהמנוע קרא מנורמלת ל-[0,1] בשני הצירים, וחיתוך היה מזיז את
 * ההתאמה בין מה שנראה לבין מה שנשמע. אותה החלטה בדיוק כמו ב-UploadedImageLayer בסטודיו.
 */
function drawContainedImage(
  ctx: Canvas2DLike,
  image: CanvasImageLike,
  dimensions: FrameDimensions,
): void {
  const { width, height } = dimensions;
  if (image.width <= 0 || image.height <= 0) {
    return;
  }
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function drawVideoFrame(ctx: Canvas2DLike, input: DrawFrameInput): void {
  const { score, shapeData, progress, dimensions, watermark, backgroundImage } = input;
  const { width, height } = dimensions;

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  // ⚠️ מיד אחרי הרקע ולפני התווים — בדיוק אותו סדר שכבות כמו בסטודיו
  // (UploadedImageLayer יושב מעל הרשת ומתחת ל-ScoreStaff), כדי ש"פריוויו = פלט".
  if (backgroundImage) {
    drawContainedImage(ctx, backgroundImage, dimensions);
  }

  const layout = computeScoreLayout(score, dimensions);
  if (layout) {
    const frameTimeSeconds = progress * layout.totalTicks * layout.secondsPerTick;
    drawBackgroundPulse(ctx, score, layout, dimensions, progress, frameTimeSeconds);
    drawNotes(ctx, score, layout, dimensions);
    drawBursts(ctx, score, layout, dimensions, frameTimeSeconds);
  }

  // ⭐ מעל התווים — ראה הערת-התיקון בראש הקובץ.
  // ⚠️ מדולג כשיש תמונה מקורית: היא כבר מראה את הצורה, ומתאר מעליה היה מסתיר אותה.
  if (!backgroundImage) {
    drawShapeTrace(ctx, shapeData, dimensions, progress);
  }

  const scanX = progress * width;
  ctx.strokeStyle = SCAN_LINE_COLOR;
  ctx.lineWidth = SCAN_LINE_WIDTH;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(scanX, 0);
  ctx.lineTo(scanX, height);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (watermark) {
    drawWatermark(ctx, width, height);
  }
}
