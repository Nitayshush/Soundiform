/**
 * @file        rolePolicy.test.ts
 * @description ⭐ 2026-08-31: בדיקות למדיניות-הקצב לפי תפקיד. הבדיקה החשובה כאן היא
 *              **חוק תת-הקבוצה**: מדיניות בוחרת מתוך אירועי הציור ולעולם לא ממציאה מכה.
 *              זה מה ששומר על "הציור קובע מה מנגן" נכון מתמטית, ולא רק כהבטחה בהערה.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import {
  applyPolicyWithFloor,
  applyRhythmPolicy,
  DEFAULT_ROLE_POLICY,
  DRUM_PIECE_POLICY,
  resolveRolePolicy,
  type PolicyCandidate,
} from './rolePolicy';
import { DRUM_PIECES } from './drumKit';

/** אירוע בכל שש-עשרית לאורך 4 ברים — המקרה הגרוע: זרם רציף. */
const DENSE_CANDIDATES: PolicyCandidate[] = Array.from({ length: 64 }, (_, column) => ({
  column,
  strength: 0.5 + (column % 4 === 0 ? 0.4 : 0),
}));

describe('חוק תת-הקבוצה — מדיניות לא ממציאה מכות', () => {
  it('כל עמודת-מקור שנבחרה הייתה אירוע-ציור אמיתי', () => {
    const sourceColumns = new Set(DENSE_CANDIDATES.map((candidate) => candidate.column));
    for (const role of Object.keys(DEFAULT_ROLE_POLICY) as (keyof typeof DEFAULT_ROLE_POLICY)[]) {
      for (const selection of applyRhythmPolicy(DENSE_CANDIDATES, DEFAULT_ROLE_POLICY[role])) {
        expect(sourceColumns.has(selection.sourceColumn), role).toBe(true);
      }
    }
  });

  it('גם לכל חלק בערכה', () => {
    const sourceColumns = new Set(DENSE_CANDIDATES.map((candidate) => candidate.column));
    for (const piece of DRUM_PIECES) {
      for (const selection of applyRhythmPolicy(DENSE_CANDIDATES, DRUM_PIECE_POLICY[piece])) {
        expect(sourceColumns.has(selection.sourceColumn), piece).toBe(true);
      }
    }
  });

  it('בלי אירועים — אין מכות, גם עם רצפת-צפיפות', () => {
    expect(applyPolicyWithFloor([], DEFAULT_ROLE_POLICY.lead, 10)).toEqual([]);
  });
});

describe('לכל כלי קצב משלו', () => {
  it('קיק דליל בהרבה מהיי-האט על אותם אירועים בדיוק', () => {
    const kick = applyRhythmPolicy(DENSE_CANDIDATES, DRUM_PIECE_POLICY.kick);
    const hihat = applyRhythmPolicy(DENSE_CANDIDATES, DRUM_PIECE_POLICY['hihat-closed']);
    expect(kick.length).toBeLessThan(hihat.length);
  });

  it('קיק נוחת רק על פעימות', () => {
    for (const selection of applyRhythmPolicy(DENSE_CANDIDATES, DRUM_PIECE_POLICY.kick)) {
      expect(selection.column % 4).toBe(0);
    }
  });

  it('סנר נוחת רק על 2 ו-4 (הבקביט)', () => {
    for (const selection of applyRhythmPolicy(DENSE_CANDIDATES, DRUM_PIECE_POLICY.snare)) {
      expect([4, 12]).toContain(selection.column % 16);
    }
  });

  it('קראש לכל היותר פעם אחת בבר, ורק בתחילתו', () => {
    const crash = applyRhythmPolicy(DENSE_CANDIDATES, DRUM_PIECE_POLICY.crash);
    for (const selection of crash) {
      expect(selection.column % 16).toBe(0);
    }
    expect(crash.length).toBeLessThanOrEqual(4);
  });

  it('בס דליל מליד — תפקידים שונים על אותו ציור', () => {
    const bass = applyRhythmPolicy(DENSE_CANDIDATES, DEFAULT_ROLE_POLICY.bass);
    const lead = applyRhythmPolicy(DENSE_CANDIDATES, DEFAULT_ROLE_POLICY.lead);
    expect(bass.length).toBeLessThan(lead.length);
  });
});

describe('תקרות ורצפות', () => {
  it('תקרת מכות-לבר נאכפת', () => {
    const kept = applyRhythmPolicy(DENSE_CANDIDATES, DEFAULT_ROLE_POLICY.lead);
    const perBar = new Map<number, number>();
    for (const selection of kept) {
      const bar = Math.floor(selection.column / 16);
      perBar.set(bar, (perBar.get(bar) ?? 0) + 1);
    }
    for (const count of perBar.values()) {
      expect(count).toBeLessThanOrEqual(DEFAULT_ROLE_POLICY.lead.maxHitsPerBar);
    }
  });

  it('מרווח מינימלי נאכף', () => {
    const kept = applyRhythmPolicy(DENSE_CANDIDATES, DRUM_PIECE_POLICY.kick);
    for (let index = 1; index < kept.length; index += 1) {
      const gap = (kept[index]?.column ?? 0) - (kept[index - 1]?.column ?? 0);
      expect(gap).toBeGreaterThanOrEqual(DRUM_PIECE_POLICY.kick.minGapSteps);
    }
  });

  it('הבחירה מעדיפה את האירועים החזקים', () => {
    const candidates: PolicyCandidate[] = [
      { column: 0, strength: 0.2 },
      { column: 8, strength: 0.9 },
    ];
    const kept = applyRhythmPolicy(candidates, {
      snapToleranceSteps: 0,
      minGapSteps: 16,
      minStrength: 0,
      maxHitsPerBar: 1,
    });
    expect(kept).toHaveLength(1);
    expect(kept[0]?.column).toBe(8);
  });

  it('רצפת-צפיפות מרפה מדיניות הדוקה במקום להשאיר שקט', () => {
    // אירוע יחיד וחלש, הרחק מכל פעימה מותרת — מדיניות הקיק הייתה משמיטה אותו לגמרי.
    const sparse: PolicyCandidate[] = [{ column: 7, strength: 0.05 }];
    expect(applyRhythmPolicy(sparse, DRUM_PIECE_POLICY.kick)).toHaveLength(0);
    expect(applyPolicyWithFloor(sparse, DRUM_PIECE_POLICY.kick, 1).length).toBeGreaterThan(0);
  });
});

describe('resolveRolePolicy', () => {
  it('בלי דריסה מחזיר את ברירת המחדל', () => {
    expect(resolveRolePolicy('lead')).toEqual(DEFAULT_ROLE_POLICY.lead);
  });

  it('דריסה מהסגנון ממוזגת מעל ברירת המחדל', () => {
    const resolved = resolveRolePolicy('lead', { lead: { maxHitsPerBar: 3 } });
    expect(resolved.maxHitsPerBar).toBe(3);
    expect(resolved.minGapSteps).toBe(DEFAULT_ROLE_POLICY.lead.minGapSteps);
  });
});
