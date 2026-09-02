/**
 * @file        clientRender.ts
 * @description ⭐ 2026-08-29: מתזמר את ההורדה **במכשיר** — מרנדר אודיו/וידאו/פוסטר, מעלה
 *              ישירות ל-R2 בכתובות חתומות, וסוגר מול השרת.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * הזרימה: POST client/start (השרת מאשר, מחזיר score+כתובות) → רינדור והעלאה כאן →
 * POST client/complete (השרת מאמת ורושם) → משם ממשיך המסלול הקיים (shares/download).
 *
 * ⚠️ מכשיר שלא תומך ב-WebCodecs לא נכשל: הוא מדלג על הווידאו, מעלה אודיו+פוסטר, והיצירה
 * נשמרת ומשותפת כרגיל (דף השיתוף כבר מטפל ב-hasVideo=false). ההודעה למשתמש מוצגת ע"י
 * הקורא (useDownload.ts) לפי `hasVideo` שחוזר מכאן.
 */

'use client';

import type { MusicalScore } from '@soundiform/core';
import type { GenreAudioConfig } from '@soundiform/audio';
import type { ShapeData } from '@soundiform/shared';
import type { FrameDimensions } from '@soundiform/video';

export type ClientRenderStage = 'preparing' | 'audio' | 'video' | 'uploading' | 'saving';

export interface ClientRenderProgress {
  stage: ClientRenderStage;
  /** [0,1] בתוך השלב הנוכחי, או undefined כשלא ניתן למדוד. */
  ratio?: number;
}

export interface ClientRenderInput {
  projectId: string;
  genreId: string;
  aspectRatio: string;
  soundSelections?: Record<string, string[]>;
  /**
   * ⭐ 2026-09-02: ה-object URL של התמונה שהמשתמש העלה (shapeStore.previewImageUrl).
   * כשקיים — הוא נכנס לפריימים של הווידאו, כך שהקליפ מראה את התמונה שלו ולא את השלד.
   * ⚠️ אופציונלי: ציור-יד ו-SVG לא שולחים אותו, והווידאו יוצא בדיוק כמו קודם.
   */
  previewImageUrl?: string | null;
  onProgress?: (progress: ClientRenderProgress) => void;
}

/**
 * מפענח את התמונה פעם אחת לפני לולאת-הפריימים.
 *
 * ⚠️ **כישלון כאן לא מפיל את הווידאו.** מחזירים null וממשיכים בלי התמונה — אותו כלל
 * שנקבע ב-0ed90b6: "כישלון קידוד אינו כישלון הורדה". תמונה חסרה היא פגם ויזואלי, לא סיבה
 * לאבד את כל היצירה.
 */
async function decodePreviewImage(url: string | null | undefined): Promise<ImageBitmap | null> {
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch (error) {
    console.error('clientRender: פענוח התמונה המקורית נכשל — הווידאו ייוצא בלעדיה', error);
    return null;
  }
}

export interface ClientRenderResult {
  renderId: string;
  hasVideo: boolean;
  /** מוגדר רק כשהמכשיר לא תמך ברזולוציה של המנוי וירדנו מדרגה (למשל '1080p'). */
  downgradedTo?: string;
  /**
   * ⚠️ true כשפס-הקול קודד ב-Opus ולא ב-AAC (בפועל: Firefox, שלא מקודד AAC כלל).
   * קובץ כזה מתנגן בדפדפנים — אבל **לא** בנגני-שולחן-עבודה כמו Windows Media Player,
   * ולא בכל הרשתות. הקורא חייב לומר את זה למשתמש ולא להשאיר אותו עם קובץ שלא נפתח.
   */
  limitedCompatibility?: boolean;
  /**
   * ⚠️ מוגדר כשקידוד הווידאו נכשל בדפדפן הזה (בפועל: Firefox). היצירה **כן** נשמרה
   * ומשותפת — פשוט בלי קובץ mp4. הטקסט עצמו לאבחון בלבד, לא להצגה למשתמש.
   */
  videoFailureReason?: string;
}

interface StartResponse {
  score: MusicalScore;
  audioConfig: GenreAudioConfig;
  shapeData: ShapeData;
  video: { aspectRatio: string; quality: '720p' | '1080p' | '4k'; watermark: boolean };
  uploads: Record<string, { key: string; url: string }>;
  error?: string;
}

const QUALITY_SHORT_SIDE: Record<string, number> = { '720p': 720, '1080p': 1080, '4k': 2160 };

function toEven(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/** ⚠️ חייב להישאר זהה ל-computeVideoDimensions ב-apps/worker/src/video/videoEncoder.ts. */
function computeDimensions(quality: string, aspectRatio: string): FrameDimensions {
  const shortSide = QUALITY_SHORT_SIDE[quality] ?? 720;
  if (aspectRatio === '9:16') {
    return { width: toEven(shortSide), height: toEven((shortSide * 16) / 9) };
  }
  if (aspectRatio === '1:1') {
    return { width: toEven(shortSide), height: toEven(shortSide) };
  }
  return { width: toEven((shortSide * 16) / 9), height: toEven(shortSide) };
}

async function putToR2(url: string, body: Uint8Array, contentType: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: body as BodyInit,
    });
  } catch (caughtError) {
    // ⚠️ 2026-08-29 — כשל-CORS גורם ל-fetch עצמו לדחות (TypeError גנרי, "NetworkError when
    // attempting to fetch resource"), **לא** לתשובה עם status. ההודעה הגנרית הזו לא אומרת
    // כלום ואי אפשר לאבחן ממנה — נתפס בבדיקה חיה. ההעלאה היא ישירות ל-R2 מהדפדפן, ולכן
    // הדלי חייב CORS Policy עם ה-origin המדויק (scheme://host:port, בלי סלאש ובלי נתיב).
    throw new Error(
      `Upload was blocked by the storage bucket. If this persists, the R2 CORS policy must allow PUT from ${globalThis.location.origin} (details: ${
        caughtError instanceof Error ? caughtError.message : String(caughtError)
      })`,
    );
  }
  if (!response.ok) {
    throw new Error(`Upload failed (${String(response.status)} ${response.statusText})`);
  }
}

/** ממיר AudioBuffer לערוצי Float32Array — הצורה ש-encodeWavBytes מצפה לה. */
function toChannels(audio: AudioBuffer): Float32Array[] {
  return Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
}

/**
 * ⭐ קצב הדגימה לפס-הקול של הווידאו. 48kHz הוא הקצב שכל מקודדי ה-AAC מצהירים עליו תמיכה.
 * ⚠️ **לא** לשנות ל-32kHz "כדי לחסוך": ראה resampleForVideo למטה.
 */
const VIDEO_AUDIO_SAMPLE_RATE = 48000;

/**
 * ⭐⭐ 2026-08-29 (נתפס בבדיקה חיה): הסרטון התנגן מצוין בדפדפן אבל **לא נפתח ב-Windows
 * Media Player**. הסיבה: הנגינה מרונדרת ב-32kHz, ומקודדי AAC רבים מצהירים תמיכה רק
 * ב-44.1/48kHz — אז בדיקת ה-AAC נכשלה, הקוד נפל ל-Opus, ו-Opus בתוך MP4 מתנגן בדפדפנים
 * אבל לא בנגני-שולחן-עבודה ולא בחלק מהרשתות החברתיות.
 *
 * ההמרה כאן זולה מאוד: זו העתקת באפר קיים דרך ממיר-הקצב של הדפדפן — **לא** סינתזה מחדש
 * של המוזיקה (שהייתה מוסיפה דקות בנייד). התוצאה: MP4 עם AAC, שמתנגן בכל מקום.
 *
 * ⚠️ חל רק על פס-הקול של הווידאו. הורדות ה-WAV/MP3 נשארות בקצב המקורי — אין שום ערך
 * בהגדלת קובץ ע"י דגימה-מעלה, והן מתנגנות בכל מקרה.
 */
async function resampleForVideo(audio: AudioBuffer): Promise<AudioBuffer> {
  if (audio.sampleRate === VIDEO_AUDIO_SAMPLE_RATE) {
    return audio;
  }
  const context = new OfflineAudioContext(
    audio.numberOfChannels,
    Math.ceil(audio.duration * VIDEO_AUDIO_SAMPLE_RATE),
    VIDEO_AUDIO_SAMPLE_RATE,
  );
  const source = context.createBufferSource();
  source.buffer = audio;
  source.connect(context.destination);
  source.start();
  return context.startRendering();
}

/**
 * מרנדר ומעלה הכל מהמכשיר, ומחזיר את מזהה הרינדור שנרשם בשרת.
 */
export async function runClientRender(input: ClientRenderInput): Promise<ClientRenderResult> {
  const { previewImageUrl } = input;
  const { projectId, genreId, aspectRatio, soundSelections, onProgress } = input;
  onProgress?.({ stage: 'preparing' });

  const startResponse = await fetch('/api/render/client/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      genreId,
      aspectRatio,
      ...(soundSelections && { soundSelections }),
    }),
  });
  const start = (await startResponse.json()) as StartResponse;
  if (!startResponse.ok) {
    throw new Error(start.error ?? 'Could not start the render');
  }

  const dimensions = computeDimensions(start.video.quality, start.video.aspectRatio);

  // ── אודיו: הבאפר שכבר רונדר לנגינה, מהמטמון. אין רינדור אודיו נוסף (החלטת בעל הפרויקט). ──
  onProgress?.({ stage: 'audio' });
  const { renderScoreToAudioBufferCached, encodeWavBytes, computeDurationSeconds } =
    await import('@soundiform/audio');
  const rendered = await renderScoreToAudioBufferCached(start.score, start.audioConfig);
  const durationSeconds = computeDurationSeconds(start.score, start.audioConfig);

  const uploads: Promise<void>[] = [];
  const wavBytes = encodeWavBytes({
    sampleRate: rendered.buffer.sampleRate,
    channels: toChannels(rendered.buffer),
  });
  const audioUpload = start.uploads.audio;
  if (audioUpload) {
    uploads.push(putToR2(audioUpload.url, wavBytes, 'audio/wav'));
  }

  // ⚠️ MP3 הוא מה שמסלול **חינם** מקבל בהורדת אודיו (download/route.ts: wantsWav =
  // plan !== 'free') — בלעדיו ההורדה נשברת לרוב המשתמשים, ולכן הוא לא אופציונלי.
  const mp3Upload = start.uploads.mp3;
  if (mp3Upload) {
    const { encodeMp3InBrowser } = await import('@/lib/download/encodeMp3InBrowser');
    uploads.push(putToR2(mp3Upload.url, await encodeMp3InBrowser(rendered.buffer), 'audio/mpeg'));
  }

  // ⚠️ MIDI הוא פיצ'ר Studio בלבד (download/route.ts חוסם לאחרים) — מעלים תמיד, זול,
  // וכך שדרוג מסלול לא מצריך רינדור מחדש.
  const midiUpload = start.uploads.midi;
  if (midiUpload) {
    const { encodeMidiBytes } = await import('@soundiform/audio');
    uploads.push(putToR2(midiUpload.url, encodeMidiBytes(start.score), 'audio/midi'));
  }

  // ── וידאו + פוסטר ──
  // ⭐ 2026-08-29: אם המכשיר לא תומך ברזולוציה שהמנוי מזכה בה — יורדים מדרגה במקום לוותר
  // על הווידאו לגמרי (נתפס בבדיקה חיה). הפוסטר תמיד נשאר ברזולוציה המלאה: הוא ציור-קנבס
  // רגיל ולא תלוי בכלל במקודד.
  // ⚠️ ממירים **לפני** בדיקת התמיכה, כדי שהבדיקה תישאל על הקצב שבאמת נקודד (48kHz) —
  // בדיקה על קצב אחר מזה שמקודדים היא בדיוק הבאג שגרם לקובץ שלא נפתח בנגן. ראה resampleForVideo.
  const videoAudio = await resampleForVideo(rendered.buffer);
  const { resolveSupportedDimensions } = await import('@/lib/video/webcodecsSupport');
  const videoDimensions = await resolveSupportedDimensions(
    dimensions,
    [
      computeDimensions('1080p', start.video.aspectRatio),
      computeDimensions('720p', start.video.aspectRatio),
    ],
    {
      numberOfChannels: videoAudio.numberOfChannels,
      sampleRate: videoAudio.sampleRate,
    },
  );
  let hasVideo = false;
  let downgradedTo: string | null = null;
  /** סיבת הכשל בקידוד, לאבחון — לא מוצגת למשתמש. ראה ה-catch למטה. */
  let videoFailureReason: string | null = null;

  const { drawVideoFrame } = await import('@soundiform/video');
  const posterCanvas = document.createElement('canvas');
  posterCanvas.width = dimensions.width;
  posterCanvas.height = dimensions.height;
  const posterCtx = posterCanvas.getContext('2d');
  if (posterCtx) {
    drawVideoFrame(posterCtx as unknown as Parameters<typeof drawVideoFrame>[0], {
      score: start.score,
      shapeData: start.shapeData,
      progress: 0.5,
      dimensions,
      watermark: start.video.watermark,
    });
    const posterBlob = await new Promise<Blob | null>((resolve) => {
      posterCanvas.toBlob(resolve, 'image/jpeg', 0.8);
    });
    const posterUpload = start.uploads.poster;
    if (posterBlob && posterUpload) {
      uploads.push(
        putToR2(posterUpload.url, new Uint8Array(await posterBlob.arrayBuffer()), 'image/jpeg'),
      );
    }
  }

  if (videoDimensions) {
    onProgress?.({ stage: 'video', ratio: 0 });
    if (videoDimensions.downgraded) {
      downgradedTo = `${String(videoDimensions.height)}p`;
    }
    // ⚠️⚠️ 2026-08-29 (נתפס באתר החי): כשל בקידוד הווידאו הוא **לא** כשל של ההורדה כולה.
    // בפיירפוקס הקידוד זורק (למשל "Timestamps must be monotonically increasing" — המקודד
    // מסדר פריימים מחדש למרות latencyMode:'realtime'), וקודם לכן זה התפשט החוצה: המשתמש
    // ראה שגיאה טכנית גולמית **והיצירה שלו אבדה** כי client/complete מעולם לא נקרא.
    //
    // עכשיו: בולעים את הכשל, ממשיכים להעלות אודיו+פוסטר ולרשום את היצירה — כך שהיא נשמרת
    // בגלריה וניתנת לשיתוף — והקורא מציג הודעה מובנת ("שמרנו, הורד דרך Chrome").
    // זה גם עמיד בפני כל תקלת-מקודד עתידית בכל דפדפן, במקום לרדוף אחרי כל אחת בנפרד.
    try {
      const { encodeVideoInBrowser } = await import('@/lib/video/encodeVideoInBrowser');
      // ⭐ 2026-09-02: התמונה המקורית נכנסת לווידאו. היא נלקחת מה-object URL שכבר קיים
      // בסטודיו (shapeStore.previewImageUrl) — אותו קובץ שהמשתמש רואה על הלוח, כך
      // ש"פריוויו = פלט" נשמר גם כאן.
      // ⚠️ פענוח אחד בלבד, לפני הלולאה. כישלון בפענוח **לא מפיל את הווידאו** — מקבלים
      // קליפ בלי התמונה, בדיוק לפי הכלל שנקבע ב-0ed90b6 ("כישלון קידוד אינו כישלון הורדה").
      const backgroundImage = await decodePreviewImage(previewImageUrl);
      const mp4 = await encodeVideoInBrowser({
        score: start.score,
        shapeData: start.shapeData,
        ...(backgroundImage && { backgroundImage }),
        audio: videoAudio,
        durationSeconds,
        dimensions: { width: videoDimensions.width, height: videoDimensions.height },
        watermark: start.video.watermark,
        audioCodec: videoDimensions.audioCodec,
        onProgress: (ratio) => {
          onProgress?.({ stage: 'video', ratio });
        },
      });
      const videoUpload = start.uploads.video;
      if (videoUpload) {
        uploads.push(putToR2(videoUpload.url, mp4, 'video/mp4'));
        hasVideo = true;
      }
    } catch (caughtError) {
      // נשמר לאבחון בלבד — למשתמש מוצגת הודעה מובנת, לא הטקסט הזה.
      videoFailureReason = caughtError instanceof Error ? caughtError.message : String(caughtError);
      console.warn('Video encoding failed on this browser; saving without video.', caughtError);
    }
  }

  onProgress?.({ stage: 'uploading' });
  await Promise.all(uploads);

  onProgress?.({ stage: 'saving' });
  const completeResponse = await fetch('/api/render/client/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, genreId, ...(soundSelections && { soundSelections }) }),
  });
  const complete = (await completeResponse.json()) as {
    renderId?: string;
    hasVideo?: boolean;
    error?: string;
  };
  if (!completeResponse.ok || !complete.renderId) {
    throw new Error(complete.error ?? 'Could not save the render');
  }

  return {
    renderId: complete.renderId,
    hasVideo: complete.hasVideo ?? hasVideo,
    ...(downgradedTo !== null && { downgradedTo }),
    ...(videoFailureReason !== null && { videoFailureReason }),
    ...(videoDimensions && videoDimensions.audioCodec !== 'mp4a.40.2'
      ? { limitedCompatibility: true }
      : {}),
  };
}
