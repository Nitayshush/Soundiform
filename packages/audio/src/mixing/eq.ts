/**
 * @file        eq.ts
 * @description ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 2): EQ תלת-פס אופציונלי לפי-טראק —
 *              wrapper דק סביב Tone.EQ3, נכנס ל-mixChain.ts אחרי הפאנר ולפני ה-sends
 *              (reverb/delay משדרים את הסיגנל *אחרי* ה-EQ, כמו בשרשרת מיקס אמיתית —
 *              דינמיקה/גוון לפני אפקטי-מרחב).
 * @author      Soundiform
 * @created     2026-08-24
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { EQ3 } from 'tone';

export interface TrackEqConfig {
  lowDb: number;
  midDb: number;
  highDb: number;
}

export function createTrackEq(config: TrackEqConfig): EQ3 {
  return new EQ3(config.lowDb, config.midDb, config.highDb);
}
