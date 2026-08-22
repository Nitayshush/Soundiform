/**
 * @file        frameRenderer.ts
 * @description ⭐ מצייר פריים בודד של וידאו — סרגל התווים (piano-roll) + קו סורק, לא הצורה
 *              המקורית עם נקודה נעה (זה היה השלב הישן, לפני עדכון הסטודיו ל-ScoreStaff.tsx).
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — "פריוויו ≈ פלט סופי" גם לוידאו (§11 עדכון 2026-08-22): הצבעים/מתמטיקת
 * X=זמן/Y=פובך + הזוהר/פרצי-האור כאן זהים בכוונה ל-apps/web/src/components/canvas/
 * ScoreStaff.tsx (הפריוויו החי בדפדפן) — פורט מכני מ-Pixi.js Graphics+BlurFilter ל-
 * @napi-rs/canvas 2D context: shadowBlur/shadowColor הוא מקביל ה-canvas-2D הסטנדרטי
 * ל-glow (במקום blur+blend-'add' שני-שכבות של Pixi — אותה תחושה חזותית, מנגנון שונה
 * כי אין filter graph ב-canvas 2D). אם ScoreStaff.tsx משתנה, יש לעדכן גם כאן.
 *
 * ⚠️ בניגוד ל-ScoreStaff.tsx (שרץ על app.ticker, עם state בין frames) — כאן כל פריים
 * מחושב *ללא מצב חיצוני*, סטטלס לגמרי: גיל כל "פרץ-אור" נגזר ישירות מ-frameTimeSeconds
 * (הנגזר מ-progress+durationSeconds של ה-score) מול startTick של כל תו, לא ממעקב
 * frame-to-frame — כי כל קריאה ל-renderVideoFrame עצמאית (videoEncoder.ts קורא לזה
 * unrelated-פעמים, לא ברצף שיתוף-state).
 */

import { createCanvas, loadImage, type Image } from '@napi-rs/canvas';
import sharp from 'sharp';
import type { MusicalScore, TrackRole } from '@soundiform/core';
import { TICKS_PER_BEAT } from '@soundiform/core';

const BACKGROUND_COLOR = '#ffffff';
const SCAN_LINE_COLOR = '#211b4a'; // = ScoreStaff.tsx SCAN_LINE_COLOR (0x211b4a)
const SCAN_LINE_WIDTH = 2;
const NOTE_BAR_MIN_HEIGHT = 4;
const NOTE_BAR_ALPHA = 0.85;
const GLOW_BLUR_PX = 14; // = ScoreStaff.tsx GLOW_BLUR_STRENGTH (מקביל אינטואיטיבי, לא זהה 1:1 — יחידות שונות)
const BACKGROUND_PULSE_COLOR = '#8b7cf6'; // = ScoreStaff.tsx BACKGROUND_PULSE_COLOR (0x8b7cf6)
const BURST_LIFETIME_SECONDS = 0.45; // = ScoreStaff.tsx BURST_LIFETIME_SECONDS
const BURST_MAX_RADIUS = 22; // = ScoreStaff.tsx BURST_MAX_RADIUS

// = ScoreStaff.tsx ROLE_COLORS — חייב להישאר בסנכרון.
const ROLE_COLORS: Record<TrackRole, string> = {
  lead: '#8b7cf6',
  bass: '#f59e0b',
  pad: '#34d399',
  drums: '#e11d48',
  skank: '#f472b6',
};

/**
 * ⚠️ חייב להישאר בסנכרון עם apps/web/src/components/branding/Logo.tsx's LogoMark — אותה
 * גיאומטריה בדיוק (viewBox, path/rect), אבל בצבעים כהים (לא הבהירים-על-כהה של הלוגו
 * המקורי) כי הוידאו על רקע לבן, אותו עיקרון בדיוק כמו הפיכת DrawingCanvas/ScoreStaff
 * לכהה-על-לבן. שקיפות מוחלת דרך ctx.globalAlpha בזמן הציור, לא בתוך ה-SVG עצמו.
 */
const WATERMARK_LOGO_SVG = `
<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(20,46)">
    <path d="M45 10 L80 68 L10 68 Z" fill="none" stroke="#211b4a" stroke-width="5" stroke-linejoin="round" />
    <rect x="94" y="48" width="10" height="20" rx="3" fill="#6c5fc4" />
    <rect x="111" y="34" width="10" height="34" rx="3" fill="#4f46a3" />
    <rect x="128" y="18" width="10" height="50" rx="3" fill="#211b4a" />
    <rect x="145" y="34" width="10" height="34" rx="3" fill="#4f46a3" />
  </g>
</svg>
`.trim();

let cachedWatermarkImage: Image | null = null;

async function getWatermarkImage(): Promise<Image> {
  if (cachedWatermarkImage) {
    return cachedWatermarkImage;
  }
  const png = await sharp(Buffer.from(WATERMARK_LOGO_SVG)).resize(160, 160).png().toBuffer();
  cachedWatermarkImage = await loadImage(png);
  return cachedWatermarkImage;
}

export interface FrameDimensions {
  width: number;
  height: number;
}

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

function noteRect(
  note: MusicalScore['tracks'][number]['notes'][number],
  layout: ScoreLayout,
  dimensions: FrameDimensions,
): NoteRect {
  const { width, height } = dimensions;
  const x = (note.startTick / layout.totalTicks) * width;
  const noteWidth = Math.max(2, (note.durationTicks / layout.totalTicks) * width);
  const pitchNormalized = (note.pitch - layout.minPitch) / layout.pitchRange;
  const y = (1 - pitchNormalized) * (height - layout.barHeight);
  return { x, y, width: noteWidth, height: layout.barHeight };
}

type Canvas2DContext = ReturnType<ReturnType<typeof createCanvas>['getContext']>;

function drawNotes(
  ctx: Canvas2DContext,
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

/** אנרגיה כוללת (סכום velocity) של כל התווים שמתנגנים ברגע נתון — = ScoreStaff.tsx energyAtTick. */
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
  ctx: Canvas2DContext,
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
  const centerX = progress * dimensions.width;
  const radius = dimensions.height * (0.12 + normalizedEnergy * 0.18);
  ctx.globalAlpha = normalizedEnergy * 0.14;
  ctx.fillStyle = BACKGROUND_PULSE_COLOR;
  ctx.shadowColor = BACKGROUND_PULSE_COLOR;
  ctx.shadowBlur = GLOW_BLUR_PX * 2;
  ctx.beginPath();
  ctx.arc(centerX, dimensions.height / 2, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/** פרצי-אור לתווים שהתחילו ב-±BURST_LIFETIME_SECONDS מהפריים הנוכחי — = ScoreStaff.tsx bursts. */
function drawBursts(
  ctx: Canvas2DContext,
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
      const radius = BURST_MAX_RADIUS * age;
      ctx.globalAlpha = Math.max(0, 1 - age) * 0.7;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(rect.x, rect.y + rect.height / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

async function drawWatermark(ctx: Canvas2DContext, width: number, height: number): Promise<void> {
  const logo = await getWatermarkImage();
  const size = Math.max(24, Math.round(width * 0.08));
  const margin = size * 0.4;
  ctx.globalAlpha = 0.55;
  ctx.drawImage(logo, width - size - margin, height - size - margin, size, size);
  ctx.globalAlpha = 1;
}

/**
 * מצייר פריים בודד של סרגל התווים. progress קובע רק את מיקום קו הסורק — התווים עצמם
 * מוצגים כולם, בדיוק כמו ScoreStaff.tsx (כל הצורה מנוגנת יחד משמאל לימין).
 */
export async function renderVideoFrame(
  score: MusicalScore,
  progress: number,
  dimensions: FrameDimensions,
  watermark: boolean,
): Promise<Buffer> {
  const { width, height } = dimensions;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  const layout = computeScoreLayout(score, dimensions);
  if (layout) {
    const frameTimeSeconds = progress * layout.totalTicks * layout.secondsPerTick;
    drawBackgroundPulse(ctx, score, layout, dimensions, progress, frameTimeSeconds);
    drawNotes(ctx, score, layout, dimensions);
    drawBursts(ctx, score, layout, dimensions, frameTimeSeconds);
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
    await drawWatermark(ctx, width, height);
  }

  return canvas.toBuffer('image/png');
}
