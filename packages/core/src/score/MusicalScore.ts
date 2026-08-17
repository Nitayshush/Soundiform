/**
 * @file        MusicalScore.ts
 * @description ⭐ פורמט הביניים — הנכס האמיתי של הפרויקט. נשמר ב-DB (renders.score).
 *              כשמנוע הצליל ישתדרג, כל היצירות הישנות ירונדרו מחדש טוב יותר. ראה PROJECT.md §4.6.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

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
  tracks: Track[];
  sections: Section[];
  metadata: {
    // ⚠️ נשמר עבור V2 (וולנס) — אל תסיר
    avgNoteDensity: number;
    dominantMode: Mode;
    rootFrequencyHz: number;
  };
}
