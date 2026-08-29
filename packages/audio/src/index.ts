/**
 * @file        index.ts
 * @description נקודת הכניסה של packages/audio.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — אל תוסיפו import './render/webAudioPolyfill' כאן! נוסה כ"הגנה כפולה" ב-Sprint 6
 * ונתגלה כבאג אמיתי ב-Sprint 7: זה קובץ הכניסה הראשי, שגם apps/web (דפדפן) מייבא דרך
 * useAudioEngine.ts. webAudioPolyfill.ts מייבא 'node-web-audio-api' (native, תלוי ב-node-fetch
 * שתלוי ב-node:net) — ה-guard (`typeof window === 'undefined'`) מונע *ריצה* בדפדפן, אבל לא
 * מונע מ-Turbopack לנסות *לבנות* (bundle) את הייבוא הזה עבור ה-chunk של הלקוח, מה שגורם
 * ל-panic אמיתי ("chunking context does not support external modules: node:net") — התגלה
 * דרך בדיקה אמיתית ב-Chrome, לא ב-typecheck/lint. הפתרון: webAudioPolyfill מיובא **רק**
 * מ-serverRenderer.ts (הנתיב "./server", שרק apps/worker נוגע בו) — וכל צרכן Node-side
 * (apps/worker) חייב לייבא '@soundiform/audio/server' *לפני* הנתיב הראשי בכל קובץ משלו
 * (ראה ההערה המקבילה ב-apps/worker/src/jobs/renderAudio.ts ו-index.ts).
 */

export * from './providers/InstrumentProvider';
export * from './providers/SynthProvider';
export * from './mixing/mixChain';
export * from './mixing/loudness';
// ⭐ 2026-08-29: מקודדי הקבצים חסינים-סביבה (Uint8Array, בלי Buffer) — גם ה-worker וגם
// הדפדפן משתמשים באותו קוד, מאז שההורדה רצה במכשיר.
export * from './encoders/wav';
export * from './encoders/midi';
export * from './render/browserRenderer';
export * from './render/offlineRenderer';
// ⭐ 2026-08-29: apps/web צריך את אורך-היצירה *לפני* שהרינדור מתחיל, כדי להעריך כמה זמן
// הרינדור-מראש ייקח ולהציג התקדמות אמיתית למשתמש (ראה useAudioEngine.ts).
export { computeDurationSeconds } from './render/sharedScheduling';
export * from './render/globalContextLock';
export * from './render/renderJob';
