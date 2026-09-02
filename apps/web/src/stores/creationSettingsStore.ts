/**
 * @file        creationSettingsStore.ts
 * @description ⭐ 2026-08-31 (סבב א'): כל ההגדרות שהמשתמש בוחר ליצירה — צלילים, מקצב וסולם —
 *              **באובייקט אחד**.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה אריזה אחת ולא שלושה stores.** `toCompositionConfig` נקרא מ-6 מקומות שונים
 * (ניגון, סרגל-התווים, שלושה מסלולי רינדור, וידאו). אם אחד מהם יקבל את הסולם ואחר לא —
 * **הלוח יציג תווים שונים ממה שמתנגן**, וזה בדיוק סוג הבאג השקט שרדפנו אחריו סבבים שלמים
 * (ראה docs/SAMPLES.md על תוויות-התווים). אובייקט אחד שעובר בכל מקום שבו עובר היום
 * soundSelections = אי אפשר לשכוח שדה.
 *
 * ⚠️ נשמר גם ב-localStorage (המשכיות בין רענונים) וגם **על הפרויקט ב-DB** — בלי השני,
 * יצירה שנפתחת במכשיר אחר מקבלת סולם וצלילים אחרים, כלומר יצירה אחרת לגמרי.
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Mode, TrackRole } from '@soundiform/core';

const STORAGE_KEY = 'soundiform:creation-settings-v1';

// ⚠️ 2026-09-01: ההגדרה עברה ל-genreAdapter (השרת צריך אותה גם), ומיוצאת מחדש כאן כדי
// שהקוראים הקיימים לא ישברו. הסמל כבר אינו ברירת המחדל — ראה resolveBeatPattern.
export { DRAWING_BEAT_ID } from '@/lib/genreAdapter';

export interface MusicalKeySelection {
  /** 0=C … 11=B. */
  rootPitchClass: number;
  mode: Mode;
}

export interface CreationSettings {
  soundSelections?: Partial<Record<TrackRole, string[]>>;
  /** מזהה מקצב מתוך GenrePack.beatPatterns, או DRAWING_BEAT_ID. */
  beatPatternId?: string;
  /** undefined = הסולם שהסגנון מגדיר. */
  key?: MusicalKeySelection;
}

interface CreationSettingsState {
  byGenre: Record<string, CreationSettings>;
  setBeatPattern: (genreId: string, beatPatternId: string) => void;
  setKey: (genreId: string, key: MusicalKeySelection) => void;
  /** מחליף את כל ההגדרות לסגנון — משמש בטעינת פרויקט שמור. */
  replaceSettings: (genreId: string, settings: CreationSettings) => void;
}

export const useCreationSettingsStore = create<CreationSettingsState>()(
  persist(
    (set) => ({
      byGenre: {},
      setBeatPattern: (genreId, beatPatternId) => {
        set((state) => ({
          byGenre: {
            ...state.byGenre,
            [genreId]: { ...state.byGenre[genreId], beatPatternId },
          },
        }));
      },
      setKey: (genreId, key) => {
        set((state) => ({
          byGenre: { ...state.byGenre, [genreId]: { ...state.byGenre[genreId], key } },
        }));
      },
      replaceSettings: (genreId, settings) => {
        set((state) => ({ byGenre: { ...state.byGenre, [genreId]: settings } }));
      },
    }),
    { name: STORAGE_KEY, storage: createJSONStorage(() => localStorage) },
  ),
);

/** קריאה נוחה מחוץ ל-React (מסלולי רינדור/שמירה) — תמיד אובייקט, לעולם לא undefined. */
export function readCreationSettings(genreId: string): CreationSettings {
  return useCreationSettingsStore.getState().byGenre[genreId] ?? {};
}
