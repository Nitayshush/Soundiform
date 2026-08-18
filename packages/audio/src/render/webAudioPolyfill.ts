/**
 * @file        webAudioPolyfill.ts
 * @description מזריק globalThis.window עם מחלקות node-web-audio-api, *לפני* ש-tone/
 *              standardized-audio-context נטענים בכלל.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — סדר טעינה: standardized-audio-context (שעליו tone.js מסתמך) קורא את
 * `window.OfflineAudioContext`/`window.AudioContext`/וכו' *פעם אחת בלבד*, ברמת ה-module
 * (`var window$1 = createWindow();`), בזמן ה-import הראשון שלו — לא באיחור/lazy. לכן אי
 * אפשר להזריק את הגלובלים בתוך פונקציה שנקראת מאוחר יותר (למשל בתוך renderToBuffer) — עד
 * אז tone.js כבר "נעל" את ה-null constructors שלו.
 *
 * הפתרון: קובץ זה מיובא כ-import ראשון בשני נקודות הכניסה של packages/audio — גם
 * index.ts (הנתיב הראשי) וגם serverRenderer.ts (הנתיב "./server") — כי לא ניתן להבטיח
 * איזה מהם צרכן חיצוני יטען קודם (ראה index.ts). ה-guard (`typeof window === 'undefined'`)
 * הופך את זה ל-no-op בטוח בדפדפן אמיתי, כך שכפילות ההזרקה בין שני הקבצים לא מזיקה.
 */

import * as nodeWebAudioApi from 'node-web-audio-api';

if (typeof globalThis.window === 'undefined') {
  Object.assign(globalThis, { window: { ...nodeWebAudioApi } });
}
