/**
 * @file        noteDurationCap.test.ts
 * @description ⭐ 2026-09-18: אף תו בודד לא יכול להפוך לתו של עשרות שניות.
 * @author      Soundiform
 * @created     2026-09-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **הבאג שהוליד את הבדיקה, שדווח כ"ה-lead לא נשמע" (תמונה שהועלתה — לוגו Tesla):**
 * `runToNote` (harmonyEngine.ts) גזר משך-תו ישירות ממספר העמודות שקו-הציור נשאר על אותה
 * שורה ברציפות, בלי תקרה. קטע כמעט-אופקי (נפוץ בלוגואים/תמונות עם שטחים שטוחים) הפך
 * לתו יחיד של **43 ו-63 שניות** בפועל (נמדד על ה-lead/bass של הדוגמה שדיווחה על הבאג) —
 * כמעט בלתי-נשמע על צליל פלאק-קצר (sustain 5%), במקום סדרת פריטות קצרות. התיקון (MAX_RUN_
 * SPAN_COLUMNS) מגביל run יחיד ל-2 ברים לכל היותר. הבדיקה כאן סורקת את **כל הסגנונות**
 * וכמה צורות-קיצון (כולל קו כמעט-אופקי, בדיוק התנאי שהוליד את הבאג) כדי שרגרסיה עתידית
 * (למשל תיקון עתידי ב-runToNote) לא תחזיר תופעה כזו בלי ששום דבר "נשבר" רשמית.
 *
 * ⭐ 2026-09-18 (המשך, לפי בקשה חיה): לא מספיק לקצץ — התו "מתחדש" (runToNotes) לאורך כל
 * ה-run המקורי, לא נעצר אחרי הקטע הראשון ואז שקט. הבדיקה השנייה למטה מוודאת את זה: run
 * ארוך מהתקרה חייב להפיק **יותר מתו אחד**, וביחד הם מכסים את כל טווח ה-run (בלי פער בין
 * סוף-תו אחד לתחילת-הבא).
 */

import { describe, expect, it } from 'vitest';
import { composeMusicalScore, geometryToMusic } from '@soundiform/core';
import type { ShapeData } from '@soundiform/shared';
import { loadAllGenrePacks } from '@soundiform/genres';
import { toCompositionConfig } from './genreAdapter';

/**
 * ⚠️ תקרה **בשניות**, לא בטיקים — כדי שהבדיקה תעבוד זהה בכל טמפו. 2 ברים ב-4/4 בטמפו
 * הכי-איטי שסגנון כלשהו מאפשר (בדוק ב-packages/genres) הוא עדיין מתחת לזה בנוחות; 10
 * שניות תופס בבירור את מחלקת-הבאג (43/63s) בלי להיות רגיש לכיול-עתידי-קטן של התקרה.
 */
const MAX_ACCEPTABLE_NOTE_SECONDS = 10;

/** קו כמעט-אופקי — בדיוק התנאי שיוצר run ארוך-מדי (הקו נשאר על אותה שורה לאורך הציר). */
function nearHorizontalLine(): ShapeData {
  return {
    version: '1.0.0',
    paths: [
      {
        points: Array.from({ length: 60 }, (_, i) => ({ x: i / 59, y: 0.5 + (i % 2) * 0.002 })),
        closed: false,
      },
    ],
  };
}

/** דמוי-לוגו: כמה קטעים כמעט-שטוחים ברמות-Y שונות, עם קפיצות ביניהם — כמו קונטור-רסטר אמיתי. */
function logoLikeShape(): ShapeData {
  const flatSegment = (y: number, xStart: number, xEnd: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      x: xStart + ((xEnd - xStart) * i) / (count - 1),
      y,
    }));
  return {
    version: '1.0.0',
    paths: [
      { points: flatSegment(0.2, 0.02, 0.4, 25), closed: false },
      { points: flatSegment(0.75, 0.42, 0.98, 30), closed: false },
    ],
  };
}

/** צורה "רגילה" (סטנדרטית, לא-קיצונית) — לוודא שהתקרה לא פוגעת בציורים תקינים. */
function normalWaveShape(): ShapeData {
  return {
    version: '1.0.0',
    paths: [
      {
        points: Array.from({ length: 40 }, (_, i) => {
          const t = i / 39;
          return { x: t, y: 0.5 + 0.3 * Math.sin(t * Math.PI * 4) };
        }),
        closed: false,
      },
    ],
  };
}

const STRESS_SHAPES: readonly { name: string; shape: ShapeData }[] = [
  { name: 'near-horizontal-line', shape: nearHorizontalLine() },
  { name: 'logo-like', shape: logoLikeShape() },
  { name: 'normal-wave', shape: normalWaveShape() },
];

describe('שום תו לא הופך לתו של עשרות שניות (raster runs ארוכים מדי)', () => {
  it('בכל הסגנונות, בכל צורות-הקיצון — כל תו ב-lead/bass מתחת לתקרה', () => {
    const violations: string[] = [];

    for (const pack of loadAllGenrePacks()) {
      for (const { name, shape } of STRESS_SHAPES) {
        const intent = geometryToMusic(shape, `duration-cap-${pack.id}-${name}`);
        const score = composeMusicalScore(intent, toCompositionConfig(pack, undefined, intent.seed));

        for (const role of ['lead', 'bass'] as const) {
          const track = score.tracks.find((candidate) => candidate.role === role);
          if (!track) {
            continue;
          }
          for (const note of track.notes) {
            const seconds = (note.durationTicks / 480) * (60 / score.tempo);
            if (seconds > MAX_ACCEPTABLE_NOTE_SECONDS) {
              violations.push(
                `${pack.id}/${name}/${role}: תו של ${seconds.toFixed(1)}s ` +
                  `(startTick=${String(note.startTick)}, durationTicks=${String(note.durationTicks)})`,
              );
            }
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('משיכת-עט ארוכה ושטוחה ממשיכה "להתחדש" לאורכה — לא תו אחד ואז שקט', () => {
    const pack = loadAllGenrePacks().find((candidate) => candidate.id === 'trance')!;
    const intent = geometryToMusic(nearHorizontalLine(), 'duration-cap-retrigger-check');
    const score = composeMusicalScore(intent, toCompositionConfig(pack, undefined, intent.seed));

    for (const role of ['lead', 'bass'] as const) {
      const track = score.tracks.find((candidate) => candidate.role === role)!;
      expect(track.notes.length, `${role}: קו ארוך צריך יותר מתו אחד`).toBeGreaterThan(1);

      const sorted = [...track.notes].sort((a, b) => a.startTick - b.startTick);
      for (let i = 1; i < sorted.length; i += 1) {
        const previous = sorted[i - 1]!;
        const current = sorted[i]!;
        const gapTicks = current.startTick - (previous.startTick + previous.durationTicks);
        // ⚠️ הטולרנס לא אפס: sustainRatio<1 (ראה runToNote) משאיר בכוונה "נשימה" קצרה
        // בסוף כל קטע (ארטיקולציה רגילה, לא legato מלא) — לא רק הומניזציה/סווינג. הגבול
        // כאן בודק "רצף אמיתי בין קטעים" (לא שקט-של-שניות), לא "אפס-פער מוחלט".
        expect(gapTicks, `${role}: פער בין תו ${String(i - 1)} ל-${String(i)}`).toBeLessThan(1000);
      }
    }
  });
});
