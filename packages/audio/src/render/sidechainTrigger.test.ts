/**
 * @file        sidechainTrigger.test.ts
 * @description ⭐ 2026-08-31: רגרסיה לטריגר של הסיידצ'יין.
 *
 *              ⚠️ הבאג: הדחיקה נורתה על **כל** מכת-תופים. עד סבב ערכת-התופים הטראק היה דליל
 *              ו"מכה" הייתה בעיקר קיק, ולכן זה עבד. מאז יש בטראק גם היי-האט, סנר, מחיאה
 *              וקראש — 8-15 מכות בבר — והדחיקה לא הספיקה להשתחרר ביניהן. הפאמפינג התמרח
 *              לרעש רציף והקיק איבד את הבליטה שלו. זו הסיבה שהתופים נשמעו חלשים דווקא
 *              בטראנס ובהאוס, שם הסיידצ'יין דלוק.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בדיקה טהורה — **בלי רינדור אודיו כלל**, ולכן היא לא נספרת במגבלת-הרינדורים של
 * node-web-audio-api (ראה packages/audio/vitest.config.ts).
 */

import { describe, expect, it } from 'vitest';
import type { Note } from '@soundiform/core';
import { sidechainTriggerNotes } from './sharedScheduling';

function note(startTick: number, drumPiece?: Note['drumPiece']): Note {
  return {
    startTick,
    durationTicks: 120,
    pitch: 40,
    velocity: 0.9,
    ...(drumPiece !== undefined && { drumPiece }),
  };
}

describe('sidechainTriggerNotes', () => {
  it('בטראק ערכה — רק הקיק מפעיל דחיקה', () => {
    const notes = [
      note(0, 'kick'),
      note(120, 'hihat-closed'),
      note(240, 'hihat-closed'),
      note(480, 'snare'),
      note(480, 'kick'),
      note(600, 'crash'),
    ];
    const triggers = sidechainTriggerNotes(notes);
    expect(triggers).toHaveLength(2);
    expect(triggers.every((candidate) => candidate.drumPiece === 'kick')).toBe(true);
  });

  it('ההבדל מהותי: 4 דחיקות בבר במקום 16', () => {
    const denseBar: Note[] = [];
    for (let step = 0; step < 16; step += 1) {
      denseBar.push(note(step * 120, step % 4 === 0 ? 'kick' : 'hihat-closed'));
    }
    expect(denseBar).toHaveLength(16);
    expect(sidechainTriggerNotes(denseBar)).toHaveLength(4);
  });

  it('ציון ישן בלי drumPiece — כל התווים, בדיוק כמו קודם (תאימות לאחור)', () => {
    const legacy = [note(0), note(480), note(960)];
    expect(sidechainTriggerNotes(legacy)).toEqual(legacy);
  });

  it('טראק ערכה בלי אף קיק לא מפיל ולא דוחק על היי-האטים', () => {
    const noKick = [note(0, 'hihat-closed'), note(240, 'snare')];
    expect(sidechainTriggerNotes(noKick)).toHaveLength(0);
  });

  it('טראק ריק מחזיר ריק', () => {
    expect(sidechainTriggerNotes([])).toHaveLength(0);
  });
});
