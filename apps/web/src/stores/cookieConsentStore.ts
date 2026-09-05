/**
 * @file        cookieConsentStore.ts
 * @description ⭐ 2026-09-06: החלטת המשתמש על עוגיות/אנליטיקס — "accepted"/"declined"/null
 *              (עדיין לא הוחלט, הבאנר עדיין מוצג). persist ל-localStorage — אותה מוסכמה
 *              בדיוק כמו genreStore.ts/shapeStore.ts/soundSelectionStore.ts (אין שום דפוס
 *              קיים בקודבייס הזה של עוגיית-דפדפן אמיתית, ראה CookieConsentBanner.tsx).
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = 'soundiform:cookie-consent';

export type CookieConsentChoice = 'accepted' | 'declined' | null;

interface CookieConsentState {
  choice: CookieConsentChoice;
  setChoice: (choice: CookieConsentChoice) => void;
}

export const useCookieConsentStore = create<CookieConsentState>()(
  persist(
    (set) => ({
      choice: null,
      setChoice: (choice) => {
        set({ choice });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
