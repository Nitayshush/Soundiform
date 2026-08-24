/**
 * @file        rules.ts
 * @description ⭐ החוקה המוזיקלית — ראה PROJECT.md §4.3. מוודא (לא רק בונה) שפלט מכבד את
 *              הכללים הקשיחים. הבדיקה הנדרשת ב-§11 Sprint 3 (100 צורות אקראיות → כולן בסולם)
 *              רצה מול validateConstitution.
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ מגבלת V1 — מה שקובץ הזה **לא** בודק (מתועד במקום להעמיד פנים שזה מכוסה):
 * "אין דיסוננס לא-מוכן ולא-פתור" הוא ניתוח קונטרפונקטי מלא (הכנה/פתרון על ציר הזמן) —
 * לא ממומש ב-V1. "שורש הרמוני מוגדר בכל רגע" נאכף ארכיטקטונית (יש תמיד track בס +
 * score.key), לא נבדק כאן טענה-טענה. "ללא קליפינג / נרמול LUFS" שייך לשכבת האודיו
 * (Sprint 4), לא לשכבת ה-score.
 *
 * למה startTick נבדק בטולרנס ולא ביישור מדויק:
 * humanize.ts (groove/) מזיז תזמון בכוונה ב-±10ms כ"רעד יד" — זו סטייה *מכוונת* מהגריד,
 * לא הפרה שלו. בנוסף, אם ל-GenrePack יש swingAmount>0 (§5.1), הבדיקה משתמשת ב-
 * distanceFromSwingGrid (לא distanceFromGrid הרגיל) — סווינג הוא עדיין "מקוונטז" במובן
 * המהותי, ראה quantize.ts. "הכל מקוונטז לגריד" נאכף על השלד לפני ההומניזציה; durationTicks
 * לעומת זאת לא עובר הומניזציה/סווינג בכלל (ראה harmonyEngine.ts), ולכן נשאר מיושר בדיוק.
 */

import type { MusicalScore } from '../score/MusicalScore';
import { isInScale } from './scales';
import { distanceFromSwingGrid, isOnGrid, type GridSubdivision } from '../groove/quantize';
import { maxTimingJitterTicks } from '../groove/humanize';

/** טווחי MIDI ריאליסטיים גסים לפי תפקיד (§4.3: "טווחי כלים ריאליסטיים"). */
const ROLE_PITCH_RANGES: Record<string, { min: number; max: number }> = {
  bass: { min: 24, max: 60 },
  lead: { min: 48, max: 96 },
  pad: { min: 36, max: 84 },
  drums: { min: 0, max: 127 }, // תופים ממופים לפי מפת כלים, לא סולם/רג'יסטר — לא מוגבל כאן
  skank: { min: 36, max: 84 },
};

export interface ConstitutionViolation {
  rule: 'note-in-scale' | 'quantized-to-grid' | 'realistic-range' | 'no-clipping-velocity';
  trackIndex: number;
  noteIndex: number;
  detail: string;
}

/**
 * בודק MusicalScore מול הכללים הקשיחים של §4.3 שניתנים לאימות אוטומטי (ראה מגבלות V1 למעלה).
 */
export function validateConstitution(
  score: MusicalScore,
  gridSubdivision: GridSubdivision = 16,
  swingAmount = 0,
): ConstitutionViolation[] {
  const violations: ConstitutionViolation[] = [];
  // ⭐ 2026-08-24: Math.ceil, לא הערך השברירי הגולמי — humanizeTiming (groove/humanize.ts)
  // מעגל (Math.round) tick+jitter, כך שהסטייה בפועל יכולה להגיע ל-Math.round(maxJitterTicks)
  // (למשל 9.6→10), חורגת מהטולרנס השברירי הגולמי (9.6) גם כשההומניזציה פעלה בדיוק כמתוכנן —
  // לא הפרה אמיתית, רק פער בין הטולרנס לעיגול בפועל. נתפס ע"י בדיקה אמיתית (seed שגרם
  // ל-jitter קרוב לקצה הטווח על טראק תופים ב-build).
  const startTickTolerance = Math.ceil(maxTimingJitterTicks(score.tempo));

  score.tracks.forEach((track, trackIndex) => {
    const range = ROLE_PITCH_RANGES[track.role] ?? { min: 0, max: 127 };

    track.notes.forEach((note, noteIndex) => {
      if (!isInScale(note.pitch, score.key.root, score.key.mode)) {
        violations.push({
          rule: 'note-in-scale',
          trackIndex,
          noteIndex,
          detail: `פיץ' ${String(note.pitch)} אינו בסולם ${score.key.mode} (שורש ${String(score.key.root)})`,
        });
      }

      const startTickOffGrid =
        distanceFromSwingGrid(note.startTick, gridSubdivision, swingAmount) > startTickTolerance;
      const durationOffGrid = !isOnGrid(note.durationTicks, gridSubdivision);
      if (startTickOffGrid || durationOffGrid) {
        violations.push({
          rule: 'quantized-to-grid',
          trackIndex,
          noteIndex,
          detail: `startTick=${String(note.startTick)} durationTicks=${String(note.durationTicks)} לא מיושרים לגריד (בטולרנס הומניזציה ±${String(startTickTolerance)})`,
        });
      }

      if (note.pitch < range.min || note.pitch > range.max) {
        violations.push({
          rule: 'realistic-range',
          trackIndex,
          noteIndex,
          detail: `פיץ' ${String(note.pitch)} מחוץ לטווח הריאליסטי של ${track.role} [${String(range.min)}-${String(range.max)}]`,
        });
      }

      if (note.velocity < 0 || note.velocity > 1) {
        violations.push({
          rule: 'no-clipping-velocity',
          trackIndex,
          noteIndex,
          detail: `velocity ${String(note.velocity)} מחוץ לטווח [0,1]`,
        });
      }
    });
  });

  return violations;
}

export function isConstitutionCompliant(
  score: MusicalScore,
  gridSubdivision?: GridSubdivision,
  swingAmount?: number,
): boolean {
  return validateConstitution(score, gridSubdivision, swingAmount).length === 0;
}
