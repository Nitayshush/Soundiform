/**
 * @file        shapeFingerprint.test.ts
 * @description ⭐ 2026-09-01: נועל את **עקרון הליבה** — לכל ציור חותמת סאונד משלו, בכל
 *              הסגנונות. כולל רגאיי, שעד היום לא היה על המנגנון הזה.
 * @author      Soundiform
 * @created     2026-09-01
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ ניתי הגדיר את זה כהגדרת-ליבה של המוצר: "המטרה לייצר חותמת סאונד לכל ציור וצורה".
 * רגאיי היה הסגנון היחיד שנשאר על המסלול הישן (מתאר-גובה ממוצע + פרוגרסיה קבועה), ולכן
 * שני ציורים שונים בו יכלו להישמע דומים מדי. הבדיקה כאן נועלת את המעבר: אם מישהו יבטל
 * `absoluteNoteBoard` בסגנון כלשהו, זה ייפול כאן ולא אצל המשתמש.
 *
 * ⚠️ **שקט באמצע היצירה אינו כישלון של הבדיקה הזו.** צורה חלקה (עיגול) מייצרת מעט אירועים
 * גיאומטריים באמצע ולכן מעט תווים שם — זו החלטת-מוצר מפורשת: "אם יש שקט באמצע העיגול, זה
 * הסאונד שלו". לכן נבדקת **שונוּת** בין ציורים, לא צפיפות מינימלית.
 */

import { describe, expect, it } from 'vitest';
import type { ShapeData } from '@soundiform/shared';
import { composeMusicalScore, geometryToMusic, type MusicalScore } from '@soundiform/core';
import { loadAllGenrePacks } from '@soundiform/genres';
import { toCompositionConfig } from './genreAdapter';

function polygon(pointCount: number, radiusFor: (index: number) => number): ShapeData {
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = (index / pointCount) * 2 * Math.PI;
    const radius = radiusFor(index);
    return { x: 0.5 + radius * Math.cos(angle), y: 0.5 + radius * Math.sin(angle) };
  });
  return { version: '1.0.0', paths: [{ points, closed: true }] };
}

const SHAPES: readonly { name: string; shape: ShapeData }[] = [
  { name: 'circle', shape: polygon(24, () => 0.35) },
  { name: 'star', shape: polygon(40, (i) => (i % 2 === 0 ? 0.45 : 0.15)) },
  { name: 'square', shape: polygon(4, () => 0.42) },
  {
    name: 'zigzag',
    shape: {
      version: '1.0.0',
      paths: [
        {
          points: Array.from({ length: 12 }, (_, index) => ({
            x: index / 11,
            y: index % 2 === 0 ? 0.2 : 0.8,
          })),
          closed: false,
        },
      ],
    },
  },
];

/** טביעת-אצבע של היצירה: כל תו בכל טראק, זמן וגובה. */
function fingerprint(score: MusicalScore): string {
  return score.tracks
    .map(
      (track) =>
        `${track.role}:${track.notes.map((note) => `${String(note.startTick)}/${String(note.pitch)}`).join(',')}`,
    )
    .join('|');
}

describe('חותמת סאונד לכל ציור', () => {
  const packs = loadAllGenrePacks();

  it('כל הסגנונות על מנגנון הלוח האבסולוטי — כולל רגאיי', () => {
    for (const pack of packs) {
      expect(pack.absoluteNoteBoard, pack.id).toBe(true);
    }
  });

  it('בכל סגנון, ארבעה ציורים שונים נותנים ארבע יצירות שונות', () => {
    for (const pack of packs) {
      const fingerprints = SHAPES.map(({ name, shape }) => {
        const intent = geometryToMusic(shape, `fp-${pack.id}-${name}`);
        return fingerprint(composeMusicalScore(intent, toCompositionConfig(pack)));
      });
      expect(new Set(fingerprints).size, pack.id).toBe(SHAPES.length);
    }
  });

  it('הגובה נגזר מהציור: אותה צורה נותנת יותר מגובה אחד בליד', () => {
    for (const pack of packs) {
      for (const { name, shape } of SHAPES) {
        const intent = geometryToMusic(shape, `fp-${pack.id}-${name}`);
        const score = composeMusicalScore(intent, toCompositionConfig(pack));
        const lead = score.tracks.find((track) => track.role === 'lead');
        const pitches = new Set((lead?.notes ?? []).map((note) => note.pitch));
        expect(pitches.size, `${pack.id} / ${name}`).toBeGreaterThan(1);
      }
    }
  });

  it('שום צירוף של סגנון × מקצב × צורה לא מפיל את בניית היצירה', () => {
    for (const pack of packs) {
      for (const beat of pack.beatPatterns ?? []) {
        for (const { name, shape } of SHAPES) {
          const label = `${pack.id} / ${beat.id} / ${name}`;
          const intent = geometryToMusic(shape, `fp-${pack.id}-${name}`);
          expect(
            () =>
              composeMusicalScore(intent, toCompositionConfig(pack, { beatPatternId: beat.id })),
            label,
          ).not.toThrow();
        }
      }
    }
  });
});
