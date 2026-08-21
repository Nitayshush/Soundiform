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
לבד. ההבחנה האמיתית של Soundiform מ-Kandinsky: Kandinsky הוא **כלי קומפוזיציה** (צורה
בודדת = צליל בודד, הרבה צורות ביחד = מלודיה שהמשתמש מרכיב). Soundiform הוא **מתרגם**
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
מכיוון שכל סגנון אמיתי מגדיר `reverbSend>0` לפחות ל-pad, זה השפיע על _כל_ רינדור, כולל
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
יובא _לפני_ הנתיב הראשי של `@soundiform/audio`. כל צרכן שמייבא את הנתיב הראשי קודם
(למשל, סתם בשביל `DEFAULT_AUDIO_CONFIG`) שבר את זה בשקט. **התיקון המקורי כאן (הוספת
ה-polyfill כ-import ראשון גם ל-`index.ts` הראשי) התברר כשגוי — ראה תיקון ב-Sprint 7.**

**החלטת ארכיטקטורה: חוזה ה-job (BullMQ) חי ב-`@soundiform/audio`, לא בחבילה חדשה.**
`RenderJobData`/`RenderJobResult`/`RENDER_QUEUE_NAME` (renderJob.ts) בנויים כולם מטיפוסים
ש-audio כבר מגדיר (`MusicalScore`, `GenreAudioConfig`) — כך ששני ה-apps (web=producer,
worker=consumer) חולקים חוזה טיפוסי בלי לתלות אחד בשני ובלי חבילה חדשה רק בשביל שני
interfaces. genreAdapter.ts (GenrePack→CompositionConfig/GenreAudioConfig) נשאר רק ב-apps/web
בכוונה: apps/web הוא היחיד שבונה את ה-score (מ-shape+genreId, לא מקבל מהקליינט —
דטרמיניזם/אבטחה), ו-apps/worker מקבל score+audioConfig מוכנים ב-payload של ה-job, בלי
לגעת ב-`@soundiform/genres` בכלל.

**נדחה במכוון מהיקף הספרינט:** rate limiting אנונימי (§8: 3/שעה) — דורש תשתית IP-tracking
נפרדת, לא היה בתכנית המאושרת. BullMQ Queue/Worker ו-`api/render/route.ts` נכתבו במלואם אבל
לא נבדקו חי מקצה לקצה — אין Redis מקומי/Upstash זמין (הוחלט מראש). כל שאר השרשרת (Zod
validation, genre lookup, שרשור composeMusicalScore, renderToBuffer, נרמול LUFS, קידוד
WAV/MP3/MIDI אמיתי, ה-flow עד לנקודת ה-enqueue) נבדקה חי ואמיתי (dev server + curl,
Vitest עם ffmpeg/node-web-audio-api אמיתיים).

## 2026-08-19 — Sprint 7: חשבונות (Auth, DB אמיתי, מכסות)

**לראשונה יש credentials אמיתיים של Supabase** — הספרינט הזה נבדק חי מקצה לקצה מול DB
אמיתי (Postgres 17.6), לא רק נכתב. כל התוצאות למטה מאומתות ישירות מול הפרויקט האמיתי,
לא הנחות.

**סכימה (`packages/db`):** רק מה ש-Sprint 7 צריך בפועל — `users`/`projects`/`renders`/
`credits_ledger` (§6), לא כל הסכימה (shares/remixes/likes/genre_packs/moderation_queue/
audit_log/feature_flags נדחו ל-Sprint 8-9, לפי בחירת Nitay). RLS אמיתי על כל טבלה (רק
SELECT-על-שורה-עצמית מהקליינט — אין INSERT/UPDATE policy בכוונה: כל כתיבה עוברת שרת
(Drizzle, מחובר כ-`postgres` owner role — עוקף RLS במכוון, זה הצד המורשה) כדי לאכוף מכסות
שלא ניתן לבטא ב-row-ownership בלבד). `users` מסתנכרן מ-`auth.users` הפנימית של Supabase
דרך trigger (`0001_auth_user_sync.sql`, migration ידני — DDL על `auth.*` לא מבוטא ב-Drizzle
schema DSL). RLS **אומת חי**: משתמש נפרד שאילת `/rest/v1/projects` בלי פילטר קיבל `[]` למרות
7+ שורות בטבלה מבעלים אחרים.

**באג תשתית אמיתי #1: Supabase דרש אימות מייל כברירת מחדל**, מה ששבר את זרימת "היצירה
עוברת אוטומטית לחשבון" (§9, קריטי) לנרשמים באימייל+סיסמה — `signUp()` לא מחזיר session
עד אישור מייל בפועל. Google OAuth לא מושפע (Google כבר מאמת). **תוקן** ידנית בדשבורד
(Authentication → Providers → Email → "Confirm email" כבוי) — אומת ישירות מול ה-Auth API
(POST /auth/v1/signup, לפני ואחרי: ללא/עם access_token מיידי).

**באג תשתית אמיתי #2: Next.js 16 שינה `middleware.ts`→`proxy.ts`** (וגם שם הפונקציה,
`middleware`→`proxy`) — `middleware.ts` שנכתב תחילה עבד אבל עם אזהרת deprecation; זוהה
ותוקן מיד (per AGENTS.md: "heed deprecation notices"). ה-docs המדויקים ל-Next.js הזו
(שאינה זו שב-training data) חיים ב-`node_modules/next/dist/docs/`.

**באג ארכיטקטורה אמיתי #3 (הכי משמעותי): "תיקון" ה-Sprint 6 ל-import-order fragility
שבר את bundle הדפדפן.** הוספת `import './render/webAudioPolyfill'` ל-`index.ts` הראשי של
`@soundiform/audio` (כדי להגן על apps/worker גם אם מישהו מייבא את הנתיב הראשי לפני
"./server") — נראתה בטוחה כי guard-ed ב-`typeof window === 'undefined'`. אבל ה-guard מגן
רק על _ריצה_, לא על _bundling_: Turbopack עדיין מנסה לבנות chunk לדפדפן שמכיל את הענף
"המת" הזה, ומ-`node-web-audio-api` (תלוי ב-`node-fetch`) זה מגיע ל-`node:net` — panic אמיתי
("chunking context does not support external modules"). **התגלה רק דרך בדיקה אמיתית ב-Chrome
(Playwright)** — `/studio` קרס עם 500, כל שאר הבדיקות (typecheck/lint/vitest) עברו נקי לאורך
כל Sprint 6 כי אף אחת מהן בונה bundle-לקוח אמיתי. **תוקן**: `webAudioPolyfill` חזר להיות
מיובא רק מ-`serverRenderer.ts` (הנתיב "./server", אף פעם לא נגיש מדפדפן); ההגנה על
apps/worker במקום זאת: סדר imports מפורש בכל קובץ (`renderAudio.ts`/`renderAudio.test.ts`/
`renderQueue.ts` — "./server" _לפני_ הנתיב הראשי, עם הערה מתועדת בכל אחד) + הגנת-יתר
ב-`apps/worker/src/index.ts` (נקודת הכניסה האמיתית של התהליך) שמייבאת "./server" כ-import
ראשון בלי תנאי. **לקח לזכור**: guard מבוסס `typeof window` מגן על ריצה, לא על bundling —
לחבילה עם קהל-יעד כפול (דפדפן+Node) אסור לייבא תלות Node-only בנתיב הכניסה שגם דפדפן נוגע
בו, גם אם ה-import מוגן ב-runtime.

**זרימה קריטית (§9) נבדקה E2E אמיתי (Playwright, לא מוק):** ציור צורה כאנונימי → לחיצה על
"שמור" → redirect ל-`/login?next=/studio?autoSave=1` → הרשמה אמיתית → redirect חזרה →
שמירה אוטומטית מתבצעת לבד (ללא פעולה נוספת של המשתמש) → אומת ב-DB: הפרויקט קיים עם
shape_hash תואם, user_id נכון, ורשומת credits_ledger (`delta=-1, reason='project_save'`)
נוצרה. מכסת 5 שמורות (חינם) **נבדקה חי**: 5 שמירות → 201, שישית → 403 עם
`{allowed:false, current:5, limit:5}`.

**החלטת ארכיטקטורה: כתיבה תמיד דרך שרת, קריאה דרך RLS.** ה-API route (`api/projects`)
משתמש ב-Drizzle (עוקף RLS, "privileged side") לכתיבה — כי אכיפת מכסה לא ניתנת לביטוי
כ-row-ownership policy. קריאות (עמוד חשבון) גם עוברות Drizzle server-side כרגע (לא ישירות
מהקליינט) — RLS נשאר קו הגנה שני מתועד, לא הנתיב היחיד שנבדק. `apps/web/.env.local` הוא
**hard link** ל-`.env` בשורש (לא symlink — נדרשת הרשאת admin ב-Windows) כי Next.js טוען env
רק מהתיקייה של האפליקציה עצמה, לא משורש המונוריפו; מכוסה כבר ב-`.gitignore` (`.env.local`).

## 2026-08-19 — Sprint 8: ויראליות (שיתוף, גלריה, Remix, וידאו)

**פער אמיתי שנחשף: אף קוד לא כתב שורת `renders` ל-DB.** Sprint 6/7 העלו קבצי אודיו ל-R2
אבל אף פעם לא שמרו רשומת `renders` — כי שיתוף חייב לאתר ID אמיתי, זה חייב תיקון לפני שאר
Sprint 8. **תוקן**: `RenderJobData` קיבל `projectId` חובה (§9 — אי אפשר לשתף יצירה
לא-שמורה), ו-`runRenderAudioJob` (apps/worker) כותב שורת renders אמיתית אחרי ההעלאה. גרר
שינוי נלווה: `api/render/route.ts` עבר מ"כל אחד יכול לרנדר צורה גולמית" ל"חייב להתחבר +
לשמור פרויקט קודם" — עקבי עם עקרון §9 שקיבל תוקף מלא רק עכשיו.

**איכות/watermark של וידאו נקבעים בשרת לפי plan, לא מבחירת הקליינט** (§0.3) — הקליינט בוחר
רק aspectRatio (עיצוב, לא הרשאה). `PLAN_VIDEO_QUALITY`/`PLAN_VIDEO_WATERMARK` ב-api/render
ממפים free→720p+watermark, pro→1080p, studio→4k נקי, בדיוק לפי טבלת §9.

**וידאו: ארכיטקטורה חדשה לגמרי, `@napi-rs/canvas` (Skia native) + ffmpeg.** כל פריים
מצויר בנפרד (קווי הצורה + נקודה נעה על הקונטור) ונשמר ל-PNG בתיקיית temp; ffmpeg ממזג את
רצף הפריימים עם ה-WAV שכבר קיים (לא מרנדר אודיו פעמיים) ל-MP4 עם ffprobe מוודא
רזולוציה/משך/streams בפועל. **מוסכמת רזולוציה**: "1080p" ל-9:16 = width=1080 (הצלע הקצרה),
לא height — מוסכמת הווידאו-האנכי הנפוצה (Reels/TikTok), לא "1080 גובה" הרגיל של 16:9.
**קריטי ל"פריוויו ≈ פלט סופי" גם בוידאו**: צבעי הקו/נקודה ומיקום הנקודה על הקונטור
(`index = floor(progress * points.length)`) זהים בכוונה ל-`DrawingCanvas.tsx`/`Playhead.tsx`.

**Vitest, בניגוד ל-Next.js dev server, לא טוען `.env`/`.env.local` אוטומטית ל-`process.env`.**
נתגלה כש-`renderAudio.test.ts` (שעכשיו כותב renders row אמיתי) קיבל `DATABASE_URL=undefined`
בשקט. תוקן ב-`apps/worker/vitest.config.ts` עם `loadEnv` מ-`vite` (דורש `vite` כ-devDependency
מפורש — pnpm strict לא פותר אותו רק כי vitest תלוי בו טרנזיטיבית). אותו hard-link
`.env.local`→`.env` נדרש גם ב-`apps/worker` (לא רק apps/web, ראה Sprint 7).

**בדיקות אינטגרציה שכותבות ל-DB אמיתי מנקות אחרי עצמן** (setup ב-`it()`, `finally` מוחק) —
בניגוד לבדיקות ה-E2E האינטראקטיביות (Playwright, ריצה ידנית בסשן) שהמוצא שלהן נוקה ידנית
בסוף הסשן, לא אוטומטית בכל הרצה.

**נבדק חי לגמרי, מקצה לקצה (Playwright + שאילתות DB ישירות):** דף שיתוף עם נגינה אמיתית של
score שמור; תמונת OG שהיא ממש הצורה שצוירה (אומת חזותית — משולש אמיתי, לא placeholder);
Remix מ-דף שיתוף → טעינת הצורה ל-`shapeStore` → מוצג על קנבס ה-studio בפועל → שמירה →
שורת `remixes` נוצרה ב-DB עם parent/child נכונים; גלריה מציגה שיתופים ציבוריים אמיתיים.
צינור הרינדור המשולב (אודיו+וידאו+כתיבת DB) נבדק ביחידה (Vitest, ffprobe אמיתי על הפלט).
**נשאר לא נבדק**: BullMQ/Redis חי (כמו קודם, אין Redis מקומי) — כל השרשרת שמעליו (compose,
quota, video-options-by-plan) נבדקה עד לנקודת ה-enqueue.

## 2026-08-20 — Google OAuth הוגדר ואומת; הפרויקט שונה שם ל-Soundiform

**Google OAuth הוגדר ואומת חי.** Nitay הגדיר OAuth client ב-Google Cloud Console + Google
provider ב-Supabase, והוסיף `http://localhost:3210/**` לרשימת redirect URLs המותרת
(נדרש ל-dev מקומי — Supabase בודק את `redirectTo` מול allow-list). אומת דרך Playwright:
לחיצה על "המשך עם Google" מגיעה בפועל ל-`accounts.google.com` עם `client_id`/`redirect_uri`/
`scope` נכונים. השלמת login בפועל לא הופעלה אוטומטית (דורשת חשבון Google אמיתי) — לא
הגיוני/ראוי לנסות לאוטומט התחברות לחשבון אישי אמיתי של המשתמש.

**שינוי שם: Shape-to-Sound → Soundiform, דומיין soundiform.com.** Nitay רכש את הדומיין
ובחר שם קבוע. שינוי מכני אבל רחב-היקף — 140 קבצים נגעו במחרוזת `shape-sound`/`Shape-to-Sound`
(בעיקר header comment `@author` שחוזר בכל קובץ, וה-scope של ה-packages). בוצע:

- **npm workspace scope**: `@shape-sound/*` → `@soundiform/*` בכל package.json (name +
  dependencies) ובכל import statement — כולל `next.config.ts`'s `transpilePackages`/
  `serverExternalPackages` (מחרוזות literal, לא רק import-ים).
- **package.json ראשי**: `"name": "shape-sound"` → `"soundiform"`.
- **`pnpm-lock.yaml`**: נוצר מחדש (`pnpm install`) — **לא** נערך ידנית. אומת: node_modules
  symlinks נפתרים תחת `@soundiform/*`, אין שאריות `@shape-sound/*`.
- **מיתוג**: README.md, כותרת PROJECT.md (+ נוספה שורת "דומיין: soundiform.com"), ו-
  `apps/web/src/app/layout.tsx`'s metadata (`title`/`description`, שהיו עדיין ברירת המחדל
  הגולמית של create-next-app — "Create Next App" — מעולם לא הוחלפו מ-Sprint 0; זו הזדמנות
  לתקן גם את זה, לא רק את השם).
- **⚠️ לא שונה**: שם/הגדרות הפרויקט עצמו בדשבורד Supabase (project ref `oykpoyvwbdyqkiseuqyx`
  ומה שמוצג שם) — רק ההתייחסויות בקוד. שם התיקייה המקומית (`GeometricSound`) גם לא שונה —
  זה path פיתוח מקומי, לא user-facing.

**נבדק אחרי השינוי**: typecheck/lint/test מלאים על כל המונוריפו (נקיים, 107 בדיקות), ו-
בדיקת דפדפן אמיתית ל-`/studio` (הדף שהיה שביר במיוחד ל-regressions מסוג bundling ב-Sprint 7)
— טעינה תקינה, `<title>Soundiform</title>` מאומת ב-HTML בפועל.

## 2026-08-20 — Sprint 9: אדמין, מודרציה, GenrePacks חיים מה-DB, שרשרת העלאה מלאה

**GenrePacks חיים מה-DB.** `GET /api/genres` (ציבורי, is_active בלבד) → `genrePacksStore`
(Zustand, נטען פעם אחת) → `GenreSelector`/`useAudioEngine` (client) ו-`api/render/route.ts`
(server, Drizzle ישיר) — כל הצרכנים הוסטו מ-`@soundiform/genres` הסטטי לשורות `genre_packs`.
`useAudioEngine.play()` קורא ל-`genrePacksStore.getState()` (לא ה-hook) כי `play()` הוא
callback לא-רי-אקטיבי — מתועד בקובץ. `usePlayScore.ts` (דף שיתוף) **נשאר** על הטעינה
הסטטית בכוונה — לא היה חלק מהתחום שאושר, ונשאר עקבי-לעצמו (score כבר-מוכן, לא מורכב מחדש).

**שרשרת העלאה מלאה (SVG/PNG/JPEG/WebP → ShapeData), §8.** `POST /api/upload`: גודל (10MB)
→ magic bytes (`file-type`; ל-SVG אין magic bytes אמיתיים — היוריסטיקת-תוכן נפרדת) → SVG:
DOMPurify (jsdom, שרת-בלבד) + svgo → פירסור path-data (`svg-pathdata`, aToC/qtToC ממירים
קשתות/quadratic ל-cubic כדי שיהיה רק סוג עקומה אחד לשטח) → נרמול 0–1 עם **שימור aspect-ratio**
(fit-to-square ממורכז — בניגוד ל-DrawingCanvas שמנרמל כל ציר בנפרד, כי שם הקנבס כמעט תמיד
ריבועי; ל-SVG/לוגו זה לא תמיד נכון, ונרמול-עצמאי היה מעוות צורות). raster: sharp re-encode
(מסיר EXIF/payloads) → **potrace** (מעקב-קונטור אמיתי, כמו Inkscape) → אותו path-parsing.

- **החלטה (בשיתוף עם Nitay):** וקטוריזציית raster דרך potrace אמיתי (לא נדחה לספרינט אחר,
  לא היוריסטיקת edge-detection פשוטה) — PROJECT.md §11 עצמו סימן את זה כשאלה פתוחה ליד
  Sprint 2. `potrace` תלוי ב-`jimp` (טהור-JS, בלי native bindings).
- **קובץ מקור נשמר ב-R2** (`uploads/{userId|anon}/{id}.{ext}`) — עמודה חדשה `projects.upload_key`
  (מיגרציה `0004_hot_gorilla_man.sql`, אדיטיבית, יושמה חי). שורת `moderation_queue` נוצרת
  ב-`api/projects/route.ts` (לא ב-`api/upload`) כי יש לה `project_id NOT NULL` שעדיין לא
  קיים בזמן ההעלאה עצמה.
- **נבדק אמיתי:** 45 בדיקות Vitest חדשות (לא mocked) — כולל payloads XSS אמיתיים
  (`<script>`, `onload=`, `javascript:` href, `<foreignObject>`, `<use>` חיצוני) שמאומת
  שנחסמים בפועל ע"י DOMPurify; PNG/JPEG אמיתיים (sharp) מול `file-type`; תמונת ריבוע שחור
  אמיתית → potrace → ShapeData מרובע ותקין; אימות הסרת EXIF אמיתי. **בדיקת דפדפן אמיתית**
  (Playwright, `/studio`, קובץ SVG אמיתי דרך `<input type=file>`): הצינור המלא (זיהוי→סניטציה→
  וקטוריזציה→Zod) עובד עד לשלב ה-R2 PUT; שם נכשל כי **R2 מעולם לא הוגדר בפועל בסביבה הזו**
  (כל 5 משתני `R2_*` ב-`.env` קיימים כמפתחות אך ריקים — לא רק בסשן הזה; גם בדיקות ה-worker
  ל-render, מ-Sprint 6/8, תמיד השתמשו ב-`StorageProvider` מזויף בזיכרון מאותה סיבה בדיוק).
  אומת שה-UI מציג שגיאה גנרית נקייה בלי לחשוף פרטים פנימיים (§0.3/§8).

**פאנל אדמין.** `ADMIN_EMAILS` (allowlist מקודד ב-env, לא עמודת `is_admin`ב-DB — הוחלט מראש)
נבדק דרך `getAdminUser()` גם ב-Server Component (`admin/page.tsx`, `redirect()` לפני שהדף
בכלל נרנדר) וגם בכל `api/admin/*` route בנפרד. ארבעה טאבים: מודרציה (אישור/דחייה, כותב
audit_log), Feature Flags (טוגלים גלובליים — **לא** להפעלה/כיבוי סגנון, זה כבר מכוסה ע"י
`genre_packs.is_active`), GenrePacks (עריכת config/is_active/sort_order ללא דיפלוי — §11
Sprint 9 "פריט מרכזי"), Audit Log (צפייה בלבד, append-only). **נבדק אמיתי (Playwright):**
כניסה אנונימית ל-`/admin` מבצעת redirect אמיתי (307) ל-`/login?next=/admin` ואף פעם לא
מרנדרת את הדשבורד עצמו. **נשאר לא נבדק:** גישת אדמין אמיתית (דורשת `ADMIN_EMAILS` מאוכלס +
חשבון מחובר אמיתי — לא הוגדר בסביבה הזו; Nitay צריך למלא את `ADMIN_EMAILS` ב-`.env` בעצמו).

**נבדק אחרי הכל:** typecheck/lint/format/test מלאים על כל המונוריפו — נקיים, 152 בדיקות
(45 חדשות + 107 קודמות), כולל בדיקות worker אמיתיות מול ffmpeg אמיתי.

## 2026-08-20 — R2 + Redis הוגדרו בפועל; שרשרת render→save→share אומתה חי בפעם הראשונה

Nitay פתח חשבון Cloudflare (R2 bucket `soundiform`, Standard storage class) וחשבון Upstash
(Redis, Regional) והזין את הקרדנציאלים ב-`.env`. זו הפעם הראשונה בפרויקט כולו שהתור
(BullMQ/Redis) וה-worker הופעלו כתהליך חי אמיתי — עד עכשיו זה היה כתוב ונבדק רק ביחידה מול
`StorageProvider`/Redis מזויפים (§11 Sprint 6/8: "אין Redis מקומי זמין" חזר בכל ספרינט).

**שני באגים אמיתיים, לא-היפותטיים, נתפסו ותוקנו רק דרך ההרצה החיה הזו (לא typecheck/lint):**

1. **`apps/web/.env.local` / `apps/worker/.env.local` / `packages/db/.env` (hard links לשורש
   `.env`) נשברים בכל עריכה של `.env` דרך כלי העריכה** — ה-write מחליף את הקובץ (inode חדש)
   במקום לערוך במקום, מה שמנתק hard link. זה גרם לבאג אמיתי ומבלבל: Google OAuth הצליח,
   אבל `/admin` המשיך להפנות ל-login כי `getAdminUser()` קרא עותק ישן-לא-מעודכן של
   `apps/web/.env.local` בלי `ADMIN_EMAILS`. **תיקון:** לבדוק inode אחרי כל עריכת `.env`
   ו-relink+restart dev server אם נשבר — נשמר כזיכרון קבוע (לא רק ל-session הזה).
2. **`apps/worker`'s `pnpm dev` (`tsx watch src/index.ts`) מעולם לא טען `.env` בפועל** —
   בניגוד ל-Next.js, ל-tsx אין טעינת env אוטומטית. ניסיון ראשון עם `tsx watch --env-file=...`
   נראה כמו פתרון אבל ה-flag לא שורד את ה-respawn הפנימי של watch mode על שינוי קובץ (worker
   קרס על `REDIS_URL` חסר אחרי rerun ראשון). **תוקן נכון**: `process.loadEnvFile('.env.local')`
   בקוד עצמו (Node native API, לא CLI flag) — שורד restarts כי הוא חלק מהריצה עצמה.
3. **תופעת-לוואי שנתפסה תוך כדי**: `renderWorker.on('failed', (job, error) => server.log.error({error}, ...))`
   בלע את השגיאה האמיתית בשקט — pino מפעיל serializer ל-Error רק עבור מפתח בשם `err` בדיוק,
   לא `error`, אז השגיאה נדפסה כ-`{}`. תוקן ל-`err`. בלעדיו, הבאג הבא (ffmpeg לא ב-PATH,
   סביבתי-בלבד לסשן הזה) היה נשאר לא-מוסבר.

**נבדק חי, מקצה-לקצה, בפעם הראשונה בפרויקט:** `enqueueRenderJob` אמיתי (לא מוק) → BullMQ
Worker קלט job → `runRenderAudioJob` רינדר WAV+MIDI אמיתיים → הועלו ל-R2 האמיתי (מאומת
`headObject`) → שורת `renders` נכתבה עם `status='completed'` → שורת `shares` נוצרה → דף
`/s/[slug]` נטען בדפדפן אמיתי (Playwright), ניגן בפועל (מד הזמן התקדם 2.4s/2.7s), אפס שגיאות
קונסולה. גם בדיקת R2 עצמאית (PUT→headObject→GET עם התאמת בייטים→DELETE→אימות היעלמות) רצה
נקי מול ה-bucket האמיתי.

## 2026-08-20 — מיתוג + עיצוב מלא + תיקון נאמנות-ציור + מנוע אודיו/ויזואליזציה חדשים

Nitay שלח לוגו חדש (משולש+עמודות עולות+wordmark דו-גוני) וביקש ארבעה דברים בבת אחת: הטמעת
הלוגו בכל האתר, עיצוב מחדש מלא ("נורא מיושן, משעמם"), תיקון באג בציור (הקו "משתנה"), ותפיסה
חדשה לניגון — סרגל תווים סורק משמאל לימין במקום נקודה שרצה על הצורה, ותזמורת "מלאה" יותר.
בהיקף כזה (נוגע כמעט בכל קובץ + בליבה הקניינית) — נכנסתי ל-Plan Mode, שאלתי שתי שאלות
הבהרה (עומק העיצוב: הכל בבת אחת; "תזמורת": שיפור הסינתזה הקיימת, לא דגימות אמיתיות — פאזה
עתידית נפרדת), ורק אז ביצעתי, בארבעה commits נפרדים לפי סדר סיכון עולה.

**1. באג נאמנות-ציור (תוקן, root cause אמיתי):** `useShapeCapture.ts`'s `SIMPLIFY_TOLERANCE=0.003`
היה גבוה מדי בפועל — `paper.js Path.simplify()` הוא curve-fit של Schneider (least-squares
Bézier), לא סינון-רעש, וב-tolerance הזה הוא היה מיישר פינות אמיתיות. הורד ל-0.0007. **נבדק
חי:** זיגזג עם 6 פינות חדות צויר בדפדפן אמיתי (Playwright) — כל 6 הפינות חזרו ב-0px סטייה,
בעוד נקודות-הרעש לאורך הקווים הישרים כן נמחקו.

**2. מיתוג + עיצוב מלא:** הלוגו לא היה קובץ שאפשר לקרוא מדיסק (הודבק בצ'אט) — נבנה מחדש
כ-SVG component (`Logo.tsx`, `icon.svg` ל-favicon). פלטת מותג כהה חדשה (אינדיגו/סגול, נגזרת
מהלוגו) ב-`globals.css`, **קבועה — אין UI toggle** (זו זהות ויזואלית, לא מצב). נבנה
Header/Nav ראשון-אי-פעם. שימוש ב-shadcn CLI הקיים (`components.json` כבר היה מוגדר) להוסיף
Card/Input/Badge/Separator תואמי-Button-הקיים, ועיצוב מחדש של **כל** עמוד. שני באגים אמיתיים
נתפסו רק דרך בדיקה חיה: (א) `DrawingCanvas`'s `STROKE_COLOR='#111827'` (כמעט-שחור) היה נהיה
בלתי-נראה על הרקע הכהה החדש — תוקן ללבן; (ב) `base-ui`'s Button זורק אזהרת נגישות כש-render
כ-`<Link>` בלי `nativeButton={false}` — תוקן בכל המקומות.

**3. מנוע אודיו — תופים + סינתזה עשירה יותר:** כל GenrePack כבר הגדיר `rhythmPatterns.drums`
אמיתי ומובחן-לסגנון (למשל trance: "four-on-floor" צפוף, cinematic: "timpani-hits" דליל) אבל
`harmonyEngine.ts`'s `composeMusicalScore` מעולם לא בנה טראק drums בפועל (תועד כ"לא נצרך
ב-V1" ב-`packages/genres/src/schema.ts` מ-Sprint 5) — כל סגנון היה מנגן בלי הרכיב הכי-מבחין
מבחינה תופית. נוסף `buildDrumsTrack`, מחובר דרך `CompositionConfig.drumsPattern` (מ-
`genreAdapter.ts`). גם הוחלפו קולות ה-synth ל-Tone.js "fat" oscillators (unison
3-קולות-מוסטים, טריק עיצוב-סאונד סטנדרטי, בלי תלות חדשה) ל-גוון "גדול" יותר. **נבדק חי:**
רינדור אמיתי (job דרך BullMQ → worker → R2) של אותה צורה בשני סגנונות (trance/cinematic) —
שניהם עכשיו מפיקים 4 טראקים כולל drums, עם מספר-פגיעות וטמפו שונים כצפוי (138bpm/4 פגיעות
מול 90bpm/2). קבצי WAV הושארו ב-`.tmp-audio-preview/` (לא ב-git) להאזנה ישירה.

**4. ScoreStaff — ויזואליזציית ניגון חדשה:** `Playhead.tsx` (נקודה שרצה על קו הצורה שצוירה)
הוחלף ב-`ScoreStaff.tsx` — מציג את ה-`MusicalScore` שכבר חושב כ-piano-roll (X=זמן,
Y=pitch, בר-צבע-לפי-role לכל תו), עם קו סורק שנע משמאל לימין בזמן ניגון אמיתי. זו לא מיפוי
חדש — `geometryToMusic` כבר ממפה X-של-הצורה→זמן ו-Y→pitch (§4.2); ה-staff _הוא_ אותה מיפוי,
מוצג ליניארית במקום לאורך קו הצורה המקורי. כמו `RevealOverlay`, מחשב score עצמאית (לא תלוי
ב-`useAudioEngine`) — כך שהוא נראה גם _לפני_ לחיצה על play. תיקון-לוואי קטן: drums ו-bass
שיתפו בטעות את אותו `DEGREE_OFFSET` (-7), מה שיצר חפיפה חזותית בסרגל למרות ששניהם מתנגנים
בנפרד לגמרי — drums הוזז ל--5. **נבדק חי:** ציור אמיתי → בָּרים מוצגים מיד (4 גבהים שונים,
לפני play) → play → קו הסריקה עוקב במדויק אחרי currentSeconds/durationSeconds, אפס שגיאות
קונסולה.

**נבדק אחרי הכל:** typecheck/lint/format/test מלאים על כל המונוריפו, שוב ושוב אחרי כל
commit — נקיים כל פעם, 152 בדיקות.

## 2026-08-21 — לוגו מקורי (קבצי SVG אמיתיים) + רקע לבן לסרגל התווים

Nitay שלח את קבצי ה-SVG המקוריים של הלוגו (`logo-icon.svg`, `logo-notagline-dark-v3.svg`,
`logo-notagline-light-v3.svg`) — לא היה צריך יותר לשחזר בניחוש. גם דיווח על באג ויזואלי:
"האיקון זז והמשולש עולה על הקווים" בלוגו ששוחזר, וביקש שרקע סרגל-התווים יהיה לבן (ה-header
נשאר כהה).

**`Logo.tsx` נבנה מחדש כ-SVG בודד לכל וריאנט**, לא הרכבת flex+SVG נפרד כמו קודם — זה בדיוק
מה שגרם לבאג ה"איקון זז": ה-lockup המקורי (איקון+wordmark) תוכנן כ-SVG יחיד עם קואורדינטות
יחסיות מדויקות בין המשולש/העמודות/הטקסט; הרכבה מחדש שלו כ-HTML flex עם יישור-`items-center`
לא שומרת על אותו יחס מדויק. עכשיו `Logo`/`LogoMark` מטמיעים את תוכן ה-SVG שסופק (וריאנט כהה
— light-on-dark — כי כל שימוש היום הוא על רקע כהה) ישירות, ללא שינוי גיאומטריה/צבעים.
`--background` ב-`globals.css` עודכן ל-`#211B4A` המדויק מתוך קובץ הלוגו (היה קירוב, `#1c1640`).

**רקע לבן לסרגל התווים:** `studio/page.tsx`'s canvas wrapper קיבל `bg-white text-[#211B4A]`
במקום `bg-background` הכהה (ה-`header` לא נגע). זה חייב תיאום-צבעים במורד הזרם: `currentColor`
של `MusicalGrid` (עכשיו כהה-על-לבן דרך ה-`text-[#211B4A]` על ה-wrapper), `DrawingCanvas`'s
`STROKE_COLOR`/`ACTIVE_STROKE_COLOR` (כהים עכשיו, לא בהירים-על-כהה כמו כשהיה רקע כהה), ו-
`ScoreStaff`'s `SCAN_LINE_COLOR` (כהה) ו-`ROLE_COLORS.drums` (היה `#f5f3fc` — כמעט-לבן, היה
נעלם לגמרי על רקע לבן! הוחלף לאדום-פטל `#e11d48`, שונה מכל צבע אחר בסרגל).

**נבדק חי:** דף login מציג את הלוגו המדויק (איקון+wordmark מיושרים, אין חפיפה/הזזה); Studio
מציג קנבס לבן עם קו-ציור כהה קריא וברי-סרגל-תווים עם 4 צבעי-role ברורים על הרקע הלבן; אפס
שגיאות קונסולה. typecheck/lint/format/test מלאים נשארו נקיים.
