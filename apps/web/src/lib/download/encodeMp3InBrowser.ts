/**
 * @file        encodeMp3InBrowser.ts
 * @description ⭐ 2026-08-29: קידוד MP3 במכשיר (lamejs, JavaScript טהור).
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ למה זה נדרש: המסלול הישן קידד MP3 ב-worker דרך ffmpeg (libmp3lame) — קוד Node בלבד.
 * מאז שההורדה רצה במכשיר, בלי זה `renders.mp3Key` היה נשאר null, ו-**מסלול חינם היה נשבר**:
 * api/renders/[renderId]/download מגיש למסלול free דווקא את ה-MP3 (`wantsWav = plan !== 'free'`),
 * לא את ה-WAV. כלומר זו לא "תוספת נחמדה" אלא תנאי לכך שההורדה תמשיך לעבוד לרוב המשתמשים.
 *
 * ⚠️ 192kbps — אותו bitrate בדיוק כמו DEFAULT_BITRATE_KBPS ב-apps/worker/src/encoders/mp3.ts,
 * כדי שהפלט לא ישתנה בין המסלולים.
 *
 * ⚠️ הנרמול ל--14 LUFS (§4.3) קורה על ה-PCM לפני שמגיעים לכאן — הקידוד לא נוגע בעוצמה.
 */

'use client';

const BITRATE_KBPS = 192;
/** גודל מנה שנשלחת ל-lamejs. 1152 = גודל פריים טבעי ל-MPEG layer III. */
const SAMPLES_PER_CHUNK = 1152;
const MAX_INT16 = 0x7fff;

function toInt16(channel: Float32Array, start: number, length: number): Int16Array {
  const output = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channel[start + index] ?? 0));
    output[index] = Math.round(sample < 0 ? sample * (MAX_INT16 + 1) : sample * MAX_INT16);
  }
  return output;
}

/**
 * מקודד AudioBuffer ל-MP3. תומך במונו ובסטריאו.
 * ⚠️ חוסם את ה-thread בזמן הריצה — הקורא (clientRender.ts) מריץ אותו כשלב מוצהר עם משוב
 * למשתמש, לא ברקע שקט.
 */
export async function encodeMp3InBrowser(audio: AudioBuffer): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const channelCount = Math.min(2, audio.numberOfChannels);
  const encoder = new Mp3Encoder(channelCount, audio.sampleRate, BITRATE_KBPS);

  const left = audio.getChannelData(0);
  const right = channelCount > 1 ? audio.getChannelData(1) : null;
  const parts: Uint8Array[] = [];

  for (let offset = 0; offset < audio.length; offset += SAMPLES_PER_CHUNK) {
    const length = Math.min(SAMPLES_PER_CHUNK, audio.length - offset);
    const encoded = right
      ? encoder.encodeBuffer(toInt16(left, offset, length), toInt16(right, offset, length))
      : encoder.encodeBuffer(toInt16(left, offset, length));
    if (encoded.length > 0) {
      parts.push(encoded);
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) {
    parts.push(tail);
  }

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }
  return output;
}
