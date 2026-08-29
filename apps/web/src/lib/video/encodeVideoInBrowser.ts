/**
 * @file        encodeVideoInBrowser.ts
 * @description ⭐ 2026-08-29: מקודד MP4 (H.264 + AAC) **במכשיר של המשתמש**, דרך WebCodecs.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ למה זה קיים: עד עכשיו הווידאו רונדר ב-worker — שבפועל **לא פרוס בשום מקום** ורץ על
 * הלפטופ של בעל הפרויקט, ולכן ההורדה לקחה דקות. בנוסף, הצינור שם כותב פריים-פריים כ-PNG
 * לדיסק (1200 קבצים לסרטון של 40 שניות) ומריץ ffmpeg בתוכנה. כאן, לעומת זאת, הקידוד רץ
 * **בחומרה** של המכשיר.
 *
 * ⭐ נמדד על אנדרואיד אמיתי (ספייק, 2026-08-29): 150 פריימים ב-720p ב-2.35 שניות =
 * **2.13x מהזמן-אמת**, כלומר ~19 שניות לסרטון של 40 שניות. מתוך זה, **ציור הפריימים לקח
 * 0.04 שניות בלבד** — כל העלות היא הקידוד, והוא בחומרה. זו בדיוק הסיבה שהמסלול הזה מהיר
 * בסדר-גודל מהמסלול בשרת.
 *
 * ⚠️ האודיו נלקח מהבאפר ש**כבר רונדר** לנגינה (32kHz, renderScoreToAudioBufferCached) —
 * החלטה מפורשת של בעל הפרויקט: אפס עלות אודיו נוספת, והסרטון זהה בדיוק למה שנשמע בסטודיו.
 */

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { MusicalScore } from '@soundiform/core';
import type { ShapeData } from '@soundiform/shared';
import { drawVideoFrame, type Canvas2DLike, type FrameDimensions } from '@soundiform/video';
import { AAC_CODEC, h264CodecFor, type ExportAudioCodec } from './webcodecsSupport';

const FRAME_RATE = 30;
const VIDEO_BITRATE = 5_000_000;
const AUDIO_BITRATE = 128_000;
/** גודל מנת-אודיו שנמסרת ל-AudioEncoder בכל פעם. 1024 = גודל פריים טבעי ל-AAC. */
const AUDIO_CHUNK_FRAMES = 1024;
/** מעל זה מפסיקים להזין ונותנים למקודד להדביק — אחרת התור והזיכרון מתפוצצים בנייד. */
const MAX_ENCODE_QUEUE = 10;

const MICROSECONDS_PER_SECOND = 1_000_000;

export interface EncodeVideoInput {
  score: MusicalScore;
  shapeData: ShapeData;
  /** הבאפר שכבר רונדר לנגינה — לא מרנדרים אודיו מחדש. */
  audio: AudioBuffer;
  durationSeconds: number;
  dimensions: FrameDimensions;
  watermark: boolean;
  /**
   * ⚠️ נקבע ע"י checkVideoExportSupport, לא מנוחש כאן: Firefox מקודד H.264 אבל **לא AAC**,
   * ולכן שם נבחר Opus. ראה webcodecsSupport.ts.
   */
  audioCodec: ExportAudioCodec;
  /** [0,1] — כמה מהקידוד הושלם. נקרא תדיר; הקורא אחראי לוויסות. */
  onProgress?: (progress: number) => void;
}

/** נותן לדפדפן להתעדכן (ולתור-הקידוד להתרוקן) בלי לחסום את ה-UI. */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function drainQueue(encoder: { encodeQueueSize: number }): Promise<void> {
  while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
    await yieldToBrowser();
  }
}

/** ממיר AudioBuffer למנות `AudioData` ומזין אותן ל-AudioEncoder. */
async function encodeAudioTrack(encoder: AudioEncoder, audio: AudioBuffer): Promise<void> {
  const channelCount = audio.numberOfChannels;
  const channels = Array.from({ length: channelCount }, (_, index) => audio.getChannelData(index));

  for (let offset = 0; offset < audio.length; offset += AUDIO_CHUNK_FRAMES) {
    const frames = Math.min(AUDIO_CHUNK_FRAMES, audio.length - offset);
    // ⚠️ 'f32-planar' מצפה לערוצים **ברצף** בתוך buffer אחד (ערוץ 0 כולו, ואז ערוץ 1),
    // לא interleaved — זו טעות קלה לעשות וקשה לאבחן (האודיו יוצא מעוות).
    const planar = new Float32Array(frames * channelCount);
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      planar.set(
        channels[channelIndex]?.subarray(offset, offset + frames) ?? new Float32Array(frames),
        channelIndex * frames,
      );
    }
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: audio.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channelCount,
      timestamp: Math.round((offset / audio.sampleRate) * MICROSECONDS_PER_SECOND),
      data: planar,
    });
    encoder.encode(audioData);
    audioData.close();
    await drainQueue(encoder);
  }
}

/**
 * מקודד את היצירה ל-MP4 מלא (וידאו + אודיו) ומחזיר את הבייטים.
 * ⚠️ זורק אם המכשיר לא תומך — הקורא חייב לבדוק `checkVideoExportSupport` קודם ולטפל.
 */
export async function encodeVideoInBrowser(input: EncodeVideoInput): Promise<Uint8Array> {
  const {
    score,
    shapeData,
    audio,
    durationSeconds,
    dimensions,
    watermark,
    audioCodec,
    onProgress,
  } = input;
  const { width, height } = dimensions;
  const frameCount = Math.max(1, Math.round(durationSeconds * FRAME_RATE));

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    // ⭐ fastStart:'in-memory' שם את ה-moov בתחילת הקובץ — קריטי כדי שהסרטון יתחיל לנגן
    // מיד (ובפרט שרשתות חברתיות יקבלו אותו), במחיר סיום-קידוד מעט יקר יותר.
    fastStart: 'in-memory',
    // ⚠️⚠️ 2026-08-29 (נתפס בבדיקה חיה ב-Firefox): המקודד לא בהכרח פולט את הצ'אנק הראשון
    // עם חותמת-זמן 0 — ב-Firefox הצ'אנק הראשון של הווידאו הגיע עם DTS=0.033333 (בדיוק פריים
    // אחד), וה-muxer דחה אותו: "The first chunk ... must have a timestamp of 0". זה גם מה
    // שגרם לשגיאה השנייה, `track.info.decoderConfig is null` — בלי צ'אנק ראשון תקין,
    // ה-decoderConfig לעולם לא נקבע וה-finalize קרס. 'offset' מזיז את כל חותמות-הזמן של
    // כל מסלול כך שהראשונה תהיה 0 — בדיוק הפתרון שהספרייה עצמה ממליצה עליו בהודעת השגיאה.
    // ⚠️ הזזה של עד ~33ms היא בלתי-מורגשת, ולא פוגעת בסנכרון בין הווידאו לאודיו.
    firstTimestampBehavior: 'offset',
    video: { codec: 'avc', width, height, frameRate: FRAME_RATE },
    audio: {
      codec: audioCodec === AAC_CODEC ? 'aac' : 'opus',
      numberOfChannels: audio.numberOfChannels,
      sampleRate: audio.sampleRate,
    },
  });

  let encoderFailure: Error | null = null;
  const failOnce = (error: unknown): void => {
    encoderFailure ??= error instanceof Error ? error : new Error(String(error));
  };

  // ⚠️⚠️ 2026-08-29 (נתפס בבדיקה חיה): שגיאה שנזרקת בתוך ה-output callback של המקודד
  // **לא נתפסת** ע"י ה-try/catch שעוטף את הלולאה — היא נזרקת מתוך המכונה של WebCodecs.
  // התוצאה בפועל: הקידוד פשוט נתקע ("טעינה ממושכת" בלי הורדה ובלי שגיאה). לכן כל קריאה
  // ל-muxer עטופה, והכשל נרשם ב-failOnce ונבדק בלולאה — כך שהמשתמש מקבל שגיאה אמיתית.
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        muxer.addVideoChunk(chunk, meta);
      } catch (error) {
        failOnce(error);
      }
    },
    error: failOnce,
  });
  videoEncoder.configure({
    codec: h264CodecFor(width, height),
    width,
    height,
    bitrate: VIDEO_BITRATE,
    framerate: FRAME_RATE,
    // ⚠️⚠️ 2026-08-29 (נתפס בבדיקה חיה): בלי זה, המקודד רשאי לייצר **B-frames** — פריימים
    // שסדר-הפענוח שלהם שונה מסדר-התצוגה. בפועל ב-Firefox הצ'אנקים הגיעו לא-בסדר
    // ("DTS went from 66667 to 33333" = פריים 2 לפני פריים 1) וה-muxer דחה אותם, כי הוא
    // דורש DTS עולה-מונוטונית. 'realtime' מורה למקודד לפלוט פריימים בסדר, בלי סידור-מחדש.
    // ⚠️ הפשרה: יעילות-דחיסה מעט נמוכה יותר (קובץ קצת גדול יותר) — זניח מול העובדה
    // שבלי זה פשוט **אין קובץ**. אנחנו גם לא צריכים B-frames: זה ייצוא חד-פעמי, לא סטרימינג.
    latencyMode: 'realtime',
  });

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => {
      try {
        muxer.addAudioChunk(chunk, meta);
      } catch (error) {
        failOnce(error);
      }
    },
    error: failOnce,
  });
  audioEncoder.configure({
    codec: audioCodec,
    numberOfChannels: audio.numberOfChannels,
    sampleRate: audio.sampleRate,
    bitrate: AUDIO_BITRATE,
  });

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('לא ניתן לפתוח 2D context — הדפדפן לא תומך ב-OffscreenCanvas');
  }

  try {
    // האודיו ראשון: מנות קטנות ומהירות, כך שהמקודד מתחיל לעבוד בזמן שהווידאו מצויר.
    await encodeAudioTrack(audioEncoder, audio);
    // ⚠️ בודקים כבר כאן — אין טעם לקודד 1200 פריימים אם פס-הקול כבר נכשל.
    if (encoderFailure) {
      throw encoderFailure;
    }

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      if (encoderFailure) {
        throw encoderFailure;
      }
      drawVideoFrame(ctx as unknown as Canvas2DLike, {
        score,
        shapeData,
        progress: frameIndex / frameCount,
        dimensions,
        watermark,
      });
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((frameIndex / FRAME_RATE) * MICROSECONDS_PER_SECOND),
        duration: Math.round(MICROSECONDS_PER_SECOND / FRAME_RATE),
      });
      // keyframe כל שנייה — איזון סטנדרטי בין גודל הקובץ ליכולת דילוג/סטרימינג.
      videoEncoder.encode(frame, { keyFrame: frameIndex % FRAME_RATE === 0 });
      frame.close();

      onProgress?.(frameIndex / frameCount);
      await drainQueue(videoEncoder);
    }

    await Promise.all([videoEncoder.flush(), audioEncoder.flush()]);
    if (encoderFailure) {
      throw encoderFailure;
    }
    muxer.finalize();
    onProgress?.(1);
    return new Uint8Array(muxer.target.buffer);
  } finally {
    // ⚠️ close() על מקודד שכבר נסגר/נכשל זורק — ולכן עטוף. הניקוי חייב לקרות בכל מקרה,
    // אחרת נשארים מקודדי-חומרה תלויים באוויר עד ל-GC.
    for (const encoder of [videoEncoder, audioEncoder]) {
      try {
        if (encoder.state !== 'closed') {
          encoder.close();
        }
      } catch {
        // כבר סגור — אין מה לעשות, וזו לא שגיאה שמעניינת את הקורא.
      }
    }
  }
}
