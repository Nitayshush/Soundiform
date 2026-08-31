/**
 * @file        rolePolicy.ts
 * @description ⭐ 2026-08-31 (מנגנון קצב, שכבה ב'): נותן לכל כלי את הקצב שמתאים לו. אותו
 *              ציור בדיוק — כל תפקיד מבטא ממנו פרוסה אחרת.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **החוק שמגן על העיקרון.** מדיניות **לעולם לא מוסיפה מכה**. היא רק בוחרת מתוך אירועי
 * הציור ומצמידה אותם לגריד. הזמנים של כל תפקיד חייבים להיות תת-קבוצה של אירועי הציור —
 * זה נבדק אוטומטית (rolePolicy.test.ts), לא מובטח בהערה. כך "הציור קובע מה מנגן" נשאר
 * נכון מתמטית גם אחרי שהחזרנו לסגנון השפעה על ההרגשה.
 *
 * ⚠️ **למה בכלל צריך את זה.** בלי מדיניות, כל התפקידים קוראים את אותם אירועים ומקבלים את
 * אותה צפיפות — קיק, בס וליד פועמים באותו אופן, וזה נשמע כמקשה אחת. בהקלטה אמיתית לקיק,
 * להיי-האט ולבס יש תפקידים קצביים שונים לגמרי, וזה מה שמייצר מרקם.
 */

import type { TrackRole } from '../score/MusicalScore';
import type { DrumPiece } from './drumKit';
import { at } from '../internal/arrayUtils';

/** עמדות בגריד בתוך בר, ביחידות של שש-עשרית (0..15). */
const STEPS_PER_BAR = 16;
const BEAT_STEPS = [0, 4, 8, 12] as const;
const OFFBEAT_STEPS = [2, 6, 10, 14] as const;
const EIGHTH_STEPS = [0, 2, 4, 6, 8, 10, 12, 14] as const;

export interface RhythmPolicy {
  /**
   * עמדות מותרות בתוך הבר. אירוע שנפל בין עמדות מוצמד לקרובה ביותר **אם** הוא בטווח
   * snapTolerance; אחרת הוא נשמט. undefined = כל 16 העמדות מותרות.
   */
  allowedSteps?: readonly number[];
  /** מרחק מרבי (בשש-עשרות) שממנו מותר להצמיד לעמדה מותרת. */
  snapToleranceSteps: number;
  /** מרווח מינימלי בין שתי מכות של אותו תפקיד. */
  minGapSteps: number;
  /** רק אירועים שעוצמתם מעל הסף נשקלים כלל. */
  minStrength: number;
  /** תקרת מכות לבר — בלם קשיח מול ציור צפוף במיוחד. */
  maxHitsPerBar: number;
}

/**
 * ⚠️ ברירות המחדל נגזרות מתפקיד הכלי בהקלטה אמיתית, לא מטעם אסתטי שרירותי:
 * קיק נושא את הפעימה ולכן דליל ומוצמד לפעימות; היי-האט הוא הרקע ולכן צפוף וחופשי;
 * בס נעול על השלד ההרמוני ולכן ארוך ודליל; ליד חופשי אך לא רציף; פאד ברמת-בר.
 */
export const DEFAULT_ROLE_POLICY: Record<TrackRole, RhythmPolicy> = {
  bass: {
    allowedSteps: EIGHTH_STEPS,
    snapToleranceSteps: 1,
    minGapSteps: 2,
    minStrength: 0.25,
    maxHitsPerBar: 6,
  },
  lead: {
    snapToleranceSteps: 1,
    minGapSteps: 1,
    minStrength: 0.1,
    maxHitsPerBar: 10,
  },
  pad: {
    allowedSteps: BEAT_STEPS,
    snapToleranceSteps: 2,
    minGapSteps: 8,
    minStrength: 0,
    maxHitsPerBar: 2,
  },
  drums: {
    snapToleranceSteps: 1,
    minGapSteps: 1,
    minStrength: 0.1,
    maxHitsPerBar: 12,
  },
  skank: {
    allowedSteps: OFFBEAT_STEPS,
    snapToleranceSteps: 1,
    minGapSteps: 2,
    minStrength: 0.2,
    maxHitsPerBar: 4,
  },
};

/**
 * לתופים המדיניות היא **לפי חלק בערכה**, לא לפי התפקיד: קיק והיי-האט הם שני קצבים שונים
 * לחלוטין שחיים באותו טראק. זה בדיוק מה שהיה חסר כשלטראק התופים לא הייתה זהות-כלי.
 */
export const DRUM_PIECE_POLICY: Record<DrumPiece, RhythmPolicy> = {
  kick: {
    allowedSteps: BEAT_STEPS,
    snapToleranceSteps: 2,
    minGapSteps: 4,
    minStrength: 0.2,
    maxHitsPerBar: 4,
  },
  tom: {
    allowedSteps: EIGHTH_STEPS,
    snapToleranceSteps: 1,
    minGapSteps: 2,
    minStrength: 0.35,
    maxHitsPerBar: 4,
  },
  snare: {
    allowedSteps: [4, 12],
    snapToleranceSteps: 3,
    minGapSteps: 4,
    minStrength: 0.2,
    maxHitsPerBar: 3,
  },
  clap: {
    allowedSteps: [4, 12],
    snapToleranceSteps: 3,
    minGapSteps: 8,
    minStrength: 0.35,
    maxHitsPerBar: 2,
  },
  'hihat-closed': {
    snapToleranceSteps: 1,
    minGapSteps: 1,
    minStrength: 0.05,
    maxHitsPerBar: 12,
  },
  'hihat-open': {
    allowedSteps: OFFBEAT_STEPS,
    snapToleranceSteps: 1,
    minGapSteps: 4,
    minStrength: 0.3,
    maxHitsPerBar: 3,
  },
  crash: {
    allowedSteps: [0],
    snapToleranceSteps: 3,
    minGapSteps: 32,
    minStrength: 0.5,
    maxHitsPerBar: 1,
  },
};

export interface PolicyCandidate {
  /** עמודת-הרסטר שבה האירוע התרחש (16 עמודות לבר). */
  column: number;
  strength: number;
}

/**
 * ⚠️ מחזירים גם את עמודת-המקור וגם את עמודת-היעד: ההצמדה מזיזה מכה על ציר הזמן, והקורא
 * חייב לדעת **איזה אירוע-ציור** הפך לאיזו מכה — אחרת אי אפשר להעביר את הגובה והמשך הנכונים,
 * ואי אפשר לאמת שלא הומצאה מכה יש-מאין.
 */
export interface PolicySelection {
  sourceColumn: number;
  column: number;
  strength: number;
}

/** מצמיד עמודה לעמדה מותרת בתוך הבר, או null אם היא רחוקה מדי מכל עמדה מותרת. */
function snapToAllowedStep(column: number, policy: RhythmPolicy): number | null {
  if (!policy.allowedSteps || policy.allowedSteps.length === 0) {
    return column;
  }
  const barStart = Math.floor(column / STEPS_PER_BAR) * STEPS_PER_BAR;
  const stepInBar = column - barStart;
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const allowed of policy.allowedSteps) {
    const distance = Math.abs(allowed - stepInBar);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = allowed;
    }
  }
  if (best === null || bestDistance > policy.snapToleranceSteps) {
    return null;
  }
  return barStart + best;
}

/**
 * מיישמת מדיניות על אירועי הציור ומחזירה את העמודות ששורדות.
 *
 * ⚠️ הבחירה היא **החזק-קודם, בסדר גלובלי** ולא "הראשון-קודם": מכה חזקה שנפלה ליד מכה
 * חלשה צריכה לנצח אותה, אחרת המבטאים של הציור נשמטים רק בגלל שהם הגיעו שנייה מאוחר יותר.
 */
export function applyRhythmPolicy(
  candidates: readonly PolicyCandidate[],
  policy: RhythmPolicy,
): PolicySelection[] {
  const snapped = new Map<number, PolicySelection>();
  for (const candidate of candidates) {
    if (candidate.strength < policy.minStrength) {
      continue;
    }
    const column = snapToAllowedStep(candidate.column, policy);
    if (column === null) {
      continue;
    }
    // כמה אירועים יכולים להיצמד לאותה עמדה — שומרים את החזק שבהם.
    const existing = snapped.get(column);
    if (!existing || candidate.strength > existing.strength) {
      snapped.set(column, { column, sourceColumn: candidate.column, strength: candidate.strength });
    }
  }

  const ordered = [...snapped.values()].sort(
    (a, b) => b.strength - a.strength || a.column - b.column,
  );

  const keptByBar = new Map<number, number>();
  const kept: PolicySelection[] = [];
  for (const selection of ordered) {
    const bar = Math.floor(selection.column / STEPS_PER_BAR);
    if ((keptByBar.get(bar) ?? 0) >= policy.maxHitsPerBar) {
      continue;
    }
    if (
      kept.some((existing) => Math.abs(existing.column - selection.column) < policy.minGapSteps)
    ) {
      continue;
    }
    kept.push(selection);
    keptByBar.set(bar, (keptByBar.get(bar) ?? 0) + 1);
  }
  return kept.sort((a, b) => a.column - b.column);
}

/**
 * ⚠️ **רצפת-צפיפות.** מדיניות הדוקה על ציור חלק עלולה להשאיר טראק כמעט ריק (עיגול עם מעט
 * אירועים → בס שמנגן פעמיים בכל היצירה). כאן מרפים את הסף בהדרגה עד שיש מספיק מכות, במקום
 * להשאיר שקט — הרפיה, לא המצאה: עדיין בוחרים רק מתוך אירועי הציור.
 */
export function applyPolicyWithFloor(
  candidates: readonly PolicyCandidate[],
  policy: RhythmPolicy,
  minimumHits: number,
): PolicySelection[] {
  let relaxed = policy;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const kept = applyRhythmPolicy(candidates, relaxed);
    if (kept.length >= minimumHits || candidates.length === 0) {
      return kept;
    }
    relaxed = {
      ...relaxed,
      minStrength: relaxed.minStrength / 2,
      snapToleranceSteps: relaxed.snapToleranceSteps + 1,
      minGapSteps: Math.max(1, Math.floor(relaxed.minGapSteps / 2)),
    };
  }
  // מוצא אחרון: בלי הצמדה בכלל, רק תקרת-הצפיפות — כדי שתפקיד לא ייעלם לגמרי.
  const unrestricted: RhythmPolicy = {
    snapToleranceSteps: relaxed.snapToleranceSteps,
    minGapSteps: relaxed.minGapSteps,
    minStrength: 0,
    maxHitsPerBar: relaxed.maxHitsPerBar,
  };
  return applyRhythmPolicy(candidates, unrestricted);
}

/** מדיניות לתפקיד, עם דריסה אופציונלית מהסגנון. */
export function resolveRolePolicy(
  role: TrackRole,
  overrides?: Partial<Record<TrackRole, Partial<RhythmPolicy>>>,
): RhythmPolicy {
  const base = at([DEFAULT_ROLE_POLICY[role]], 0);
  const override = overrides?.[role];
  return override ? { ...base, ...override } : base;
}
