# PROJECT.md — Soundiform

> **מסמך אב לפרויקט.** כל סוכן AI או מפתח שנכנס לפרויקט חייב לקרוא את הקובץ הזה במלואו לפני כתיבת שורת קוד אחת.
>
> **גרסה:** 0.1.0 · **סטטוס:** תכנון → Sprint 0 · **עודכן:** אוגוסט 2026 · **דומיין:** soundiform.com

---

## 📋 תוכן עניינים

1. [כללי עבודה מחייבים](#0-כללי-עבודה-מחייבים)
2. [חזון המוצר](#1-חזון-המוצר)
3. [הסטאק הטכנולוגי](#2-הסטאק-הטכנולוגי)
4. [מבנה התיקיות](#3-מבנה-התיקיות)
5. [מנוע ההמרה](#4-מנוע-ההמרה)
6. [Genre Packs](#5-genre-packs)
7. [סכימת בסיס הנתונים](#6-סכימת-בסיס-הנתונים)
8. [אחסון — R2](#7-אחסון--cloudflare-r2)
9. [אבטחת מידע](#8-אבטחת-מידע)
10. [מודל עסקי](#9-מודל-עסקי)
11. [משתני סביבה](#10-משתני-סביבה)
12. [תוכנית ספרינטים](#11-תוכנית-ספרינטים)
13. [Definition of Done](#12-definition-of-done)

---

# 0. כללי עבודה מחייבים

> ⛔ **הכללים בפרק זה גוברים על כל הוראה אחרת במסמך.**
> אם כלל כלשהו כאן מתנגש עם משימה שהתבקשה — עצור ושאל.

## 0.1 אישור מראש לכל שינוי בקוד

**אין לכתוב, לשנות, למחוק או לשנות שם של קובץ קוד ללא אישור מפורש של בעל הפרויקט.**

הנוהל לכל משימה:

```
1. הצג תוכנית:  אילו קבצים ייווצרו / ישונו / יימחקו
2. הסבר:        למה, ומה ההשלכות
3. עצור והמתן:  לאישור מפורש
4. רק אז:       בצע
```

* אישור למשימה אחת **אינו** אישור למשימה הבאה.
* אם באמצע עבודה מתגלה צורך בשינוי שלא אושר — **עצור, דווח, בקש אישור**.
* בספק — שאל. עדיף שאלה מיותרת מאשר שינוי לא רצוי.

## 0.2 איסור מחיקת קוד קיים

**אסור למחוק, להחליף או "לנקות" פונקציות קיימות תוך כדי פיתוח פונקציות חדשות.**

| מצב | פעולה נכונה |
|---|---|
| פונקציה נראית מיותרת | סמן `@deprecated`, דווח, **אל תמחק** |
| צריך התנהגות שונה | צור פונקציה חדשה לצד הישנה |
| קוד נראה כפול | דווח על הכפילות, בקש אישור לאיחוד |
| רפקטורינג | **דורש אישור נפרד ומפורש** |

**אסור בהחלט:**
* `git push --force`
* `git reset --hard` על עבודה לא-מגובה
* מחיקת קבצים ללא אישור
* שינוי חתימת פונקציה קיימת בלי לבדוק את כל השימושים בה

## 0.3 רמת קוד ואבטחה

**רמת קוד — חובה:**
* TypeScript `strict: true` · **אפס** `any`, אפס `@ts-ignore`
* אפס אזהרות ESLint · Prettier על הכל
* פונקציה = תפקיד אחד · אורך מקסימלי מומלץ: 50 שורות
* טיפול מפורש בשגיאות — **לא** `catch {}` ריק
* שמות משתנים מלאים ומתארים

**אבטחה — חובה בכל PR:**
* כל קלט חיצוני עובר ולידציית **Zod** — ללא יוצא מן הכלל
* אין שאילתות SQL מחורזות (string concatenation) — Drizzle בלבד
* אין סודות בקוד — `.env` בלבד, ו-`.env` ב-`.gitignore`
* Rate limiting על כל endpoint ציבורי
* SVG עובר סניטציה **תמיד** (`svgo` + `DOMPurify`) — וקטור XSS ידוע
* קבצים נבדקים לפי **magic bytes**, לא לפי סיומת
* RLS מופעל על כל טבלה ב-Postgres
* הרשאות: לעולם לא לסמוך על ה-client לגבי זהות משתמש או מכסות

## 0.4 סשן בדיקות חובה בסוף כל פיתוח

**אסור לסיים סשן פיתוח בלי להריץ את הרשימה הבאה ולתקן את כל מה שנמצא:**

```
□ באגים
  - הרצת כל הבדיקות (pnpm test)
  - בדיקת edge cases: קלט ריק, ענק, פגום, תווים מיוחדים
  - בדיקת מצבי שגיאה: רשת נופלת, DB לא זמין

□ פרצות אבטחה
  - כל קלט מוולד?
  - חשיפת מידע בשגיאות?
  - הרשאות נבדקות בצד השרת?
  - pnpm audit נקי?

□ קריסות
  - promise rejections לא מטופלים?
  - דליפות זיכרון (AudioContext, event listeners)?
  - חלוקה באפס / מערך ריק / null dereference?
  - התנהגות תחת עומס?
```

**רק אחרי שהכל תוקן — הסשן נחשב גמור.** דווח מה נבדק ומה תוקן.

## 0.5 פרודקשן — אישור כפול

```
┌─────────────────────────────────────────┐
│  1. הסוכן בודק את הקוד     ✅          │
│  2. בעל הפרויקט בודק ידנית  ✅          │
│  3. בעל הפרויקט מאשר במפורש ✅          │
│  4. רק אז → פרודקשן                     │
└─────────────────────────────────────────┘
```

**אף פעם, בשום מצב, אין לפרוס לפרודקשן בלי שלושת השלבים.**
זה כולל: `vercel --prod`, מיגרציות DB בפרודקשן, שינוי משתני סביבה בפרודקשן.

## 0.6 תיעוד בקוד

כל קובץ נפתח ב-header:

```typescript
/**
 * @file        shapeAnalyzer.ts
 * @description מחלץ מאפיינים גאומטריים מצורה וקטורית.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */
```

כל פונקציה ציבורית מתועדת ב-JSDoc, עם הסבר **למה** ולא רק **מה**:

```typescript
/**
 * ממפה נקודת Y על הקנבס לדרגת סולם.
 *
 * למה דרגת סולם ולא תו כרומטי:
 * מיפוי כרומטי מייצר דיסוננס על כל צורה לא-מיושרת.
 * מיפוי לדרגות סולם מבטיח קונסוננס תמיד. ראה §4.
 *
 * @param y      קואורדינטת Y מנורמלת (0=למעלה, 1=למטה)
 * @param scale  הסולם הפעיל
 * @returns      מספר MIDI
 */
```

**הערות בעברית מותרות ומעודדות** להסברים ארוכים. שמות משתנים — אנגלית בלבד.

---

# 1. חזון המוצר

## מה זה

פלטפורמה שהופכת **צורות גאומטריות, ציורים ולוגואים** ל**מוזיקה מקצועית**.

## מה זה לא

זה **לא** ממיר תמונה-לספקטרוגרמה. כלים כאלה קיימים מאז UPIC (קסנאקיס, 1977) והם נשמעים כמו רעש.

## הבידול

> **שכבת אילוצים מוזיקליים שמבטיחה שכל פלט — בלי יוצא מן הכלל — יהיה בסולם, בגריד, וקונסוננטי.**

## עקרון הדטרמיניזם

**אותה צורה + אותו סגנון = בדיוק אותו סאונד, תמיד.**
ה-seed נגזר מ-hash של הצורה. קריטי ל: וידאו, זכויות יוצרים, ולמסר "לכל צורה יש צליל אחד".

## קהלי יעד

| קהל | תפקיד | עדיפות |
|---|---|---|
| מעצבים ואמנים | אמינות + SVG | V1 |
| סקרנים | תנועה ויראליות | V1 |
| חברות (לוגו→סאונד) | הכנסה | V1.5 |
| וולנס | הרחבה עתידית | **V2 — לא ב-V1** |

⚠️ **התחום הרפואי אינו חלק מ-V1.** אין להוסיף שום טענה בריאותית ללא אישור מפורש.

---

# 2. הסטאק הטכנולוגי

## ליבה

| | בחירה | גרסה |
|---|---|---|
| שפה | TypeScript (strict) | 5.x |
| Runtime | Node.js LTS | 22.x |
| Package manager | pnpm | 9.x |
| מבנה | pnpm workspaces monorepo | |

## Frontend (`apps/web`)

```
Next.js 16 (App Router) + React 19
Tailwind CSS v4 + shadcn/ui
Zustand              — state management
Canvas 2D            — ציור
Pixi.js              — אנימציית playhead
paper.js             — עיבוד וקטורי
Tone.js v15          — פריוויו אודיו
svgo + DOMPurify     — סניטציית SVG (חובה!)
Zod                  — ולידציה
```

## Backend

```
Next.js API Routes   — פעולות קצרות
Fastify (worker)     — רנדור אודיו/וידאו (שירות נפרד!)
node-web-audio-api   — מריץ את קוד Tone.js בשרת
fluent-ffmpeg        — קידוד MP3/WAV/MP4
sharp                — עיבוד תמונה (לא ImageMagick — CVE)
BullMQ + Redis       — תור עבודות
Drizzle ORM          — DB
```

## תשתית

| רכיב | שירות | עלות התחלתית |
|---|---|---|
| DB + Auth | Supabase | $0 |
| אחסון | **Cloudflare R2** | $0 (דורש כרטיס) |
| Cache/תור | Upstash Redis | $0 |
| CDN + WAF + DNS | Cloudflare | $0 |
| Web hosting | Vercel Hobby → Pro | $0 → $20 |
| Worker | Fly.io / Railway | ~$5 |
| CI | GitHub Actions | $0 |
| ניטור | Sentry + PostHog | $0 |

⚠️ **תנאי מסלולים חינמיים משתנים תדיר — לאמת לפני כל פריסה.**

## סביבת פיתוח

**VS Code.** תוספים נדרשים:
`ESLint` · `Prettier` · `Tailwind CSS IntelliSense` · `Error Lens` · `GitLens` · `Drizzle Kit`

דרישות מקדימות: Node 22 · pnpm · Git · **ffmpeg מותקן מקומית** · Docker (אופציונלי)

---

# 3. מבנה התיקיות

> 📌 **זה המבנה שייבנה ב-Sprint 0.** קבצים המסומנים ⭐ הם ליבת המערכת.

```
soundiform/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # lint + typecheck + test
│       └── security.yml              # pnpm audit + CodeQL
│
├── apps/
│   │
│   ├── web/                          # Next.js — הממשק
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (marketing)/
│   │   │   │   │   ├── page.tsx              # דף בית
│   │   │   │   │   └── pricing/page.tsx
│   │   │   │   ├── (app)/
│   │   │   │   │   ├── studio/page.tsx       # ⭐ הקנבס
│   │   │   │   │   ├── gallery/page.tsx
│   │   │   │   │   └── account/page.tsx
│   │   │   │   ├── s/[shareId]/page.tsx      # דף שיתוף ציבורי
│   │   │   │   ├── admin/                    # פאנל ניהול
│   │   │   │   └── api/
│   │   │   │       ├── projects/route.ts
│   │   │   │       ├── render/route.ts
│   │   │   │       ├── upload/route.ts
│   │   │   │       └── webhooks/
│   │   │   ├── components/
│   │   │   │   ├── canvas/
│   │   │   │   │   ├── DrawingCanvas.tsx     # ⭐
│   │   │   │   │   ├── MusicalGrid.tsx       # רשת התיבות
│   │   │   │   │   ├── Playhead.tsx
│   │   │   │   │   └── RevealOverlay.tsx     # מצב "איך זה נבנה"
│   │   │   │   ├── controls/
│   │   │   │   │   ├── GenreSelector.tsx     # ⭐ בורר סגנון
│   │   │   │   │   ├── ScaleSelector.tsx
│   │   │   │   │   └── TempoSlider.tsx
│   │   │   │   ├── player/
│   │   │   │   └── ui/                       # shadcn
│   │   │   ├── hooks/
│   │   │   │   ├── useAudioEngine.ts         # ⭐
│   │   │   │   └── useShapeCapture.ts
│   │   │   ├── stores/
│   │   │   └── lib/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── worker/                       # רנדור — שירות נפרד
│       ├── src/
│       │   ├── index.ts              # Fastify
│       │   ├── jobs/
│       │   │   ├── renderAudio.ts    # ⭐
│       │   │   ├── renderVideo.ts
│       │   │   └── renderStems.ts
│       │   ├── encoders/
│       │   │   ├── mp3.ts
│       │   │   ├── wav.ts
│       │   │   └── midi.ts
│       │   └── queue/
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   │
│   ├── core/                         # ⭐⭐ מנוע ההמרה — ליבת הפרויקט
│   │   ├── src/
│   │   │   ├── analysis/             # שכבה 1: צורה → מאפיינים
│   │   │   │   ├── shapeAnalyzer.ts
│   │   │   │   ├── contourExtractor.ts
│   │   │   │   ├── symmetryDetector.ts     # חבורות דיהדרליות
│   │   │   │   ├── colorAnalyzer.ts
│   │   │   │   └── complexityMetrics.ts    # ממד פרקטלי
│   │   │   ├── mapping/              # שכבה 2: מאפיינים → מוזיקה
│   │   │   │   ├── geometryToMusic.ts      # ⭐ הליבה הקניינית
│   │   │   │   ├── yToScaleDegree.ts
│   │   │   │   ├── xToTime.ts
│   │   │   │   └── symmetryToTransform.ts  # אינוורסיה/רטרוגרד
│   │   │   ├── theory/               # שכבה 3: חוקי מוזיקה
│   │   │   │   ├── scales.ts
│   │   │   │   ├── chords.ts
│   │   │   │   ├── voiceLeading.ts         # ⭐ קריטי לאיכות
│   │   │   │   ├── harmonyEngine.ts
│   │   │   │   └── rules.ts                # ⭐ החוקה — §4.3
│   │   │   ├── groove/
│   │   │   │   ├── quantize.ts
│   │   │   │   ├── humanize.ts             # ±10ms
│   │   │   │   └── velocityCurves.ts
│   │   │   ├── arrangement/
│   │   │   ├── score/
│   │   │   │   ├── MusicalScore.ts         # ⭐ פורמט הביניים
│   │   │   │   └── scoreSchema.ts          # Zod
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── audio/                        # ⭐ מקור הצליל + מיקס
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   │   ├── InstrumentProvider.ts   # ⭐ הממשק המופשט
│   │   │   │   ├── SynthProvider.ts        # V1
│   │   │   │   └── SamplerProvider.ts      # V2 — שלד בלבד
│   │   │   ├── synths/
│   │   │   ├── mixing/
│   │   │   │   ├── mixChain.ts
│   │   │   │   ├── sidechain.ts
│   │   │   │   └── loudness.ts             # נרמול -14 LUFS
│   │   │   ├── render/
│   │   │   │   ├── browserRenderer.ts
│   │   │   │   └── serverRenderer.ts       # אותו קוד!
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── genres/                       # ⭐ Genre Packs — נתונים, לא קוד
│   │   ├── src/
│   │   │   ├── schema.ts             # Zod של GenrePack
│   │   │   ├── loader.ts
│   │   │   └── packs/
│   │   │       ├── trance.json
│   │   │       ├── house.json
│   │   │       ├── chill.json
│   │   │       ├── reggae.json       # ⚠️ ידרוש דגימות ב-V2
│   │   │       └── cinematic.json
│   │   └── package.json
│   │
│   ├── storage/                      # ⭐ הפשטת אחסון
│   │   ├── src/
│   │   │   ├── StorageProvider.ts    # הממשק
│   │   │   ├── R2Provider.ts         # ⭐ הפעיל
│   │   │   └── SupabaseProvider.ts   # גיבוי
│   │   └── package.json
│   │
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   ├── migrations/
│   │   │   └── client.ts
│   │   └── package.json
│   │
│   ├── shared/                       # טיפוסים, קבועים, Zod משותף
│   │   └── src/
│   │
│   └── ui/                           # קומפוננטות משותפות
│       └── src/
│
├── docs/
│   ├── PROJECT.md                    # ← המסמך הזה
│   ├── ARCHITECTURE.md
│   ├── MUSIC_THEORY.md               # תיעוד החוקה המוזיקלית
│   ├── SECURITY.md
│   └── DECISIONS.md                  # יומן החלטות (ADR)
│
├── .env.example
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

## שתי חוקות הארכיטקטורה

**1. `core`, `audio`, `genres` הם חסיני-סביבה.**
אין בהם `window`, `document`, `fs`, `process`. זה מה שמאפשר לפריוויו בדפדפן ולרנדור בשרת להריץ **בדיוק את אותו קוד** — ולכן מה ששומעים זה מה שמקבלים.

**2. תלות זורמת בכיוון אחד בלבד:**
```
apps  →  packages
core  →  shared        (core לא תלוי בכלום אחר)
audio →  core, shared
```
❌ `core` לעולם לא מייבא מ-`audio`, `db`, או `apps`.

---

# 4. מנוע ההמרה

## 4.1 שלוש השכבות

```
┌──────────────────────────────────────────┐
│ קלט: SVG / PNG / ציור ידני               │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│ שכבה 1 — ANALYSIS                        │
│ קונטור · פינות · סימטריה · צבע · מורכבות│
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│ שכבה 2 — MAPPING (הליבה הקניינית)        │
│ גאומטריה → פרמטרים מוזיקליים             │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│ שכבה 3 — THEORY & TASTE (רשת הביטחון)    │
│ סולם · הרמוניה · voice leading · גרוב    │
└──────────────────┬───────────────────────┘
                   ▼
              MusicalScore
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      אודיו      MIDI       וידאו
```

## 4.2 טבלת המיפוי

| מאפיין גאומטרי | פרמטר מוזיקלי | נימוק |
|---|---|---|
| ציר X | זמן (תיבות/ביטים) | קונבנציה |
| ציר Y | **דרגת סולם** (לא כרומטי) | מבטיח קונסוננס |
| קונטור סגור | לופ / אוסטינטו | עיגול = לופ מושלם |
| מספר קודקודים | גודל מוטיב / תווי אקורד | משולש → 3 תווים |
| זווית חדה | אטאק חד, סטקטו | |
| עקומה חלקה | לגאטו, גליסנדו | |
| שטח / מילוי | וולוסיטי + משך | |
| **סימטריית ראי** | **אינוורסיה / רטרוגרד** | ראה §4.4 |
| סימטריה סיבובית | סקוונצה / טרנספוזיציה | |
| גוון (Hue) | בחירת כלי / ספקטרום | |
| רוויה | רזוננס פילטר | |
| בהירות | אוקטבה / רגיסטר | |
| צפיפות קצוות | סאבדיביז'ן ריתמי | |

## 4.3 ⭐ החוקה המוזיקלית

> **הכלל העליון:** החוק נשמר כברירת מחדל, ונשבר רק בכוונה ובמקום שמצדיק זאת.
> קשיחות מוחלטת מייצרת מוזיקה משעממת. באך שבר חוקים — אבל תמיד ידע איזה.

### קשיח — לעולם לא נשבר

```
✓ כל תו בסולם הפעיל
✓ אין דיסוננס לא-מוכן ולא-פתור
✓ אין קווינטות או אוקטבות מקבילות
✓ שורש הרמוני מוגדר בכל רגע
✓ הכל מקוונטז לגריד
✓ טווחי כלים ריאליסטיים
✓ ללא קליפינג · נרמול ל-14 LUFS
```

### גמיש — נקבע לפי הצורה והסגנון

```
~ צפיפות ריתמית
~ מורכבות אקורדים (טריאדה → ספטימה → מורחב)
~ צבע הרמוני
~ בחירת מוד
~ מרווחי מלודיה
```

**המשמעות:** גם אם מישהו יעלה קשקוש אקראי לחלוטין — הפלט יהיה מוזיקלי.

## 4.4 הבסיס התיאורטי לסימטריה

חבורת הסימטריות של צורה גאומטרית (חבורה דיהדרלית D<sub>n</sub>) היא **איזומורפית** לחבורת הטרנספורמציות הקלאסיות בקונטרפונקט:

| טרנספורמציה גאומטרית | טרנספורמציה מוזיקלית |
|---|---|
| שיקוף אופקי | רטרוגרד |
| שיקוף אנכי | אינוורסיה |
| שיקוף כפול | רטרוגרד-אינוורסיה |
| סיבוב | טרנספוזיציה |

זה לא מטאפורה — זה איזומורפיזם מתמטי. הבסיס האקדמי: Tymoczko, *A Geometry of Music* (Princeton) · Mazzola, *The Topos of Music*.

**זו הסיבה שהמנוע מייצר מוזיקה שנשמעת מכוונת ולא אקראית.**

## 4.5 יחס צורה ↔ סגנון

```
הצורה  → קובעת את התוכן:  מלודיה, אקורדים, צפיפות, מבנה
הסגנון → קובע את הלבוש:   טמפו, גרוב, סאונד, מיקס
```

אותה צורה בטראנס ובצ'יל = **אותה מלודיה, שתי הפקות שונות לגמרי.**
זה מה שהופך את בורר הסגנון לחוויה ולא לגימיק.

## 4.6 MusicalScore — פורמט הביניים

> ⭐ **זה הנכס האמיתי של הפרויקט.** נשמר ב-DB. כשמנוע הצליל ישתדרג — כל היצירות הישנות ירונדרו מחדש טוב יותר.

```typescript
interface MusicalScore {
  version: string;
  seed: string;              // hash של הצורה — דטרמיניזם
  tempo: number;
  timeSignature: [number, number];
  key: { root: number; mode: Mode };
  genreId: string;
  durationBars: number;
  tracks: Track[];
  sections: Section[];       // intro / loop / build / outro
  metadata: {                // ⚠️ נשמר עבור V2 (וולנס) — אל תסיר
    avgNoteDensity: number;
    dominantMode: Mode;
    rootFrequencyHz: number;
  };
}

interface Track {
  role: TrackRole;           // bass | lead | pad | drums | skank
  instrumentId: string;
  notes: Note[];
  mixSettings: MixSettings;
}

interface Note {
  startTick: number;
  durationTicks: number;
  pitch: number;             // MIDI
  velocity: number;          // 0-1
  articulation?: Articulation;
}
```

## 4.7 InstrumentProvider — ההפשטה שמאפשרת דגימות

```typescript
/**
 * ⚠️ חוק ברזל:
 * המנוע המוזיקלי לעולם לא יודע אם מאחוריו סינתסייזר או דגימה.
 * אם מופיעה בקוד המוזיקלי שורה עם 'oscillator' או 'waveform' —
 * עברת על ההפשטה. עצור ותקן.
 */
interface InstrumentProvider {
  readonly id: string;
  readonly kind: 'synth' | 'sampler';
  load(instrumentId: string): Promise<void>;
  playNote(note: Note, time: number): void;
  dispose(): void;
}
```

**V1:** `SynthProvider` בלבד (Tone.js).
**V2:** `SamplerProvider` נכנס **בלי לגעת ב-`core`**.

---

# 5. Genre Packs

> **סגנון הוא נתונים, לא קוד.** כל סגנון = JSON אחד, נטען מ-DB.
> הוספת סגנון = הוספת שורה, **בלי דיפלוי**.

## 5.1 סכימה

```typescript
interface GenrePack {
  id: string;
  displayName: { he: string; en: string };
  tempo: { min: number; max: number; default: number };
  grid: { subdivision: 8|16|32; swingAmount: number };
  allowedModes: Mode[];
  defaultMode: Mode;
  harmonicTendency: 'diatonic' | 'modal' | 'extended';
  roles: TrackRole[];
  rhythmPatterns: Record<TrackRole, Pattern[]>;
  synthMap: Record<TrackRole, SynthPreset>;
  mixChain: MixChainConfig;
  arrangement: ArrangementTemplate;
  requiresSamples: boolean;     // ⚠️ true → מושבת ב-V1
}
```

## 5.2 חמשת הסגנונות הראשונים

| | Trance | House | Chill | Reggae | Cinematic |
|---|---|---|---|---|---|
| BPM | 138 | 124 | 82 | 72 | 90 |
| סווינג | 0% | 8% | 12% | **18%** | 0% |
| מוד | אאולי | דוריאני | לידי | מיקסולידי | אאולי |
| חתימה | supersaw + sidechain | four-on-floor | קורדים מורחבים | **סקאנק ב-2+4** | מיתרים + טימפני |
| V1? | ✅ | ✅ | ✅ | ⚠️ V2 | ✅ |

⚠️ **רגאיי דורש דגימות** (אורגן וגיטרה הם זהות הז'אנר). ה-JSON נכתב ב-V1, אבל `requiresSamples: true` והסגנון מוסתר עד V2.

---

# 6. סכימת בסיס הנתונים

> עקרונות: UUID לא-רץ · soft delete · RLS על כל טבלה · הצורה נשמרת כ**וקטור**, לא כתמונה

```sql
-- ═══ משתמשים ═══
users (
  id UUID PK, email, display_name, avatar_url,
  plan TEXT DEFAULT 'free',        -- free | pro | studio
  created_at, deleted_at
)

-- ═══ פרויקטים — הצורה ═══
projects (
  id UUID PK,
  user_id UUID FK NULL,            -- NULL = אנונימי
  title,
  shape_data JSONB,                -- ⭐ וקטור! מאפשר רנדור מחדש
  shape_hash TEXT,                 -- ⭐ דטרמיניזם
  source_type TEXT,                -- drawing | svg | raster
  thumbnail_key TEXT,              -- מפתח R2
  created_at, updated_at, deleted_at
)

-- ═══ רנדורים ═══
renders (
  id UUID PK,
  project_id UUID FK,
  genre_id TEXT,
  score JSONB,                     -- ⭐ MusicalScore
  engine_version TEXT,             -- ⭐ לרנדור מחדש בעתיד
  audio_key, video_key, midi_key,  -- R2
  duration_sec, status,
  -- ⚠️ שדות עבור V2 (וולנס) — אל תסיר
  tempo_bpm, root_freq_hz, avg_note_density, dominant_mode,
  created_at
)

-- ═══ שיתוף וויראליות ═══
shares (
  id UUID PK, render_id FK,
  slug TEXT UNIQUE,                -- URL קצר
  visibility, view_count, created_at
)

remixes (
  id UUID PK,
  parent_render_id FK,             -- ⭐ עץ רמיקסים
  child_project_id FK,
  created_at
)

likes (user_id, render_id, created_at)

-- ═══ מכסות — append-only! ═══
credits_ledger (
  id UUID PK, user_id FK,
  delta INT,                       -- ⚠️ לעולם לא UPDATE על יתרה
  reason TEXT, created_at
)

-- ═══ ניהול ═══
genre_packs (id, config JSONB, is_active, sort_order)
moderation_queue (id, project_id, status, reviewed_by, reason)
audit_log (id, actor_id, action, target, metadata, ip, created_at)
feature_flags (key, value, description)
```

**שאילתות שהסכימה חייבת לתמוך בהן ביעילות:**
* עץ רמיקסים 3 רמות → `WITH RECURSIVE`
* טופ 10 השבוע לפי סגנון → index על `(genre_id, created_at)`
* יתרת קרדיטים → `SUM(delta)` עם materialized view

---

# 7. אחסון — Cloudflare R2

## למה R2

**egress חינמי, תמיד.** אנחנו מגישים אודיו ווידאו. אם קטע ויראלי יושמע 100,000 פעם — ב-S3 זה חשבון, ב-R2 זה אפס. זה ההבדל בין מוצר בר-קיימא לחשבון מפחיד אחרי טוויט מוצלח.

## מכסה חינמית (מתחדשת חודשית)

```
10 GB אחסון
1,000,000 פעולות Class A (כתיבה)
10,000,000 פעולות Class B (קריאה)
$0 egress — ללא הגבלה
```

## ⚠️ אזהרות

* **דורש הוספת אמצעי תשלום** גם למדרגה החינמית
* **חובה להגדיר התראת תקציב ב-$1** מיד עם ההפעלה
* Cloudflare **מעגלת כלפי מעלה** למיליון הפעולות הבא
* Infrequent Access נשמע זול אך מכפיל עלויות פעולה — **לא להשתמש**
* ⚠️ תנאים משתנים — לאמת לפני פריסה

## מבנה מפתחות

```
projects/{projectId}/thumbnail.webp
renders/{renderId}/audio.mp3
renders/{renderId}/audio.wav
renders/{renderId}/score.mid
renders/{renderId}/video.mp4
renders/{renderId}/stems/{role}.wav
uploads/{userId}/{uploadId}.{ext}
```

## כללי מימוש

* גישה **רק** דרך `packages/storage` — לעולם לא ישירות
* העלאות: presigned URLs, תוקף 15 דקות
* קבצים פרטיים: signed URLs בלבד, **אף פעם לא bucket ציבורי**
* מחיקה: soft delete ב-DB, מחיקה פיזית ב-cron אחרי 30 יום
* **אופטימיזציית עלות:** batch של פעולות כתיבה כדי לא לבזבז Class A

---

# 8. אבטחת מידע

## העלאת קבצים — שרשרת ההגנה

```
1. בדיקת גודל       (מקס 10MB)
2. בדיקת magic bytes  ← לא סיומת!
3. SVG?  → svgo + DOMPurify  ← חובה, וקטור XSS
4. Raster? → sharp re-encode ← מסיר EXIF ו-payloads
5. תור מודרציה
6. R2
```

## Rate Limiting

| Endpoint | אנונימי | רשום |
|---|---|---|
| רנדור | 3/שעה | לפי מכסה |
| העלאה | 5/שעה | 50/שעה |
| API כללי | 60/דקה | 300/דקה |
| הרשמה | 3/שעה/IP | — |

## רשימת חובה

```
□ Zod על כל קלט חיצוני
□ RLS על כל טבלה
□ CSP headers · HSTS · X-Frame-Options
□ Cloudflare WAF + Turnstile על טפסים
□ Argon2 לסיסמאות (או Supabase Auth)
□ סודות ב-.env בלבד
□ pnpm audit ב-CI
□ Dependabot
□ audit_log לכל פעולת אדמין
□ אין הודעות שגיאה שחושפות מבנה פנימי
```

## תאימות

⚠️ **תיקון 13 לחוק הגנת הפרטיות (ישראל)** נכנס לתוקף באוגוסט 2025 — נדרש מיפוי נתונים ומדיניות פרטיות מסודרת. גם GDPR אם יש משתמשים באירופה.

---

# 9. מודל עסקי

| | חינם | Pro ~$9 | Studio ~$29 |
|---|---|---|---|
| אורך | 30 שנ' | 3 דק' | 10 דק' |
| יצירות/חודש | 10 | ∞ | ∞ |
| שמירה | 5 | ∞ | ∞ |
| הורדה | MP3 + watermark | WAV | + Stems + MIDI |
| רישיון | אישי | מסחרי | מסחרי מורחב |
| וידאו | 720p ממותג | 1080p | 4K נקי |

**השקה:** 500 ראשונים → Pro לכל החיים (Founding Members).

**המשפך:** אנונימי יוצר בחופשיות → `localStorage` → ברגע ההורדה: הרשמה → **היצירה עוברת אוטומטית לחשבון**.

> ⚠️ **קריטי:** אסור לאבד את היצירה בתהליך ההרשמה. זו הנקודה שבה 60% מהמוצרים מאבדים משתמשים.

**מנוע הצמיחה:** כפתור **Remix** — כל צופה הופך ליוצר בקליק אחד.

## זכויות יוצרים

* ToS: המשתמש מצהיר שיש לו זכויות על מה שהעלה
* נוהל takedown
* משתמש משלם → בעלות מלאה על הפלט
* **הציור הידני של המשתמש הוא מה שמקנה מחברות אנושית** — טיעון משפטי חשוב
* כל דגימה עתידית: רישיון royalty-free מתועד

---

# 10. משתני סביבה

```bash
# .env.example — ⚠️ לעולם לא לקמט .env אמיתי!

NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # ⚠️ שרת בלבד!

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Worker
WORKER_URL=
WORKER_SECRET=

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

---

# 11. תוכנית ספרינטים

> 📌 **כל ספרינט מסתיים ב[סשן בדיקות](#04-סשן-בדיקות-חובה-בסוף-כל-פיתוח) — §0.4.**
> 📌 **כל משימה דורשת אישור מראש — §0.1.**

### Sprint 0 — תשתית
```
□ monorepo + pnpm workspaces
□ כל התיקיות לפי §3
□ TypeScript strict + ESLint + Prettier
□ GitHub Actions CI
□ .env.example
□ Supabase + טבלאות ראשונות + RLS
□ R2 bucket + התראת תקציב $1
□ packages/storage עם R2Provider
```

### Sprint 1 — הקנבס
```
□ DrawingCanvas — עכבר + מגע
□ MusicalGrid — הרשת המוזיקלית
□ ייצוא הצורה כווקטור
□ shapeHash (דטרמיניזם)
□ שמירה ב-localStorage
```

### Sprint 2 — מנוע: ניתוח ומיפוי
```
□ shapeAnalyzer — קונטור, פינות, מרכז מסה
□ symmetryDetector
□ colorAnalyzer
□ geometryToMusic
□ MusicalScore + Zod
□ בדיקות יחידה על צורות ידועות (עיגול, משולש, ריבוע)
□ העלאת SVG/PNG → ShapeData, עם שרשרת ההגנה של §8 (לא רק ציור-יד מ-Sprint 1)
  — נוסף 2026-08-17 בעקבות ניתוח מתחרים: "העלאת קובץ/לוגו" הוא נדבך בידול מרכזי
  (§1: קהל מעצבים/אמנים, וגם המשפך לחברות ב-V1.5). מסלול raster (PNG/JPG) עשוי
  לדרוש אלגוריתם וקטוריזציה/מעקב-קונטור נפרד מ-SVG (שרק דורש פירסור path-data).
```

### Sprint 3 — מנוע: תיאוריה ⭐
```
□ scales + chords
□ voiceLeading          ← קריטי לאיכות
□ harmonyEngine
□ rules.ts — החוקה §4.3
□ quantize + humanize
□ ⚠️ בדיקה: 100 צורות אקראיות → כולן חייבות להיות בסולם
```

### Sprint 4 — סאונד
```
□ InstrumentProvider (ממשק)
□ SynthProvider
□ mixChain + נרמול LUFS
□ browserRenderer — פריוויו חי
□ Playhead מסונכרן
```

### Sprint 5 — סגנונות
```
□ GenrePack schema + loader
□ trance / house / chill / cinematic
□ reggae.json (requiresSamples: true, מוסתר)
□ GenreSelector UI
□ ⚠️ בדיקה: אותה צורה × 4 סגנונות = 4 הפקות שונות, כולן טובות
□ RevealOverlay — מצב "איך זה נבנה" (לא היה משובץ בשום ספרינט קודם, רק בעץ התיקיות
  §3 — שובץ כאן במפורש ב-2026-08-17 בעקבות ניתוח מתחרים: זו שקיפות שאין למתחרים
  כמו Kandinsky/Mubert. דווקא כאן ולא מוקדם יותר — כי רק אחרי Sprint 4+5 יש סאונד
  וז'אנרים אמיתיים לחשוף; לחשוף מיפוי גס שעוד לא נשמע מקצועי יעבוד נגד המוצר)
```

### Sprint 6 — רנדור בשרת
```
□ worker (Fastify + BullMQ)
□ serverRenderer — אותו קוד!
□ ffmpeg → MP3/WAV
□ ייצוא MIDI
□ העלאה ל-R2
□ ⚠️ בדיקה: פריוויו ≈ פלט סופי
```

### Sprint 7 — חשבונות
```
□ Supabase Auth
□ העברת יצירה אנונימית לחשבון  ← קריטי!
□ credits_ledger + אכיפת מכסות
□ דף חשבון
```

### Sprint 8 — ויראליות
```
□ דף שיתוף /s/[slug]
□ OG image = הצורה
□ כפתור Remix
□ גלריה
□ renderVideo (ffmpeg)
□ ייצוא 9:16
```

### Sprint 9 — אדמין ומודרציה
```
□ פאנל אדמין + דשבורד
□ תור מודרציה
□ feature flags
□ עריכת GenrePack ללא דיפלוי
□ audit_log
```

### Sprint 10 — הקשחה והשקה
```
□ סקירת אבטחה מלאה
□ בדיקות עומס
□ Sentry + PostHog
□ ToS + מדיניות פרטיות
□ Founding Members
□ ⚠️ אישור ידני לפרודקשן — §0.5
```

---

# 12. Definition of Done

משימה נחשבת גמורה **רק** כאשר:

```
□ אושרה מראש                          §0.1
□ לא נמחק קוד קיים                    §0.2
□ TypeScript strict עובר, אפס any     §0.3
□ ESLint נקי                          §0.3
□ כל קלט מוולד ב-Zod                  §0.3
□ בדיקות יחידה נכתבו ועוברות
□ סשן באגים/אבטחה/קריסות הורץ         §0.4
□ כל מה שנמצא — תוקן                  §0.4
□ הקוד מתועד בעברית/אנגלית            §0.6
□ דווח לבעל הפרויקט מה נעשה
□ פרודקשן? → אישור ידני כפול          §0.5
```

---

## 📌 תזכורת אחרונה לסוכן

> לפני כל שינוי — **בקש אישור**.
> אל תמחק קוד קיים.
> בסוף כל סשן — **בדוק באגים, אבטחה, קריסות ותקן**.
> לפרודקשן — **רק אחרי אישור ידני של בעל הפרויקט**.
>
> בספק — **שאל**.
