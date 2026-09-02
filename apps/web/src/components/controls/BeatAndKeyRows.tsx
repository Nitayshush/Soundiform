/**
 * @file        BeatAndKeyRows.tsx
 * @description ⭐ 2026-08-31 (סבב א'): שתי שורות-בחירה שנוספו לפאנל ה-Sound — **מקצב** ידני
 *              ו**סולם**. שתיהן ידניות ובלתי-תלויות בציור, בכוונה.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה ידני דווקא.** שאר המנוע נשען על העיקרון "הציור קובע". שני אלה חורגים ממנו בכוונה:
 * (א) גרוב הוא מה שהופך האוס להאוס, והציור לא יכול לספק אותו — כשהקצב נגזר לגמרי מהציור,
 * הסגנון איבד את זהותו (נבדק חי). (ב) הסולם חייב להיבחר **לפני** הציור, כי לוח-התווים מוצג
 * בזמן הציור — אי אפשר לגזור אותו ממשהו שעוד לא קיים.
 *
 * ⚠️ בורר-הסולם הוא גם התיקון לממצא שכל היצירות בסגנון חלקו פלטה אחת: נמדד שאותם 6 גבהים
 * הופיעו ב-80 מתוך 80 ציורים, כי השורש והמוד היו קבועים לסגנון.
 *
 * ⚠️ 2026-09-01: הייתה כאן לזמן קצר שורה שלישית — **ארנג'מנט** — והיא **הוסרה לבקשת
 * הפאונדר**. הסיבה מתועדת ב-docs/DECISIONS.md: היא יכלה רק **להסיר תווים** מהכלים שכבר
 * נקבעו, ולכן בגרסה אחת היא רוקנה את הלהקה ובגרסה השנייה כמעט ולא נשמעה (16-21% הפרש).
 * אל תחזירו אותה בצורה הזו — ארנג'מנט אמיתי צריך להחליף **כלים** בין הסקשנים, וזה דורש
 * לרוץ לפני קביעת הכלים ולא אחריה.
 */

'use client';

import type { Mode } from '@soundiform/core';
import type { GenrePack } from '@soundiform/genres';
import { Button } from '@/components/ui/button';
import { DRAWING_BEAT_ID, useCreationSettingsStore } from '@/stores/creationSettingsStore';

const ROOT_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

const MODE_LABEL: Record<Mode, string> = {
  ionian: 'Major',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  aeolian: 'Minor',
  locrian: 'Locrian',
};

interface BeatAndKeyRowsProps {
  pack: GenrePack;
}

export function BeatAndKeyRows({ pack }: BeatAndKeyRowsProps) {
  const settings = useCreationSettingsStore((state) => state.byGenre[pack.id]);
  const setBeatPattern = useCreationSettingsStore((state) => state.setBeatPattern);
  const setKey = useCreationSettingsStore((state) => state.setKey);

  // ⚠️ ברירת המחדל היא הביט הראשון של הסגנון, לא "מהציור" — ראה resolveBeatPattern.
  const activeBeatId = settings?.beatPatternId ?? pack.beatPatterns?.[0]?.id ?? DRAWING_BEAT_ID;
  const activeRoot = settings?.key?.rootPitchClass ?? pack.noteBoardRootPitchClass ?? 0;
  const activeMode = settings?.key?.mode ?? pack.defaultMode;
  const beatPatterns = pack.beatPatterns ?? [];

  return (
    <>
      {beatPatterns.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Beat</span>
          {/* ⚠️ 2026-09-01: היה כאן אזור-גלילה פנימי (max-h-28), שנועד למנוע מהמקצב האחרון
              להיחתך. בפועל הוא **גרם** לזה: עם 4 מקצבים ו-4 ארנג'מנטים שתי הרשימות נחתכו
              באמצע כפתור, וזה נראה כאילו האפשרות לא קיימת (דווח בבדיקה חיה על הארנג'מנט).
              הוסר — לפאנל עצמו כבר יש max-h-[70vh]+overflow-y-auto, כך שיש גלילה **אחת**
              במקום שלוש מקוננות, ואף פריט לא נחתך. */}
          <div className="flex flex-col gap-1" role="group" aria-label="Beat">
            <Button
              type="button"
              size="sm"
              variant={activeBeatId === DRAWING_BEAT_ID ? 'default' : 'outline'}
              className="w-full justify-start rounded-md"
              aria-pressed={activeBeatId === DRAWING_BEAT_ID}
              onClick={() => {
                setBeatPattern(pack.id, DRAWING_BEAT_ID);
              }}
            >
              From the drawing
            </Button>
            {beatPatterns.map((pattern) => (
              <Button
                key={pattern.id}
                type="button"
                size="sm"
                variant={activeBeatId === pattern.id ? 'default' : 'outline'}
                className="w-full justify-start rounded-md"
                aria-pressed={activeBeatId === pattern.id}
                onClick={() => {
                  setBeatPattern(pack.id, pattern.id);
                }}
              >
                {pattern.displayName.en}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {pack.absoluteNoteBoard ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Key</span>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Root note">
            {ROOT_NAMES.map((name, rootPitchClass) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={activeRoot === rootPitchClass ? 'default' : 'outline'}
                className="shrink-0 rounded-full px-2.5"
                aria-pressed={activeRoot === rootPitchClass}
                onClick={() => {
                  setKey(pack.id, { rootPitchClass, mode: activeMode });
                }}
              >
                {name}
              </Button>
            ))}
          </div>
          {/* רק המודים שהסגנון מרשה — מוד זר היה שובר את אופי הסגנון, לא מגוון אותו. */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mode">
            {pack.allowedModes.map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={activeMode === mode ? 'default' : 'outline'}
                className="shrink-0 rounded-full"
                aria-pressed={activeMode === mode}
                onClick={() => {
                  setKey(pack.id, { rootPitchClass: activeRoot, mode });
                }}
              >
                {MODE_LABEL[mode]}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
