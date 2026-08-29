/**
 * @file        wav.ts
 * @description עטיפה דקה: הקידוד עצמו חי ב-@soundiform/audio (חסין-סביבה), כאן רק עטיפה
 *              ל-`Buffer` שהשאר ב-worker מצפה לו.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-08-29: האלגוריתם עבר ל-packages/audio/src/encoders/wav.ts כדי שגם הדפדפן יוכל
 * לקודד WAV — ההורדה רצה עכשיו **במכשיר**. הפונקציה כאן שומרת על אותה חתימה בדיוק
 * (מחזירה Buffer), כך ש-renderAudio.ts/encodeMp3 לא משתנים בכלל.
 */

import { encodeWavBytes, type PcmAudio } from '@soundiform/audio';

export type { PcmAudio } from '@soundiform/audio';

/** מקודד PCM ל-buffer של קובץ WAV תקני. */
export function encodeWav(audio: PcmAudio): Buffer {
  return Buffer.from(encodeWavBytes(audio));
}
