/**
 * @file        drumKit.test.ts
 * @description ⭐ 2026-08-31: בדיקות למיפוי גובה-בלוח → חלק-בערכה. ההבטחה למשתמש היא
 *              פשוטה — "מציירים נמוך יוצאת בעיטה, מציירים גבוה יוצאים היי-האטים" — וזה
 *              מה שנבדק כאן.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { DRUM_PIECES, DRUM_PIECE_GAIN, drumPieceForRow } from './drumKit';

const ROW_COUNT = 15;

describe('drumPieceForRow', () => {
  it('השורה התחתונה היא קיק והשורה העליונה היא קראש', () => {
    expect(drumPieceForRow(0, ROW_COUNT)).toBe('kick');
    expect(drumPieceForRow(ROW_COUNT - 1, ROW_COUNT)).toBe('crash');
  });

  it('המיפוי מונוטוני — עלייה בשורה לעולם לא חוזרת אחורה בערכה', () => {
    let previousIndex = -1;
    for (let row = 0; row < ROW_COUNT; row += 1) {
      const index = DRUM_PIECES.indexOf(drumPieceForRow(row, ROW_COUNT));
      expect(index).toBeGreaterThanOrEqual(previousIndex);
      previousIndex = index;
    }
  });

  it('קיק וסנר מקבלים אזור רחב יותר מקראש — הם עמוד השדרה של הגרוב', () => {
    const rows = Array.from({ length: ROW_COUNT }, (_, row) => drumPieceForRow(row, ROW_COUNT));
    const countOf = (piece: string) => rows.filter((candidate) => candidate === piece).length;
    expect(countOf('kick')).toBeGreaterThan(countOf('crash'));
    expect(countOf('snare')).toBeGreaterThan(countOf('crash'));
  });

  it('עובד לכל מספר-שורות חוקי, בלי לחרוג מהערכה', () => {
    for (const rowCount of [8, 13, 15, 24]) {
      for (let row = 0; row < rowCount; row += 1) {
        expect(DRUM_PIECES).toContain(drumPieceForRow(row, rowCount));
      }
    }
  });

  it('לוח בשורה אחת לא מחלק באפס', () => {
    expect(DRUM_PIECES).toContain(drumPieceForRow(0, 1));
  });

  it('שורה מחוץ לטווח מהודקת ולא מחזירה undefined', () => {
    expect(drumPieceForRow(-5, ROW_COUNT)).toBe('kick');
    expect(drumPieceForRow(999, ROW_COUNT)).toBe('crash');
  });
});

describe('DRUM_PIECE_GAIN', () => {
  it('לכל חלק בערכה יש עוצמה מוגדרת', () => {
    for (const piece of DRUM_PIECES) {
      expect(DRUM_PIECE_GAIN[piece]).toBeGreaterThan(0);
      expect(DRUM_PIECE_GAIN[piece]).toBeLessThanOrEqual(1);
    }
  });

  it('הקיק הוא החזק ביותר וההיי-האט הסגור חלש ממנו — אחרת ההי-האטים מציפים את המיקס', () => {
    expect(DRUM_PIECE_GAIN.kick).toBeGreaterThan(DRUM_PIECE_GAIN['hihat-closed']);
    expect(DRUM_PIECE_GAIN.kick).toBe(Math.max(...Object.values(DRUM_PIECE_GAIN)));
  });
});
