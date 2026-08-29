/**
 * @file        wav.ts
 * @description קידוד PCM buffer ל-WAV תקני (PCM 16-bit, איכות מלאה — למסלולי Pro/Studio).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-08-29: הועבר לכאן מ-apps/worker/src/encoders/wav.ts, ומחזיר עכשיו `Uint8Array`
 * במקום `Buffer` — כדי שגם הדפדפן יוכל להשתמש בו, מאז שההורדה רצה **במכשיר**
 * (apps/web/src/lib/download). האלגוריתם עצמו לא שונה כלל. ה-worker ממשיך לקרוא לזה דרך
 * עטיפה דקה שעוטפת ב-Buffer.from (apps/worker/src/encoders/wav.ts).
 *
 * מבנה RIFF/WAVE סטנדרטי: RIFF header → fmt chunk (PCM, 16-bit) → data chunk (samples
 * interleaved L/R). ראה http://soundfile.sapp.org/doc/WaveFormat/.
 */

const BITS_PER_SAMPLE = 16;
const PCM_FORMAT_CODE = 1;
const MAX_INT16 = 0x7fff;
const HEADER_BYTES = 44;

export interface PcmAudio {
  sampleRate: number;
  /** ערוץ אחד לכל אינדקס (0=שמאל, 1=ימין). כל הערוצים חייבים להיות באותו אורך. */
  channels: Float32Array[];
}

function floatTo16BitPcm(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped < 0 ? clamped * (MAX_INT16 + 1) : clamped * MAX_INT16);
}

function writeString(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

/** מקודד PCM (Float32, כל ערוץ ב-[-1,1]) לבייטים של קובץ WAV תקני. */
export function encodeWavBytes(audio: PcmAudio): Uint8Array {
  const { sampleRate, channels } = audio;
  const channelCount = channels.length;
  const frameCount = channels[0]?.length ?? 0;
  const bytesPerSample = BITS_PER_SAMPLE / 8;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // גודל ה-fmt chunk
  view.setUint16(20, PCM_FORMAT_CODE, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = HEADER_BYTES;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channel = channels[channelIndex];
      const sample = channel ? (channel[frameIndex] ?? 0) : 0;
      view.setInt16(offset, floatTo16BitPcm(sample), true);
      offset += bytesPerSample;
    }
  }

  return new Uint8Array(buffer);
}
