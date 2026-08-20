/**
 * @file        webAudioPolyfill.ts
 * @description מזריק globalThis.window עם מחלקות node-web-audio-api, *לפני* ש-tone/
 *              standardized-audio-context נטענים בכלל.
 * @author      Soundiform
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
 * הפתרון: קובץ זה מיובא כ-import ראשון **רק** ב-serverRenderer.ts (הנתיב "./server") —
 * ⚠️ לעולם לא מ-index.ts הראשי! נוסה שם ב-Sprint 6 כ"הגנה כפולה" ונתגלה כבאג אמיתי ב-Sprint 7
 * (Turbopack panic על node:net בבניית ה-chunk של הדפדפן, כי index.ts גם נטען דרך apps/web) —
 * ראה ההערה המקבילה ב-index.ts. במקום זה, כל צרכן Node-side (apps/worker) חייב לייבא
 * '@soundiform/audio/server' *לפני* הנתיב הראשי בכל קובץ משלו שנוגע בשניהם.
 */

import * as nodeWebAudioApi from 'node-web-audio-api';

if (typeof globalThis.window === 'undefined') {
  Object.assign(globalThis, { window: { ...nodeWebAudioApi } });
}
