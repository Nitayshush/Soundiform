/**
 * @file        beatPattern.ts
 * @description ⭐ 2026-08-31 (סבב א'): מקצב תופים **ידני** שהמשתמש בוחר, בלתי-תלוי בציור.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה זה נוסף, אחרי שכל הסבב הקודם הוציא את התבניות הקבועות מהמנוע.** כשתכננו את
 * מנגנון-הקצב תועדה אזהרה מפורשת: "אם הקצב נגזר לגמרי מהציור — האוס יפסיק להישמע כמו
 * האוס. הגרוב הוא מה שהופך האוס להאוס". זה בדיוק מה שקרה בבדיקה חיה. הביט הידני הוא
 * ההכרה בכך: **הציור קובע את המוזיקה, הביט הוא המצע שמתחתיה** — וזו גם הדרך שבה מוזיקה
 * אלקטרונית נכתבת באמת.
 *
 * ⚠️ **מבנה חדש ולא `rhythmPatterns.hits` הישן.** ההוא שומר עוצמה בלבד לכל step, בלי זהות
 * כלי, ולכן אינו מסוגל לבטא "קיק ב-1, סנר ב-2 ו-4, היי-האט בשמיניות" — כלומר אינו מסוגל
 * לבטא מקצב. עכשיו כשיש `DrumPiece` אפשר לבטא ערכה אמיתית.
 *
 * ⚠️ **היברידי לפי מבנה, לא לפי דגל.** תבנית "מחזיקה" רק את החלקים שהיא מצהירה עליהם;
 * כל חלק שלא מופיע בה ממשיך להיגזר מהציור. כך "four-on-floor" נותן שלד יציב ועדיין מאפשר
 * לקראש ולטום לבוא מהשיאים והפינות של הציור — גרוב **וגם** ייחודיות לכל יצירה. תבנית
 * שמצהירה על כל החלקים היא פשוט מקצב נקי, בלי צורך במתג נפרד.
 */

import type { DrumPiece } from './drumKit';

export interface BeatPattern {
  id: string;
  /** צעדים בבר — 16 הוא הנפוץ; 8 לגרוב איטי, 32 לגלגולים. */
  stepsPerBar: 8 | 16 | 32;
  /** עוצמה לכל צעד (0 = שקט) לכל חלק ערכה שהתבנית מחזיקה. */
  pieces: Partial<Record<DrumPiece, readonly number[]>>;
}

/**
 * הסטת-דרגה בסולם לכל חלק, כדי שגם **נפילת הסינת'** (בלי דגימות ערכה) תישמע כערכה ולא
 * כתו יחיד חוזר. דוגם-ערכה מתעלם מה-pitch לגמרי ובוחר באפר לפי החלק — ראה DrumKitProvider.
 */
export const DRUM_PIECE_DEGREE_OFFSET: Record<DrumPiece, number> = {
  kick: -5,
  tom: -3,
  snare: -1,
  clap: 0,
  'hihat-closed': 2,
  'hihat-open': 3,
  crash: 4,
};

/** החלקים שהתבנית מחזיקה — כל השאר נשארים בידי הציור. */
export function piecesOwnedByPattern(pattern: BeatPattern): Set<DrumPiece> {
  const owned = new Set<DrumPiece>();
  for (const [piece, steps] of Object.entries(pattern.pieces) as [DrumPiece, number[]][]) {
    if (steps.some((velocity) => velocity > 0)) {
      owned.add(piece);
    }
  }
  return owned;
}

export interface BeatHit {
  piece: DrumPiece;
  /** מיקום בתוך הבר, ביחידות של `stepsPerBar`. */
  step: number;
  velocity: number;
}

/** כל הפגיעות של בר אחד, ממוינות לפי זמן. */
export function beatHitsForBar(pattern: BeatPattern): BeatHit[] {
  const hits: BeatHit[] = [];
  for (const [piece, steps] of Object.entries(pattern.pieces) as [DrumPiece, number[]][]) {
    steps.forEach((velocity, step) => {
      if (velocity > 0) {
        hits.push({ piece, step, velocity });
      }
    });
  }
  return hits.sort((a, b) => a.step - b.step);
}
