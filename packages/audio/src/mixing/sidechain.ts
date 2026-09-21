/**
 * @file        sidechain.ts
 * @description ⭐ 2026-08-22: סיידצ'יין קומפרשן — חתימת ה-trance/house (supersaw+pumping).
 *              ראה PROJECT.md §5.2. היה stub ריק מאז Sprint 4 (TODO), עכשיו מומש.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ למה scheduled Gain-envelope ולא Tone.Compressor+Follower אמיתי: אין כאן ניתוח אודיו
 * חי של הקיק (הכל דטרמיניסטי מ-MusicalScore הסימבולי, §1) — התזמון המדויק של כל פגיעת-קיק
 * כבר ידוע מראש (drums track's notes). "מדמים" sidechain אמיתי על ידי תזמון ישיר של gain dip
 * בכל פגיעה (Tone.Part, אותה טכניקה שכל שאר sharedScheduling.ts משתמש בה) — פשוט יותר,
 * זול יותר, ודטרמיניסטי לחלוטין (לא תלוי בניתוח-אודיו בזמן אמת). Web Audio's
 * DynamicsCompressorNode ממילא *אין לו* כניסת sidechain חיצונית — הגישה הזו היא בעצם הדרך
 * הנכונה, לא פישוט-זמני.
 *
 * ⭐ 2026-08-24 (Area 2): depth/releaseSeconds הפכו לפרמטרים (היו קבועים גלובליים) — כדי
 * שכל GenrePack יוכל לכוונן "פאמפינג" הדוק (release קצר) מול "נושם" (release ארוך), ראה
 * GenrePack.sidechainDepth/sidechainReleaseSeconds (packages/genres/src/schema.ts).
 *
 * ⭐ 2026-09-20 (באג אמיתי שנתפס בבדיקה חיה — "הבס מייצר רעשי רקע"): עד עכשיו `gain` היה
 * צומת-Gain **משותף אחד** לכל הטראקים הלא-תופיים. mixChain.ts מחבר את האודיו של כל טראק
 * *לתוך* הצומת הזה (`postEqNode.connect(sidechainDuck)`) — וב-Web Audio, חיבור כמה מקורות
 * שונים לאותה כניסת-צומת **מסכם אותם שם בפועל**. כלומר כל טראק שקיבל את אותו duck קיבל גם
 * את האודיו המסוכם של *כל* הטראקים האחרים שחולקים אותו — לא רק מעטפת-עוצמה משותפת. זה
 * בדיוק ה"רעש רקע" שדווח. התיקון: `createTrackGain()` — כל טראק מקבל צומת-Gain **נפרד**
 * משלו, וכולם רשומים לקבל את **אותה** אוטומציית-דחיקה (מ-Part אחד משותף) בו-זמנית. משתף
 * את התזמון, לא את הצומת. mixChain.ts לא משתנה בכלל — הוא כבר מקבל Gain גנרי.
 *
 * ⭐ 2026-09-20: נוסף גם רמפ-כניסה קצר (ATTACK_SECONDS) לצניחת-הדחיקה, במקום קפיצה מיידית —
 * קפיצת-gain רגעית על תו-באס מוחזק (legato) יכולה ליצור נקישה שמיעתית; דחיסה אמיתית תמיד
 * משתמשת ב-attack לא-אפס בדיוק מהסיבה הזו.
 */

import { Gain, Part } from 'tone';
import type { Note } from '@soundiform/core';
import { ticksToSeconds } from '../internal/audioUtils';

/** ברירות מחדל — משמשות כשה-GenrePack לא מגדיר sidechainDepth/sidechainReleaseSeconds. */
export const DEFAULT_DUCK_DEPTH = 0.35;
export const DEFAULT_DUCK_RELEASE_SECONDS = 0.15;

/** רמפ-כניסה לצניחת-הדחיקה — קצר מספיק כדי עדיין להישמע כ"פאמפינג" חד, לא כדחיסה עצלה. */
const ATTACK_SECONDS = 0.008;

export interface SidechainDuck {
  /**
   * יוצר צומת-Gain **חדש ונפרד** ורושם אותו לקבל את אותה מעטפת-דחיקה כמו כל צומת אחר
   * שנוצר מאותו SidechainDuck — קוראים לזה פעם אחת לכל טראק (§ ראה ההערה למעלה: אסור
   * לשתף Gain יחיד בין טראקים, זה מסכם את האודיו שלהם בפועל).
   */
  createTrackGain(): Gain;
  dispose(): void;
}

/**
 * בונה מתזמן-דחיקה משותף (Part אחד על פגיעות-הקיק) שמפעיל את אותה מעטפת-gain על כל צומת
 * שנוצר דרך `createTrackGain()` — כל טראק מקבל צומת נפרד, כולם "שוקעים" ומתאוששים יחד.
 * @param depth  ה-gain (0-1) שאליו הצליל *שוקע* בכל פגיעת-קיק — לא "כמות ההנחתה" אלא הערך
 *               הנותר בפועל (0.35 = יורד ל-35% מהעוצמה, כלומר הנחתה של 65%). ערך *נמוך* יותר
 *               = "דחיקה" עמוקה/דרמטית יותר.
 */
export function createSidechainDuck(
  kickNotes: readonly Note[],
  tempoBpm: number,
  depth: number = DEFAULT_DUCK_DEPTH,
  releaseSeconds: number = DEFAULT_DUCK_RELEASE_SECONDS,
): SidechainDuck {
  const trackGains = new Set<Gain>();
  const events = kickNotes.map((note) => ({ time: ticksToSeconds(note.startTick, tempoBpm) }));
  const part = new Part<{ time: number }>((time) => {
    for (const trackGain of trackGains) {
      trackGain.gain.cancelScheduledValues(time);
      trackGain.gain.setValueAtTime(trackGain.gain.value, time);
      trackGain.gain.linearRampToValueAtTime(depth, time + ATTACK_SECONDS);
      trackGain.gain.exponentialRampToValueAtTime(1, time + ATTACK_SECONDS + releaseSeconds);
    }
  }, events);
  part.start(0);

  return {
    createTrackGain: () => {
      const trackGain = new Gain(1);
      trackGains.add(trackGain);
      return trackGain;
    },
    dispose: () => {
      part.dispose();
      for (const trackGain of trackGains) {
        trackGain.dispose();
      }
      trackGains.clear();
    },
  };
}
