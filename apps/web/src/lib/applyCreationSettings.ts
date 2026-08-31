/**
 * @file        applyCreationSettings.ts
 * @description ⭐ 2026-08-31 (סבב א', סגירת הפער): טוען הגדרות של יצירה שמורה בחזרה ל-stores.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה פונקציה אחת ולא קריאה לשני stores בכל מקום.** ההגדרות נשמרות כאובייקט אחד
 * (`projects.creation_settings`) אבל חיות בזמן-ריצה בשני stores: הצלילים ב-soundSelectionStore
 * (שקדם להם) והמקצב+הסולם ב-creationSettingsStore. מי שישחזר רק אחד מהם ייצור מצב שבו חצי
 * מההגדרות של היצירה חזרו והחצי השני נשאר של המשתמש — כלומר יצירה שלישית שאיש לא בחר.
 * הפיצול הזה הוא פרט-מימוש, ולכן הוא נעול כאן ולא מפוזר בקריאה.
 *
 * ⚠️ הקלט מגיע מה-DB ולכן עובר ולידציית Zod, לא הַמְרָה (§0 כלל 3) — רשומה שנכתבה ע"י
 * גרסה קודמת נופלת לברירות-המחדל במקום לשבור את הסטודיו.
 */

'use client';

import { creationSettingsSchema } from '@/lib/creationSettingsSchema';
import { useCreationSettingsStore } from '@/stores/creationSettingsStore';
import { useSoundSelectionStore } from '@/stores/soundSelectionStore';

/**
 * @returns true אם הוחלו הגדרות תקפות; false כשאין מה להחיל (יצירה שנשמרה לפני התכונה,
 *          או רשומה פגומה) — הקורא ממשיך עם ברירות-המחדל של הסגנון.
 */
export function applyCreationSettings(genreId: string, stored: unknown): boolean {
  const parsed = creationSettingsSchema.safeParse(stored ?? {});
  if (!parsed.success) {
    return false;
  }
  const { soundSelections, ...rest } = parsed.data;

  useCreationSettingsStore.getState().replaceSettings(genreId, parsed.data);
  // ⚠️ גם כשאין בחירות-צליל שמורות — מחליפים במפורש בריק, אחרת בחירות מקומיות ישנות של
  // המשתמש היו "נדבקות" ליצירה שנטענה ומשנות אותה בלי שהוא ביקש.
  useSoundSelectionStore.getState().replaceSelections(genreId, soundSelections ?? {});

  return soundSelections !== undefined || Object.keys(rest).length > 0;
}
