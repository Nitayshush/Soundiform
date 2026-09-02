/**
 * @file        useCompositionOverrides.ts
 * @description ⭐ 2026-08-31 (סבב א'): ההגדרות שהמשתמש בחר, בצורה ש-`toCompositionConfig`
 *              מצפה לה. נקודת-קריאה **אחת** לכל צרכני-הלקוח.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה hook ולא קריאה ישירה ל-store בכל מקום.** לוח-התווים (useNoteBoardGrid), הניגון
 * (useAudioEngine) וסרגל-התווים (ScoreStaff) חייבים להסכים על אותו סולם **בדיוק**. אם אחד
 * מהם יקרא את ה-store אחרת — הלוח יראה תווים שונים ממה שמתנגן, וזה כשל שקט שרק המשתמש
 * שומע. גזירה אחת משותפת מונעת את הסטייה מראש.
 */

'use client';

import { useMemo } from 'react';
import type { CompositionOverrides } from '@/lib/genreAdapter';
import { useGenreStore } from '@/stores/genreStore';
import { useCreationSettingsStore } from '@/stores/creationSettingsStore';

export function useCompositionOverrides(): CompositionOverrides {
  const genreId = useGenreStore((state) => state.genreId);
  const settings = useCreationSettingsStore((state) => state.byGenre[genreId]);

  return useMemo(() => {
    // ⚠️ 2026-09-01: הסמל **כן** מועבר הלאה עכשיו. מאז שברירת המחדל היא הביט של הסגנון,
    // "אין ערך" ו"המשתמש בחר מהציור" הם שני מצבים שונים, ובליעת הסמל כאן הייתה מוחקת את
    // הבחירה של המשתמש. resolveBeatPattern הוא זה שמפרש אותו.
    const beatPatternId = settings?.beatPatternId;
    return {
      ...(beatPatternId !== undefined && { beatPatternId }),
      ...(settings?.key !== undefined && { key: settings.key }),
    };
  }, [settings]);
}
