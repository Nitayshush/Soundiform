/**
 * @file        applyCreationSettings.test.ts
 * @description ⭐ 2026-08-31 (סבב א'): בדיקות לשחזור הגדרות של יצירה שמורה.
 *              ⚠️ הבדיקה המרכזית: **שני ה-stores** מתעדכנים יחד. ההגדרות נשמרות כאובייקט
 *              אחד אבל חיות בשניים, ושחזור חלקי היה יוצר יצירה שאיש לא בחר — חצי מההגדרות
 *              של המקור וחצי של המשתמש.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { applyCreationSettings } from './applyCreationSettings';
import { useCreationSettingsStore } from '@/stores/creationSettingsStore';
import { useSoundSelectionStore } from '@/stores/soundSelectionStore';

const GENRE = 'trance';

beforeEach(() => {
  useCreationSettingsStore.setState({ byGenre: {} });
  useSoundSelectionStore.setState({ selectionsByGenre: {} });
});

describe('applyCreationSettings', () => {
  it('משחזר מקצב וסולם ל-creationSettingsStore', () => {
    const applied = applyCreationSettings(GENRE, {
      beatPatternId: 'four-on-floor',
      key: { rootPitchClass: 6, mode: 'dorian' },
    });
    expect(applied).toBe(true);
    const settings = useCreationSettingsStore.getState().byGenre[GENRE];
    expect(settings?.beatPatternId).toBe('four-on-floor');
    expect(settings?.key).toEqual({ rootPitchClass: 6, mode: 'dorian' });
  });

  it('משחזר בחירות-צליל ל-soundSelectionStore — ה-store השני', () => {
    applyCreationSettings(GENRE, { soundSelections: { lead: ['classic-supersaw'] } });
    expect(useSoundSelectionStore.getState().selectionsByGenre[GENRE]).toEqual({
      lead: ['classic-supersaw'],
    });
  });

  it('בחירות מקומיות קודמות **נמחקות** ולא נדבקות ליצירה שנטענה', () => {
    useSoundSelectionStore.setState({ selectionsByGenre: { [GENRE]: { bass: ['reese'] } } });
    applyCreationSettings(GENRE, { key: { rootPitchClass: 0, mode: 'aeolian' } });
    expect(useSoundSelectionStore.getState().selectionsByGenre[GENRE]).toEqual({});
  });

  it('יצירה שנשמרה לפני התכונה (null) לא מפילה, ומדווחת שאין מה להחיל', () => {
    expect(applyCreationSettings(GENRE, null)).toBe(false);
  });

  it('רשומה פגומה נדחית בוולידציה ולא נכתבת ל-store', () => {
    expect(applyCreationSettings(GENRE, { key: { rootPitchClass: 99, mode: 'nope' } })).toBe(false);
    expect(useCreationSettingsStore.getState().byGenre[GENRE]).toBeUndefined();
  });

  it('שורש מחוץ לטווח 0–11 נדחה', () => {
    expect(applyCreationSettings(GENRE, { key: { rootPitchClass: -1, mode: 'aeolian' } })).toBe(
      false,
    );
  });

  it('ההגדרות מבודדות לפי סגנון — שחזור לטראנס לא נוגע בהאוס', () => {
    useCreationSettingsStore.setState({ byGenre: { house: { beatPatternId: 'deep' } } });
    applyCreationSettings(GENRE, { beatPatternId: 'rolling' });
    expect(useCreationSettingsStore.getState().byGenre.house?.beatPatternId).toBe('deep');
  });
});
