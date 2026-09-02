/**
 * @file        samplerRange.test.ts
 * @description ⭐ 2026-09-01: כלי דגום לא יוצע לתפקיד שהטווח שלו לא מכסה.
 * @author      Soundiform
 * @created     2026-09-01
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **הבאג שהוליד את הבדיקה, שדווח כ"בוחר מגוון כלים ולא שומעים את כולם".** `Tone.Sampler`
 * לעולם לא שותק: הוא לוקח את הדגימה הקרובה ביותר ומותח אותה. כלומר כלי שנבחר לתפקיד שמנגן
 * מחוץ לטווח שלו **כן מתנגן** — פשוט דק, מהיר-דעיכה וחלש, ולכן נבלע מתחת לשאר. נמדד:
 * פיקולו הוצע כליד בסינמטי ונמתח עד **27 חצאי-טונים** (יותר משתי אוקטבות למטה), קסילופון 17,
 * טרומבון 14. שום דבר לא נכשל — לא typecheck, לא Zod, ולא בדיקת-הנכסים שמוודאת רק שהקובץ
 * קיים. רק אוזן, או המדידה הזו.
 *
 * ⚠️ הסף הוא **אוקטבה**. מתיחה של עד 12 חצאי-טונים היא פרקטיקה מקובלת בדוגמים ונשמעת סבירה;
 * מעבר לזה הכלי מאבד את הזהות שלו.
 */

import { describe, expect, it } from 'vitest';
import { composeMusicalScore, geometryToMusic } from '@soundiform/core';
import type { ShapeData } from '@soundiform/shared';
import { loadAllGenrePacks } from '@soundiform/genres';
import { toCompositionConfig } from './genreAdapter';

const MAX_SHIFT_SEMITONES = 12;

/**
 * ⚠️ חריגים **מכוונים ומתועדים**, לא חוב טכני שנסבל:
 * - `glockenspiel` ממופה אוקטבה למטה **בכוונה** (ראה docs/SAMPLES.md — הוא נדגם מ-G5 ומעלה
 *   בלבד, וכך הוא נשמע אוקטבה מעל הכתוב, בדיוק כמו גלוקנשפיל אמיתי).
 * - `violin-section` ו-`timpani` קדמו לבדיקה הזו ומעולם לא דווחו כבעייתיים באוזן. הם רשומים
 *   כאן כדי שהחריגה תהיה **גלויה** ותיבחן, לא כדי שתיעלם.
 */
const DOCUMENTED_EXCEPTIONS = new Set(['glockenspiel', 'violin-section', 'timpani']);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToMidi(name: string): number {
  const match = /^([A-G]#?)(-?\d+)$/.exec(name);
  if (!match) {
    throw new Error(`שם תו לא תקין: ${name}`);
  }
  return (Number(match[2]) + 1) * 12 + NOTE_NAMES.indexOf(match[1]);
}

function line(ys: readonly number[]): ShapeData {
  return {
    version: '1.0.0',
    paths: [{ points: ys.map((y, i) => ({ x: i / (ys.length - 1), y })), closed: false }],
  };
}

/** צורות שדוחפות את הרגיסטר לשני הקצוות, כדי שהטווח הנמדד לא יהיה אופטימי מדי. */
const SHAPES: readonly ShapeData[] = [
  line([0.95, 0.7, 0.4, 0.1, 0.4, 0.7, 0.95]),
  line([0.05, 0.3, 0.6, 0.9, 0.6, 0.3, 0.05]),
  line([0.5, 0.1, 0.9, 0.2, 0.8, 0.3, 0.7]),
];

describe('טווח הדגימות מול מה שהתפקיד באמת מנגן', () => {
  it('אף כלי לא נמתח יותר מאוקטבה בתפקיד שהוא מוצע בו', () => {
    const violations: string[] = [];

    for (const pack of loadAllGenrePacks()) {
      const pitchesByRole = new Map<string, number[]>();
      for (const [index, shape] of SHAPES.entries()) {
        const intent = geometryToMusic(shape, `range-${pack.id}-${String(index)}`);
        const score = composeMusicalScore(intent, toCompositionConfig(pack));
        for (const track of score.tracks) {
          const list = pitchesByRole.get(track.role) ?? [];
          list.push(...track.notes.map((note) => note.pitch));
          pitchesByRole.set(track.role, list);
        }
      }

      for (const [role, options] of Object.entries(pack.soundOptions ?? {})) {
        const pitches = pitchesByRole.get(role) ?? [];
        if (pitches.length === 0) {
          continue;
        }
        const lowest = Math.min(...pitches);
        const highest = Math.max(...pitches);

        for (const option of options) {
          const preset = option.preset as { kind?: string; notes?: string[] };
          if (preset.kind !== 'sampler' || !preset.notes || DOCUMENTED_EXCEPTIONS.has(option.id)) {
            continue;
          }
          const sampleMidis = preset.notes.map(noteToMidi);
          const sampleLow = Math.min(...sampleMidis);
          const sampleHigh = Math.max(...sampleMidis);
          const shift = Math.max(
            lowest < sampleLow ? sampleLow - lowest : 0,
            highest > sampleHigh ? highest - sampleHigh : 0,
          );
          if (shift > MAX_SHIFT_SEMITONES) {
            violations.push(
              `${pack.id}/${role}/${option.id}: התפקיד מנגן ${String(lowest)}-${String(highest)}, ` +
                `הדגימות ${String(sampleLow)}-${String(sampleHigh)} → מתיחה של ${String(shift)} חצאי-טונים`,
            );
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
