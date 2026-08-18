/**
 * @file        index.ts
 * @description נקודת הכניסה של packages/audio.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קריטי — import './webAudioPolyfill' חייב להיות ה-import הראשון כאן: כל export למטה
 * (browserRenderer/mixChain/SynthProvider/...) מייבא 'tone' באופן eager, ו-standardized-
 * audio-context (ש-tone נשען עליו) קורא את window.OfflineAudioContext פעם אחת, ברמת ה-module,
 * בזמן ה-import *הראשון* של 'tone' בכל התהליך — לא משנה מאיזה קובץ. אם צרכן כלשהו מייבא את
 * הנתיב הראשי הזה *לפני* '@shape-sound/audio/server' (למשל, סתם כדי לקבל DEFAULT_AUDIO_CONFIG),
 * ה-polyfill שב-serverRenderer.ts יגיע מאוחר מדי. webAudioPolyfill.ts עצמו guard-ed
 * (`typeof window === 'undefined'`), אז זה no-op בטוח לגמרי בדפדפן אמיתי (apps/web).
 */

import './render/webAudioPolyfill';

export * from './providers/InstrumentProvider';
export * from './providers/SynthProvider';
export * from './mixing/mixChain';
export * from './mixing/loudness';
export * from './render/browserRenderer';
export * from './render/renderJob';
