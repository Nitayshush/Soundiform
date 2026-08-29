/**
 * @file        midi.ts
 * @description עטיפה דקה: הקידוד עצמו חי ב-@soundiform/audio (חסין-סביבה), כאן רק עטיפה
 *              ל-`Buffer` שהשאר ב-worker מצפה לו.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-08-29: האלגוריתם עבר ל-packages/audio/src/encoders/midi.ts כדי שגם הדפדפן יוכל
 * לייצא MIDI — ההורדה רצה עכשיו **במכשיר**. הבייטים זהים לחלוטין; רק פעולות ה-Buffer
 * הוחלפו ב-Uint8Array/DataView שם. החתימה כאן לא השתנתה.
 */

import { encodeMidiBytes } from '@soundiform/audio';
import type { MusicalScore } from '@soundiform/core';

/** מקודד MusicalScore ל-Standard MIDI File (format 1). */
export function encodeMidi(score: MusicalScore): Buffer {
  return Buffer.from(encodeMidiBytes(score));
}
