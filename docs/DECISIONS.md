# DECISIONS.md — יומן החלטות (ADR)

## 2026-08-16 — Sprint 0: אתחול המונוריפו

- **החלטה:** pnpm workspaces monorepo, TypeScript strict בכל מקום, ESLint flat config (typescript-eslint strictTypeChecked).
- **החלטה:** `apps/web` נוצר עם `create-next-app` (Next.js 16.3.1 — גרסת ה-latest נכון ל-2026-08, לא 15 כפי שהופיע בטיוטה המקורית; PROJECT.md §2 עודכן בהתאם, React 19, App Router, Tailwind v4, src/).
- **החלטה:** `PROJECT.md` הועבר מהשורש ל-`docs/PROJECT.md` לפי המבנה ב-§3.
- **נדחה ל-Sprint מאוחר יותר:** חיבור בפועל ל-Supabase ו-R2 (דורש credentials של בעל הפרויקט).

## 2026-08-17 — ניתוח מתחרים ועדכון תוכנית ספרינטים

**רקע:** נסרק השוק — 4 קטגוריות: כלי ספקטרוגרמה (Photosounder, לא מתחרה אמיתי — פלט רעש
לא מלודיה), AI מבוסס-פרומפט/מצב-רוח (Mubert, Singify, Melobytes — המתחרה הישיר ביותר, אך
עובדים על "תחושה" לא גאומטריה, ולכן אין דטרמיניזם ואי אפשר לצייר), **Chrome Music Lab
Kandinsky** (Google, 2016, חינמי — כבר מממש את עקרון הליבה: סולם אחד, קוונטיזציה לגריד,
אקורדים לפי קרבה גאומטרית), וסוניק-ברנדינג B2B (Sonika AI, MusicWave.ai — קטגוריה רווחית).

**התובנה המרכזית:** Kandinsky מוכיח בחינם ש"צורה → מוזיקה קוהרנטית" כבר לא בידול מספיק
לבד. ההבחנה האמיתית של Shape-to-Sound מ-Kandinsky: Kandinsky הוא **כלי קומפוזיציה** (צורה
בודדת = צליל בודד, הרבה צורות ביחד = מלודיה שהמשתמש מרכיב). Shape-to-Sound הוא **מתרגם**
(צורה בודדת/תמונה שלמה ← → יצירה מוזיקלית שלמה ועצמאית — "תעודת זהות מוזיקלית"). הבידול
האמיתי מול Kandinsky/Mubert הוא איכות הפקה (voiceLeading, mixChain, ריבוי ז'אנרים) ולא רק
העיקרון הבסיסי.

**החלטות:**

1. **RevealOverlay שובץ במפורש ל-Sprint 5** (§11) — לא היה משובץ בשום ספרינט קודם, רק בעץ
   התיקיות (§3). זו שקיפות ("איך זה נבנה") שאין למתחרים — אך רק אחרי Sprint 4+5 (סאונד
   וז'אנרים אמיתיים), כדי לא לחשוף מיפוי גס שעוד לא נשמע מקצועי.
2. **הועלה פער: העלאת SVG/PNG לא הייתה משימה מפורשת בשום ספרינט** — נוספה ל-Sprint 2 (§11).
   Sprint 1 בנה רק ציור-יד; מסלול raster עשוי לדרוש אלגוריתם וקטוריזציה נפרד מ-SVG.
3. **נדחה במכוון:** האם להעביר B2B (§1: "חברות לוגו→סאונד") מ-V1.5 ל-V1 — הוחלט לדון בזה
   בנפרד, לא כחלק מדיון סדר הספרינטים, כי זו החלטה גדולה יותר (תמחור/ToS) שממילא תלויה
   בהשלמת Sprint 3-4 בכל מקרה.
4. **לא שונה סדר הספרינטים הכללי** — Sprint 3/4/5 (איכות מוזיקלית/סאונד/סגנונות) כבר
   קודמים ל-Sprint 8 (ויראליות) בתוכנית המקורית; זה כבר תואם את מסקנת ניתוח המתחרים.

## 2026-08-18 — Sprint 6: רינדור בשרת, encoders, BullMQ

**באג קריטי שנמצא ותוקן: הריוורב שבר את עקרון הדטרמיניזם (§1).** בדיקה אמיתית (לא מוק) גילתה
שרינדור כפול של אותו MusicalScore, באותו process, נתן PCM שונה. שורש הבעיה: `Tone.Reverb`
מייצר את ה-impulse response שלו דרך `Tone.Noise`, שמקודד ב-Tone.js עם `Math.random()` —
גם לתוכן ה-buffer (פעם ראשונה בכל process) וגם ל-offset ההתחלתי (בכל בנייה מחדש של Reverb).
מכיוון שכל סגנון אמיתי מגדיר `reverbSend>0` לפחות ל-pad, זה השפיע על *כל* רינדור, כולל
הפריוויו בדפדפן (חולק את אותו mixChain.ts). **תוקן** על ידי `packages/audio/src/mixing/
deterministicReverb.ts` — קונבולוציה (`Tone.Convolver`) עם IR שנבנה מ-`createSeededRandom`
(seed קבוע: `` `${score.seed}:${track.role}` ``), במקום Tone.Reverb. אותה החלפה גם פתרה תקלה
שנייה ולא-קשורה לכאורה: hang אקראי ב-Vitest fork pool בזמן רינדור כפול — התברר ששתי
התקלות נבעו מאותו שורש (Tone.Reverb בונה OfflineContext פנימי משלו, אסינכרוני, שמתנגש
עם setContext() חוזר על ה-context הראשי).

**באג נוסף: `DEFAULT_SYNTH_PRESET` (הפולבק לכל role שחסר ב-`GenrePack.synthMap`) היה
מונופוני**, בעוד ש-`buildPadTrack` תמיד מפיק טריאדות (כמה תווים בו-זמנית על אותו track) —
היה קורס כל רינדור של role שחסר ב-synthMap של סגנון. תוקן: `DEFAULT_SYNTH_PRESET.polyphonic
= true`.

**פער עיצוב שנמצא ותוקן: import-order fragility.** ה-polyfill ל-`globalThis.window`
(node-web-audio-api, נדרש כי standardized-audio-context קורא את הconstructor הגלובלי פעם
אחת, ברמת ה-module, בזמן ה-import הראשון של 'tone' בתהליך כולו) עבד רק אם `serverRenderer.ts`
יובא *לפני* הנתיב הראשי של `@shape-sound/audio`. כל צרכן שמייבא את הנתיב הראשי קודם
(למשל, סתם בשביל `DEFAULT_AUDIO_CONFIG`) שבר את זה בשקט. **תוקן**: ה-polyfill מיובא כעת
כ-import ראשון גם ב-`index.ts` וגם ב-`serverRenderer.ts` — guard-ed (`typeof window ===
'undefined'`) כך שזה no-op בטוח בדפדפן אמיתי.

**החלטת ארכיטקטורה: חוזה ה-job (BullMQ) חי ב-`@shape-sound/audio`, לא בחבילה חדשה.**
`RenderJobData`/`RenderJobResult`/`RENDER_QUEUE_NAME` (renderJob.ts) בנויים כולם מטיפוסים
ש-audio כבר מגדיר (`MusicalScore`, `GenreAudioConfig`) — כך ששני ה-apps (web=producer,
worker=consumer) חולקים חוזה טיפוסי בלי לתלות אחד בשני ובלי חבילה חדשה רק בשביל שני
interfaces. genreAdapter.ts (GenrePack→CompositionConfig/GenreAudioConfig) נשאר רק ב-apps/web
בכוונה: apps/web הוא היחיד שבונה את ה-score (מ-shape+genreId, לא מקבל מהקליינט —
דטרמיניזם/אבטחה), ו-apps/worker מקבל score+audioConfig מוכנים ב-payload של ה-job, בלי
לגעת ב-`@shape-sound/genres` בכלל.

**נדחה במכוון מהיקף הספרינט:** rate limiting אנונימי (§8: 3/שעה) — דורש תשתית IP-tracking
נפרדת, לא היה בתכנית המאושרת. BullMQ Queue/Worker ו-`api/render/route.ts` נכתבו במלואם אבל
לא נבדקו חי מקצה לקצה — אין Redis מקומי/Upstash זמין (הוחלט מראש). כל שאר השרשרת (Zod
validation, genre lookup, שרשור composeMusicalScore, renderToBuffer, נרמול LUFS, קידוד
WAV/MP3/MIDI אמיתי, ה-flow עד לנקודת ה-enqueue) נבדקה חי ואמיתי (dev server + curl,
Vitest עם ffmpeg/node-web-audio-api אמיתיים).
