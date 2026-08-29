/**
 * @file        webcodecsSupport.ts
 * @description ⭐ 2026-08-29: בודק אם המכשיר באמת יכול לקודד וידאו בדפדפן (WebCodecs).
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **לא מספיק לבדוק שה-API קיים**: דפדפן יכול לחשוף `VideoEncoder` ועדיין לא לתמוך
 * בקונפיגורציה שאנחנו צריכים (H.264 ברזולוציה מסוימת). לכן נשאלת גם `isConfigSupported`
 * בפועל, על המידות האמיתיות של הווידאו שעומדים לקודד.
 *
 * ⭐ נמדד באנדרואיד (Brave, Chrome 151): VideoEncoder ✓, AudioEncoder ✓, H.264 ב-720p
 * וב-1080p ✓, וקידוד ב-2.13x מהזמן-אמת. iOS **טרם נבדק** — ולכן הזיהוי הזה קיים: מכשיר
 * שלא עומד בזה מקבל הודעה ברורה ועדיין שומר/משתף את היצירה, בלי וידאו (ראה useDownload.ts).
 */

/** codec string ל-H.264. Baseline 3.1 מספיק ל-720p; High 4.0 נדרש ל-1080p ומעלה. */
export function h264CodecFor(width: number, height: number): string {
  return width * height > 1280 * 720 ? 'avc1.640028' : 'avc1.42001f';
}

export const AAC_CODEC = 'mp4a.40.2';
export const OPUS_CODEC = 'opus';

/**
 * ⭐ 2026-08-29 (נתפס בבדיקה חיה ב-Firefox 154): Firefox מקודד H.264 מצוין אבל **לא מקודד
 * AAC** — ולכן כל הייצוא נפל אצלו, למרות שהווידאו עצמו נתמך לחלוטין. MP4 יכול להכיל גם
 * Opus, ו-mp4-muxer תומך בזה, אז זה הגיבוי.
 *
 * ⚠️ פשרה מודעת: MP4+Opus מתנגן ב-Chrome/Firefox/אנדרואיד, אבל **לא בכל מקום** (בעיקר
 * Safari/QuickTime וחלק מהרשתות החברתיות). עדיף קובץ שמתנגן ברוב המקומות מאשר בלי וידאו
 * בכלל — אבל AAC נשאר תמיד הבחירה הראשונה כשהיא זמינה.
 */
export type ExportAudioCodec = typeof AAC_CODEC | typeof OPUS_CODEC;

export interface VideoExportSupport {
  supported: boolean;
  /** קודק האודיו שנבחר בפועל — AAC אם אפשר, אחרת Opus. */
  audioCodec?: ExportAudioCodec;
  /** סיבה קריאה-לאדם כשלא נתמך — לצורכי אבחון, לא להצגה ישירה למשתמש. */
  reason?: string;
}

export interface AudioProbeParams {
  numberOfChannels: number;
  sampleRate: number;
}

/**
 * בודק תמיכה מלאה במסלול הייצוא: וידאו (H.264) **וגם** אודיו (AAC), במידות הנתונות.
 * ⚠️ אסינכרוני — `isConfigSupported` מחזיר Promise.
 */
export async function checkVideoExportSupport(
  width: number,
  height: number,
  audioParams: AudioProbeParams = { numberOfChannels: 2, sampleRate: 48000 },
): Promise<VideoExportSupport> {
  if (typeof globalThis.VideoEncoder === 'undefined') {
    return { supported: false, reason: 'VideoEncoder is unavailable' };
  }
  if (typeof globalThis.AudioEncoder === 'undefined') {
    return { supported: false, reason: 'AudioEncoder is unavailable' };
  }

  try {
    // ⚠️ הבדיקה חייבת לכלול bitrate/framerate — בלעדיהם דפדפנים מסוימים מחזירים תשובה
    // שונה מזו שתתקבל ב-configure() בפועל, וזה בדיוק ההבדל בין "עובד" ל"נכשל בזמן אמת".
    const video = await VideoEncoder.isConfigSupported({
      codec: h264CodecFor(width, height),
      width,
      height,
      bitrate: 5_000_000,
      framerate: 30,
    });
    if (!video.supported) {
      return { supported: false, reason: `H.264 ${String(width)}x${String(height)} unsupported` };
    }

    // ⚠️ נבדק עם ה-sampleRate/הערוצים **האמיתיים** של האודיו שנקודד. קודם הייתה כאן הנחה
    // קשיחה של 48kHz/סטריאו בעוד הפריוויו מרונדר ב-32kHz — בדיקה שלא תואמת את מה שבאמת
    // מקודדים היא בדיקה חסרת ערך.
    for (const codec of [AAC_CODEC, OPUS_CODEC] as const) {
      const audio = await AudioEncoder.isConfigSupported({ codec, ...audioParams });
      if (audio.supported) {
        return { supported: true, audioCodec: codec };
      }
    }
    return { supported: false, reason: 'no supported audio encoder (AAC/Opus)' };
  } catch (error) {
    // דפדפן שזורק כאן במקום להחזיר false — מטופל בדיוק כמו "לא נתמך".
    return { supported: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export interface ResolvedExportDimensions {
  width: number;
  height: number;
  /** true כשירדנו מהרזולוציה שהמנוי מזכה בה, כי המכשיר לא תמך בה. */
  downgraded: boolean;
  /** הקודק שנבחר בפועל לפס-הקול — ראה ExportAudioCodec. */
  audioCodec: ExportAudioCodec;
}

/**
 * ⭐ 2026-08-29 (נתפס בבדיקה חיה): מכשיר יכול לתמוך ב-H.264 ב-720p ולא ב-4K — קידוד
 * ברזולוציה גבוהה דורש רמת-פרופיל גבוהה יותר ולעיתים חומרה אחרת. עד התיקון, משתמש במנוי
 * בתשלום (1080p/4K) היה מקבל "המכשיר לא תומך" ונשאר **בלי וידאו בכלל** — בזמן שאותו מכשיר
 * מסוגל בהחלט לייצר 1080p או 720p.
 *
 * לכן: מנסים את הרזולוציה שהמנוי מזכה בה, ואם היא לא נתמכת — יורדים מדרגה, עד 720p.
 * ⚠️ ירידה כזו היא **פחות ממה שהמשתמש שילם עבורו**, ולכן מדווחת החוצה (`downgraded`)
 * כדי שה-UI יגיד לו את זה, ולא "ישתיק" את ההבדל.
 */
export async function resolveSupportedDimensions(
  preferred: { width: number; height: number },
  fallbacks: readonly { width: number; height: number }[],
  audioParams: AudioProbeParams,
): Promise<ResolvedExportDimensions | null> {
  const candidates = [preferred, ...fallbacks];
  for (const [index, candidate] of candidates.entries()) {
    const support = await checkVideoExportSupport(candidate.width, candidate.height, audioParams);
    if (support.supported && support.audioCodec) {
      return { ...candidate, downgraded: index > 0, audioCodec: support.audioCodec };
    }
  }
  return null;
}
