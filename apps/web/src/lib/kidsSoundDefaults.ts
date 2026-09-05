/**
 * @file        kidsSoundDefaults.ts
 * @description ⭐ 2026-09-05 (Kids Studio v1, לפי בקשה חיה: "צריך לבחור ברירת מחדל של
 *              צלילים... שיהיה אהוב על רוב המשתמשים, מגניב, שעושה וואוו"): בחירת-צליל
 *              מתוקתקת לכל תפקיד בכל אחד מחמשת הז'אנרים — Kids Studio לא מרכיב את
 *              SoundSelector.tsx (מורכב מדי, ראה studio/kids/page.tsx), אז אין דרך אחרת
 *              לבחור *משהו* טוב יותר מברירת-המחדל הגולמית של החבילה.
 * @author      Soundiform
 * @created     2026-09-05
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ אלה בחירות-טעם, לא מדידה — נבחרו לפי אופי הז'אנר (כלים דגומים/אמיתיים במקומות שבהם
 * הם קיימים ומתאימים, כלי-הכר לז'אנר במקומות שבהם הסינת' *הוא* הזהות של הסגנון — למשל
 * supersaw/reese בטראנס זה לא "פחות טוב מדגימה אמיתית", זה *הצליל של הז'אנר*). ניתנות
 * לשינוי בקלות אחרי בדיקה חיה — קובץ-נתונים שטוח, לא לוגיקה.
 *
 * ⚠️ מוזרם דרך options.soundSelectionsOverride (useAudioEngine.ts/useDownload.ts) — **לא**
 * נכתב ל-useSoundSelectionStore המשותף עם Studio הרגיל, כדי לא "להדביק" את הברירה הזו
 * לבחירה של מבוגר שיפתח אותו ז'אנר ב-Studio הרגיל באותו דפדפן.
 */

import type { TrackRole } from '@soundiform/core';

export const KIDS_SOUND_DEFAULTS: Record<string, Partial<Record<TrackRole, string[]>>> = {
  // supersaw+reese הם *הזהות הסונית* של טראנס — לא "ברירת מחדל זמנית עד שנמצא דגימה אמיתית".
  trance: {
    lead: ['classic-supersaw'],
    bass: ['reese'],
    pad: ['airy-pad'],
    drums: ['electronic-kit'],
  },
  // פסנתר-האוס דגום אמיתי + בס-פאנקי גרובי — קלאסי, שמח, מיידי.
  house: {
    lead: ['grand-piano'],
    bass: ['funky-bass'],
    pad: ['disco-strings-pad'],
    drums: ['electronic-kit'],
  },
  // גיטרת-ניילון+צ'לו אמיתיים — חם ורגוע, בס פיצוץ (pizzicato) אורגני במקום סינת'.
  chill: {
    lead: ['nylon-guitar'],
    pad: ['cello-section'],
    bass: ['contrabass-pizz'],
    drums: ['acoustic-kit'],
  },
  // כינור-סולו+מיתרים דגומים = "וואו" קולנועי מיידי, טימפני אמיתי לדרמה בתופים.
  cinematic: {
    lead: ['solo-violin'],
    pad: ['violin-section'],
    bass: ['contrabass-arco'],
    drums: ['timpani'],
  },
  // גיטרת-סקאנק חשמלית דגומה (ראה הוספת הגיטרות ל-reggae) + חצוצרה = הכי "רגאיי אמיתי".
  reggae: {
    skank: ['electric-guitar'],
    lead: ['trumpet'],
    bass: ['contrabass-pizz'],
    drums: ['acoustic-kit'],
  },
};
