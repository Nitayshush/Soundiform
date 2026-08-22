/**
 * @file        loader.test.ts
 * @description בדיקות יחידה לטעינת GenrePacks — כל 5 ה-packs תקפים ופעילים ב-V1.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-08-22: רגאיי הוחזר לפעיל (requiresSamples: false — קירוב סינתטי, ראה reggae.json
 * ו-PROJECT.md §5.2) אחרי שהיה מוסתר מאז Sprint 5. loadActiveGenrePacks מחזיר עכשיו 5, לא 4.
 */

import { describe, expect, it } from 'vitest';
import { loadActiveGenrePacks, loadAllGenrePacks, loadGenrePackById } from './loader';

describe('loadAllGenrePacks', () => {
  it('טוען את כל 5 הסגנונות מ-§5.2', () => {
    const packs = loadAllGenrePacks();
    const ids = packs.map((pack) => pack.id).sort();
    expect(ids).toEqual(['chill', 'cinematic', 'house', 'reggae', 'trance']);
  });

  it('לכל pack יש roles תואמים ל-synthMap ו-rhythmPatterns (אין role חסר)', () => {
    for (const pack of loadAllGenrePacks()) {
      for (const role of pack.roles) {
        expect(pack.synthMap[role], `${pack.id}: synthMap[${role}]`).toBeDefined();
        expect(pack.rhythmPatterns[role], `${pack.id}: rhythmPatterns[${role}]`).toBeDefined();
      }
    }
  });

  it('הטמפו של כל pack נמצא בתוך [min,max] של עצמו', () => {
    for (const pack of loadAllGenrePacks()) {
      expect(pack.tempo.default).toBeGreaterThanOrEqual(pack.tempo.min);
      expect(pack.tempo.default).toBeLessThanOrEqual(pack.tempo.max);
    }
  });
});

describe('loadActiveGenrePacks', () => {
  it('מחזיר את כל 5 הסגנונות פעילים (רגאיי כבר לא מוסתר — קירוב סינתטי)', () => {
    const active = loadActiveGenrePacks();
    expect(active).toHaveLength(5);
    expect(active.some((pack) => pack.id === 'reggae')).toBe(true);
  });

  it('כל הסגנונות הפעילים שונים זה מזה בטמפו ברירת המחדל או במוד (לא כפילות מקרית)', () => {
    const active = loadActiveGenrePacks();
    const signatures = new Set(
      active.map((pack) => `${String(pack.tempo.default)}-${pack.defaultMode}`),
    );
    expect(signatures.size).toBe(active.length);
  });
});

describe('loadGenrePackById', () => {
  it('מוצא pack קיים, כולל reggae (פעיל, requiresSamples: false)', () => {
    expect(loadGenrePackById('trance')?.id).toBe('trance');
    expect(loadGenrePackById('reggae')?.requiresSamples).toBe(false);
  });

  it('מחזיר null עבור id לא קיים', () => {
    expect(loadGenrePackById('does-not-exist')).toBeNull();
  });
});
