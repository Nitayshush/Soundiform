/**
 * @file        sampleLoader.ts
 * @description ⭐ 2026-08-30: מוריד ומפענח דגימות **פעם אחת** ושומר אותן במטמון, כדי
 *              שה-SamplerProvider יוכל להיבנות מבאפרים מוכנים בלי רשת.
 * @author      Soundiform
 * @created     2026-08-30
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ למה זה חייב להיות מטמון-מראש ולא טעינה עצלה בתוך ה-provider:
 * הרינדור עבר לדפדפן ורץ דרך `Tone.Offline` (ראה render/offlineRenderer.ts). ההקשר האופליין
 * מתחיל לרנדר **מיד** אחרי ה-callback — אסור שבתוכו תתרחש טעינת-רשת, כי היא לא תספיק והדגימה
 * תצא שקטה. לכן: מפענחים **לפני** שנכנסים ל-Offline, ובתוכו רק בונים Sampler מבאפרים.
 *
 * ⚠️ בנוסף, בלי מטמון היינו מורידים מחדש בכל ניגון ובכל הורדה — הרינדור קורה הרבה יותר
 * מפעם אחת לכל יצירה. המטמון הוא ברמת-מודול ולכן חי לכל אורך הסשן.
 */

import { getContext } from 'tone';

/** תיאור כלי דגום — מגיע מחבילת-הז'אנר (soundOptions), לא מרשימה קשיחה כאן. */
export interface SampledInstrumentSpec {
  /** שם התיקייה תחת /samples (למשל 'upright-piano'). */
  instrumentId: string;
  /** שמות התווים שקיימים כקבצים (למשל ['C#3','C#4']) — כל אחד הוא `<note>.<extension>`. */
  notes: readonly string[];
  extension: string;
}

/** note → AudioBuffer מפוענח. */
export type DecodedSamples = Record<string, AudioBuffer>;

/** ⚠️ ברירת המחדל תואמת ל-apps/web/public/samples — שינוי כאן מחייב העברת הקבצים בפועל. */
const SAMPLE_BASE_PATH = '/samples';

const decodedCache = new Map<string, DecodedSamples>();
/** בקשות בתעופה — שתי קריאות מקבילות לאותו כלי לא יורידו פעמיים. */
const inFlight = new Map<string, Promise<DecodedSamples>>();

function sampleUrl(spec: SampledInstrumentSpec, note: string): string {
  // ⚠️ encodeURIComponent על שם התו: '#' ב-'C#3' הוא fragment ב-URL ויקטע את הנתיב.
  return `${SAMPLE_BASE_PATH}/${spec.instrumentId}/${encodeURIComponent(note)}.${spec.extension}`;
}

async function decodeOne(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`sample fetch failed (${String(response.status)}): ${url}`);
  }
  const encoded = await response.arrayBuffer();
  // ⚠️ מפענחים על ה-context החי (לא על האופליין): AudioBuffer מפוענח נייד בין הקשרים,
  // וכך אותו באפר משמש גם ניגון וגם כל רינדור עתידי, בלי פענוח חוזר.
  return getContext().rawContext.decodeAudioData(encoded);
}

/**
 * מוודא שכל הדגימות של הכלי מפוענחות וזמינות. בטוח לקרוא פעמים רבות — הקריאה השנייה
 * ואילך מוחזרת מהמטמון בלי רשת.
 */
export async function preloadSampledInstrument(
  spec: SampledInstrumentSpec,
): Promise<DecodedSamples> {
  const cached = decodedCache.get(spec.instrumentId);
  if (cached) {
    return cached;
  }
  const pending = inFlight.get(spec.instrumentId);
  if (pending) {
    return pending;
  }

  const load = (async (): Promise<DecodedSamples> => {
    const buffers = await Promise.all(spec.notes.map((note) => decodeOne(sampleUrl(spec, note))));
    const samples: DecodedSamples = {};
    spec.notes.forEach((note, index) => {
      const buffer = buffers[index];
      if (buffer) {
        samples[note] = buffer;
      }
    });
    decodedCache.set(spec.instrumentId, samples);
    return samples;
  })();

  inFlight.set(spec.instrumentId, load);
  try {
    return await load;
  } finally {
    // ⚠️ תמיד מנקים, גם בכשל — אחרת ניסיון חוזר היה מקבל את אותה הבטחה שנכשלה לנצח.
    inFlight.delete(spec.instrumentId);
  }
}

/** הדגימות שכבר מפוענחות לכלי, או undefined אם עוד לא נטענו. */
export function getDecodedSamples(instrumentId: string): DecodedSamples | undefined {
  return decodedCache.get(instrumentId);
}

/** ⚠️ לבדיקות בלבד — מנקה את המטמון כדי שכל בדיקה תתחיל ממצב ידוע. */
export function clearSampleCacheForTests(): void {
  decodedCache.clear();
  inFlight.clear();
}
