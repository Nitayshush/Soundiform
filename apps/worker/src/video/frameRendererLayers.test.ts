/**
 * @file        frameRendererLayers.test.ts
 * @description ⭐ 2026-08-29 — רגרסיה על באג שדווח מבדיקה חיה: "בסרטון לא רואים את הציור,
 *              הוא לא נחשף". הסיבה לא הייתה שהחשיפה לא עבדה, אלא שהצורה צוירה **מתחת**
 *              לסרגל התווים ופסי-התווים (alpha 0.85 + זוהר 14px) קברו קו של 3px.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * הבדיקה מרנדרת פריים אמיתי ומסתכלת על **פיקסלים** — לא על סדר-קריאות — כי זה מה שהמשתמש
 * בפועל רואה. אין דרך אחרת באמת לאמת "נראה/לא נראה".
 */

import { describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import type { MusicalScore } from '@soundiform/core';
import type { ShapeData } from '@soundiform/shared';
import { drawVideoFrame, type Canvas2DLike } from '@soundiform/video';

const DIMENSIONS = { width: 320, height: 180 };

/** ציור שחוצה את כל הרוחב בגובה קבוע — קל לאתר בפיקסלים. */
function makeShape(): ShapeData {
  return {
    version: '1.0.0',
    paths: [
      {
        points: Array.from({ length: 40 }, (_, index) => ({ x: index / 39, y: 0.5 })),
        closed: false,
      },
    ],
  };
}

/** יצירה צפופה: הרבה תווים על פני כל הקנבס — בדיוק המצב שבו הצורה נעלמה. */
function makeDenseScore(): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'frame-layers-regression',
    tempo: 120,
    timeSignature: [4, 4],
    key: { root: 0, mode: 'aeolian' },
    genreId: 'test',
    durationBars: 1,
    tracks: [
      {
        role: 'pad',
        instrumentId: 'test-pad',
        notes: Array.from({ length: 60 }, (_, index) => ({
          startTick: index * 30,
          durationTicks: 240,
          pitch: 48 + (index % 24),
          velocity: 1,
        })),
        mixSettings: { volume: 1, pan: 0, reverbSend: 0, delaySend: 0 },
      },
    ],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 1 }],
    metadata: { avgNoteDensity: 8, dominantMode: 'aeolian', rootFrequencyHz: 220 },
  };
}

function renderPixels(watermark: boolean, progress: number): Uint8ClampedArray {
  const canvas = createCanvas(DIMENSIONS.width, DIMENSIONS.height);
  const ctx = canvas.getContext('2d');
  drawVideoFrame(ctx as unknown as Canvas2DLike, {
    score: makeDenseScore(),
    shapeData: makeShape(),
    progress,
    dimensions: DIMENSIONS,
    watermark,
  });
  return ctx.getImageData(0, 0, DIMENSIONS.width, DIMENSIONS.height).data;
}

/** סופר פיקסלים בצבע קו-הצורה (#211b4a) בתוך אזור נתון, בסובלנות לאנטי-אליאסינג/זוהר. */
function countTraceColoredPixels(pixels: Uint8ClampedArray, fromX: number, toX: number): number {
  let count = 0;
  for (let y = 0; y < DIMENSIONS.height; y += 1) {
    for (let x = fromX; x < toX; x += 1) {
      const offset = (y * DIMENSIONS.width + x) * 4;
      const red = pixels[offset] ?? 0;
      const green = pixels[offset + 1] ?? 0;
      const blue = pixels[offset + 2] ?? 0;
      // #211b4a = (33,27,74): כהה, וכחול מובהק מעל אדום/ירוק.
      if (red < 90 && green < 90 && blue > red && blue > green && blue < 150) {
        count += 1;
      }
    }
  }
  return count;
}

describe('drawVideoFrame — הצורה הנחשפת נראית מעל סרגל התווים', () => {
  it('ביצירה צפופה, קו-הצורה נשאר גלוי בפיקסלים (לא נקבר מתחת לתווים)', () => {
    const pixels = renderPixels(false, 1);
    // כל הרוחב נחשף ב-progress=1, אז חייבים להיות המון פיקסלים של קו-הצורה.
    expect(countTraceColoredPixels(pixels, 0, DIMENSIONS.width)).toBeGreaterThan(200);
  });

  it('החשיפה מתקדמת עם progress: בחצי היצירה יש קו משמאל ואין מימין', () => {
    const pixels = renderPixels(false, 0.5);
    const halfway = Math.floor(DIMENSIONS.width / 2);
    const left = countTraceColoredPixels(pixels, 0, halfway - 10);
    // ⚠️ מדלגים על רצועה סביב קו-הסורק עצמו (אותו צבע בדיוק) כדי לא לספור אותו בטעות.
    const right = countTraceColoredPixels(pixels, halfway + 10, DIMENSIONS.width);
    expect(left).toBeGreaterThan(50);
    expect(right).toBe(0);
  });

  /** כמה פיקסלים נבדלים בין שני רינדורים, ברבע הימני-תחתון (איפה שהווטרמארק יושב). */
  function bottomRightDifferences(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
    let differing = 0;
    for (let y = Math.floor(DIMENSIONS.height / 2); y < DIMENSIONS.height; y += 1) {
      for (let x = Math.floor(DIMENSIONS.width / 2); x < DIMENSIONS.width; x += 1) {
        const offset = (y * DIMENSIONS.width + x) * 4;
        if (a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1]) {
          differing += 1;
        }
      }
    }
    return differing;
  }

  it('ווטרמארק מצויר כשמבקשים אותו, ולא מצויר כשלא', () => {
    const withMark = renderPixels(true, 1);
    const withoutMark = renderPixels(false, 1);
    // הלוגו המלא (סמל + wordmark) חייב לשנות שטח משמעותי בפינה.
    expect(bottomRightDifferences(withMark, withoutMark)).toBeGreaterThan(300);
    // ושני רינדורים ללא ווטרמארק חייבים להיות זהים לחלוטין (דטרמיניזם, ושאין ציור טפיל).
    expect(bottomRightDifferences(withoutMark, renderPixels(false, 1))).toBe(0);
  });
});
