/**
 * @file        DrumKitProvider.test.ts
 * @description ⭐ 2026-09-27 (פידבק בדיקה חיה: "כל מכה מנגנת תמיד את אותה דגימה, רק בעוצמה
 *              שונה"): בודק את הלוגיקה הטהורה של בחירת-שכבת-עוצמה (parsePieceKey,
 *              selectVelocityBandIndex, computeLayeredGain) בלי לגעת ב-Tone/AudioContext —
 *              ראה ⚠️ ביציבות node-web-audio-api תחת רינדור-בו-זמנית (vitest.config.ts):
 *              בדיקה טהורה כאן נמנעת מהחשש הזה לגמרי, בכוונה.
 * @author      Soundiform
 * @created     2026-09-27
 */

import { describe, expect, it } from 'vitest';
import { computeLayeredGain, parsePieceKey, selectVelocityBandIndex } from './DrumKitProvider';

describe('parsePieceKey — פענוח מפתח-דגימה לחלק-ערכה + שכבת-עוצמה', () => {
  it('מפתח עם סיומת-שכבה מוכרת מפוענח לחלק+שכבה', () => {
    expect(parsePieceKey('kick_pp')).toEqual({ piece: 'kick', tier: 'pp' });
    expect(parsePieceKey('hihat-closed_ff')).toEqual({ piece: 'hihat-closed', tier: 'ff' });
  });

  it('מפתח בלי סיומת-שכבה (חד-שכבתי) מפוענח עם tier=null', () => {
    expect(parsePieceKey('clap')).toEqual({ piece: 'clap', tier: null });
    expect(parsePieceKey('hihat-open')).toEqual({ piece: 'hihat-open', tier: null });
  });

  it('מפתח לא-מזוהה (לא חלק-ערכה תקף, גם לא עם סיומת) מחזיר null', () => {
    expect(parsePieceKey('cowbell')).toBeNull();
    expect(parsePieceKey('kick_extra')).toBeNull(); // "extra" אינה שכבת-עוצמה מוכרת
  });
});

describe('selectVelocityBandIndex — עוצמה בוחרת דגימה, לא רק gain', () => {
  it('4 שכבות: מחלק את 0..1 לארבעה פסים שווים', () => {
    expect(selectVelocityBandIndex(4, 0)).toBe(0);
    expect(selectVelocityBandIndex(4, 0.1)).toBe(0);
    expect(selectVelocityBandIndex(4, 0.3)).toBe(1);
    expect(selectVelocityBandIndex(4, 0.6)).toBe(2);
    expect(selectVelocityBandIndex(4, 0.9)).toBe(3);
    expect(selectVelocityBandIndex(4, 1)).toBe(3); // לא חורג מהאינדקס האחרון
  });

  it('חלק חד-שכבתי (tierCount=1) תמיד מחזיר אינדקס 0', () => {
    expect(selectVelocityBandIndex(1, 0)).toBe(0);
    expect(selectVelocityBandIndex(1, 1)).toBe(0);
  });

  it('3 שכבות (כמו tom/crash): גבולות שונים מ-4 שכבות', () => {
    expect(selectVelocityBandIndex(3, 0.2)).toBe(0);
    expect(selectVelocityBandIndex(3, 0.5)).toBe(1);
    expect(selectVelocityBandIndex(3, 0.9)).toBe(2);
  });

  it('velocity מחוץ לטווח נצמד ל-0..1 (הגנה)', () => {
    expect(selectVelocityBandIndex(4, -0.5)).toBe(0);
    expect(selectVelocityBandIndex(4, 1.5)).toBe(3);
  });
});

describe('computeLayeredGain — טווח-gain צר בתוך שכבה, מלא כשחד-שכבתי', () => {
  it('חד-שכבתי: gain = velocity המלא (התנהגות ישנה, ללא שינוי)', () => {
    expect(computeLayeredGain(1, 0, 0.3)).toBeCloseTo(0.3);
    expect(computeLayeredGain(1, 0, 0.9)).toBeCloseTo(0.9);
  });

  it('רב-שכבתי: גם ב-velocity הכי-נמוך בתוך הפס, ה-gain לא נופל מתחת ל-0.85', () => {
    const gain = computeLayeredGain(4, 3, 0.75); // תחילת פס ה-ff (אינדקס 3 מתוך 4)
    expect(gain).toBeGreaterThanOrEqual(0.85);
    expect(gain).toBeLessThanOrEqual(1);
  });

  it('רב-שכבתי: velocity=1 בפס העליון נותן gain=1 בדיוק', () => {
    expect(computeLayeredGain(4, 3, 1)).toBeCloseTo(1);
  });
});
