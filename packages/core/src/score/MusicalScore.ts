/**
 * @file        MusicalScore.ts
 * @description ⭐ פורמט הביניים — הנכס האמיתי של הפרויקט. נשמר ב-DB (renders.score).
 *              כשמנוע הצליל ישתדרג, כל היצירות הישנות ירונדרו מחדש טוב יותר. ראה PROJECT.md §4.6.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { DrumPiece } from '../theory/drumKit';

export type Mode =
  'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian';

export type TrackRole = 'bass' | 'lead' | 'pad' | 'drums' | 'skank';

export type Articulation = 'staccato' | 'legato' | 'accent' | 'glissando';

/**
 * הגדרות מיקס לטראק בודד — נקבעות לפי ה-GenrePack, לא לפי הצורה (§4.5).
 */
export interface MixSettings {
  volume: number;
  pan: number;
  reverbSend: number;
  delaySend: number;
}

export interface Note {
  startTick: number;
  durationTicks: number;
  pitch: number; // MIDI
  velocity: number; // 0-1
  articulation?: Articulation;
  /**
   * ⭐ 2026-08-31: זהות כלי-ההקשה, לטראק drums בלבד — ראה theory/drumKit.ts.
   * ⚠️ אורתוגונלי ל-pitch, לא מחליף אותו: דוגם-ערכה בוחר באפר לפי השדה הזה, ואילו
   * כלי מתוח-גובה (טימפני) ונפילת-הסינת' ממשיכים להשתמש ב-pitch. אופציונלי — ציונים
   * שנשמרו ב-renders.score לפני התאריך הזה נטענים בדיוק כמו קודם.
   */
  drumPiece?: DrumPiece;
}

export interface Track {
  role: TrackRole;
  instrumentId: string;
  notes: Note[];
  mixSettings: MixSettings;
}

/**
 * קטע במבנה היצירה — intro / loop / build / outro.
 */
export interface Section {
  name: 'intro' | 'loop' | 'build' | 'outro';
  startBar: number;
  lengthBars: number;
}

export interface MusicalScore {
  version: string;
  seed: string; // hash של הצורה — דטרמיניזם
  tempo: number;
  timeSignature: [number, number];
  key: { root: number; mode: Mode };
  genreId: string;
  durationBars: number;
  /**
   * ⭐ 2026-08-31 (שכבה ד'): גריד-הקוונטיזציה שנבחר בפועל לציון הזה.
   * ⚠️ חייב להישמר בציון: validateConstitution בודק יישור-לגריד, וברירת המחדל שלו היא 16.
   * בלי השדה הזה ציון שקוונטז ל-8 או ל-32 היה נפסל כ"לא מיושר" למרות שהוא תקין לחלוטין.
   * אופציונלי — ציונים שנשמרו לפני התאריך הזה נטענים בדיוק כמו קודם.
   */
  gridSubdivision?: 8 | 16 | 32;
  tracks: Track[];
  sections: Section[];
  metadata: {
    // ⚠️ נשמר עבור V2 (וולנס) — אל תסיר
    avgNoteDensity: number;
    dominantMode: Mode;
    rootFrequencyHz: number;
  };
}
