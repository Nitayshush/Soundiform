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
import { useCreationSettingsStore, DRAWING_BEAT_ID } from '@/stores/creationSettingsStore';

export function useCompositionOverrides(): CompositionOverrides {
  const genreId = useGenreStore((state) => state.genreId);
  const settings = useCreationSettingsStore((state) => state.byGenre[genreId]);

  return useMemo(() => {
    // ⚠️ DRAWING_BEAT_ID אינו מזהה-תבנית אמיתי — הוא הסמל ל"התופים מהציור", ולכן לא מועבר
    // הלאה בכלל. העברתו הייתה גורמת ל-toCompositionConfig לחפש תבנית שלא קיימת.
    const beatPatternId =
      settings?.beatPatternId && settings.beatPatternId !== DRAWING_BEAT_ID
        ? settings.beatPatternId
        : undefined;
    return {
      ...(beatPatternId !== undefined && { beatPatternId }),
      ...(settings?.key !== undefined && { key: settings.key }),
    };
  }, [settings]);
}
