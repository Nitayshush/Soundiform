/**
 * @file        noteBoard.test.ts
 * @description ⭐ 2026-08-30: הלוח נעשה מוגדר-לפי-סגנון (שורש + מספר שורות). הבדיקות כאן
 *              נועלות שני דברים: שהברירות-מחדל **לא זזו** (טראנס/האוס), ושקונפיג-סגנון
 *              באמת משנה את הלוח.
 * @author      Soundiform
 * @created     2026-08-30
 *
 * ⚠️ הבדיקה הראשונה היא רגרסיה אמיתית: טראנס והאוס כבר בפרודקשן עם לוח C3–C5 מאושר.
 * אם ברירת-המחדל תזוז, כל יצירה חדשה בסגנונות האלה תישמע אחרת — בלי שאיש התכוון.
 */

import { describe, expect, it } from 'vitest';
import type { Mode } from '../score/MusicalScore';
import {
  ABSOLUTE_BOARD_ROW_COUNT,
  buildNoteBoardRows,
  MAX_BOARD_ROW_COUNT,
  MIN_BOARD_ROW_COUNT,
  quantizeYToRowIndex,
  resolveBoardPitchRange,
  resolveBoardRowCount,
  ROOT_OCTAVE_BASE_MIDI,
} from './noteBoard';

/** C3 — הבסיס שממנו נבנה הלוח. */
const C3 = ROOT_OCTAVE_BASE_MIDI;

describe('buildNoteBoardRows — ברירת המחדל לא זזה (רגרסיה לטראנס/האוס)', () => {
  it('בלי rowCount: 15 שורות, מהשורש עצמו ועד אוקטבה-כפולה מעליו', () => {
    const rows = buildNoteBoardRows(C3, 'aeolian');
    expect(rows).toHaveLength(ABSOLUTE_BOARD_ROW_COUNT);
    expect(rows[0]).toBe(C3); // השורה התחתונה היא השורש עצמו
    expect(rows[rows.length - 1]).toBe(C3 + 24); // 15 דרגות = שתי אוקטבות
  });

  it('השורות עולות מונוטונית — לוח שאינו ממוין הוא לוח שבור', () => {
    const rows = buildNoteBoardRows(C3, 'lydian');
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]).toBeGreaterThan(rows[index - 1] ?? -Infinity);
    }
  });
});

describe('buildNoteBoardRows — קונפיג לפי סגנון', () => {
  it('שורש אחר מזיז את כל הלוח באותו אינטרוול', () => {
    const onC = buildNoteBoardRows(C3, 'lydian');
    const onF = buildNoteBoardRows(C3 + 5, 'lydian');
    expect(onF).toHaveLength(onC.length);
    onF.forEach((pitch, index) => {
      expect(pitch - (onC[index] ?? 0)).toBe(5);
    });
  });

  it('מספר שורות אחר משנה את גובה הלוח', () => {
    expect(buildNoteBoardRows(C3, 'aeolian', 10)).toHaveLength(10);
  });
});

describe('resolveBoardRowCount — הידוק לטווח שפוי', () => {
  it('undefined נופל לברירת המחדל', () => {
    expect(resolveBoardRowCount(undefined)).toBe(ABSOLUTE_BOARD_ROW_COUNT);
  });

  it('⚠️ ערך מחוץ לטווח מהודק ולא זורק — הקונפיג מגיע מה-DB, לא רק מקבצים בבדיקה', () => {
    expect(resolveBoardRowCount(2)).toBe(MIN_BOARD_ROW_COUNT);
    expect(resolveBoardRowCount(999)).toBe(MAX_BOARD_ROW_COUNT);
  });
});

describe('quantizeYToRowIndex — מיפוי Y לשורה', () => {
  it('Y=0 (ראש הקנבס) היא השורה הגבוהה, Y=1 היא הנמוכה', () => {
    expect(quantizeYToRowIndex(0, 15)).toBe(14);
    expect(quantizeYToRowIndex(1, 15)).toBe(0);
  });

  it('⚠️ Y מחוץ ל-[0,1] מהודק — נקודת-ציור חריגה לא תייצר אינדקס לא-חוקי', () => {
    expect(quantizeYToRowIndex(-5, 15)).toBe(14);
    expect(quantizeYToRowIndex(5, 15)).toBe(0);
  });
});

describe('resolveBoardPitchRange — טווח-תצוגה קבוע לתיאום בין הרשת לפסים (2026-09-24)', () => {
  const mode: Mode = 'aeolian';

  it('כש-noteBoardRowCount מוגדר — מחזיר בדיוק את min/max של buildNoteBoardRows', () => {
    const rowCount = 15;
    const rows = buildNoteBoardRows(C3, mode, rowCount);
    const range = resolveBoardPitchRange({ key: { root: 0, mode }, noteBoardRowCount: rowCount });
    expect(range).toEqual({ minPitch: rows[0], maxPitch: rows[rows.length - 1] });
  });

  it('טווח קבוע — לא תלוי בכלל בתווים שבפועל יצאו (בניגוד לטווח הדינמי הישן)', () => {
    // שורש אחר (rootPitchClass=4, כמו draft 6 האמיתי) — עדיין רק לפי הלוח, לא לפי שום note.
    const range = resolveBoardPitchRange({ key: { root: 4, mode }, noteBoardRowCount: 15 });
    const rows = buildNoteBoardRows(C3 + 4, mode, 15);
    expect(range).toEqual({ minPitch: rows[0], maxPitch: rows[rows.length - 1] });
  });

  it('בלי noteBoardRowCount (רגאיי, בלי לוח-קבוע) — מחזיר null, לא ממציא טווח', () => {
    expect(resolveBoardPitchRange({ key: { root: 0, mode } })).toBeNull();
  });

  it('מספר-שורות שונה (כמו cinematic=13) נותן טווח שונה — לא קבוע-קשיח על 15', () => {
    const range13 = resolveBoardPitchRange({ key: { root: 0, mode }, noteBoardRowCount: 13 });
    const range15 = resolveBoardPitchRange({ key: { root: 0, mode }, noteBoardRowCount: 15 });
    expect(range13?.maxPitch).not.toBe(range15?.maxPitch);
  });
});
