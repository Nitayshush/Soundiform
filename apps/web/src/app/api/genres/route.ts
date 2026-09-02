/**
 * @file        route.ts
 * @description ⭐ Sprint 9 — מקור האמת ל-GenrePacks בזמן ריצה. הקליינט (GenreSelector,
 *              useAudioEngine) קורא מכאן, לא מ-@soundiform/genres הסטטי — זה מה שמאפשר
 *              "עריכת GenrePack ללא דיפלוי" (§11 Sprint 9) לבוא לידי ביטוי בפועל.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { genrePacks, getDb } from '@soundiform/db';
import { loadActiveGenrePacks } from '@soundiform/genres';

/**
 * ⭐ 2026-09-01: מסלול **פיתוח בלבד** — מגיש את החבילות מ-@soundiform/genres במקום מה-DB.
 *
 * ⚠️ **למה זה נחוץ.** מאז Sprint 9 ה-DB הוא מקור האמת, וה-DB הזה משותף עם הפרודקשן. כלומר
 * הדרך היחידה לראות שינוי בחבילה על השרת המקומי הייתה `db:seed-genres` — שכותב לאתר החי
 * מיד, לפני שהקוד המתאים נפרס שם, ומאפס עריכות-אדמין (ראה הכותרת של seed/genrePacks.ts).
 * זה מסוכן במיוחד כשהחבילה מפנה לדגימות שעוד לא נפרסו: הכלי פשוט לא יימצא בפרודקשן.
 *
 * ⚠️ **שני מנעולים, לא אחד.** גם `NODE_ENV !== 'production'` וגם דגל מפורש — כדי שמשתנה
 * סביבה שידלוף לפרודקשן לא יוכל להחליף את מקור-האמת שם בשום מצב. ברירת המחדל, גם בפיתוח,
 * נשארת ה-DB — אחרת פיתוח ופרודקשן היו מתפצלים בשקט.
 *
 * שימוש: `GENRE_PACKS_SOURCE=static pnpm dev`
 */
function shouldServeStaticPacks(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.GENRE_PACKS_SOURCE === 'static';
}

/**
 * ⭐ 2026-09-01: **אסור לדפדפן לטמן את זה.**
 *
 * ⚠️ נמדד בבדיקה חיה: התשובה יצאה בלי שום `Cache-Control`, ואז הדפדפן מפעיל מטמון
 * **היוריסטי** — הוא רשאי להגיש תשובה ישנה לפי שיקול דעתו. התוצאה בפועל: שינויים בחבילות
 * הסגנון לא הגיעו לאפליקציה בכלל, והמשתמש שמע את הגרסה הקודמת אחרי כל שינוי.
 *
 * ⚠️ זה לא רק מטרד בפיתוח — הוא שובר את הסיבה שהנתיב הזה קיים. מאז Sprint 9 ה-DB הוא
 * מקור-האמת ל-GenrePacks בדיוק כדי ש"עריכת GenrePack באדמין תשפיע בלי דיפלוי" (§11).
 * דפדפן שמטמן את התשובה מבטל את התכונה הזו לגמרי.
 *
 * ⚠️ Route Handlers אינם מטומנים בצד השרת כברירת מחדל בגרסה הזו (ראה
 * node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md), ולכן הבעיה
 * הייתה **רק** בצד הדפדפן — ושם היא נפתרת בכותרת בלבד.
 */
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(): Promise<NextResponse> {
  if (shouldServeStaticPacks()) {
    return NextResponse.json({ packs: loadActiveGenrePacks() }, { headers: NO_STORE });
  }

  const db = getDb();
  const rows = await db
    .select({ config: genrePacks.config })
    .from(genrePacks)
    .where(eq(genrePacks.isActive, true))
    .orderBy(asc(genrePacks.sortOrder));

  return NextResponse.json({ packs: rows.map((row) => row.config) }, { headers: NO_STORE });
}
