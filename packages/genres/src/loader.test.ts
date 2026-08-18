/**
 * @file        loader.test.ts
 * @description בדיקות יחידה לטעינת GenrePacks — כל 5 ה-packs תקפים, reggae מוסתר ב-V1.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
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
  it('מחזיר בדיוק 4 סגנונות פעילים (reggae מוסתר — requiresSamples)', () => {
    const active = loadActiveGenrePacks();
    expect(active).toHaveLength(4);
    expect(active.some((pack) => pack.id === 'reggae')).toBe(false);
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
  it('מוצא pack קיים, כולל reggae (לא-פעיל, אבל בר-אחזור לצרכים פנימיים)', () => {
    expect(loadGenrePackById('trance')?.id).toBe('trance');
    expect(loadGenrePackById('reggae')?.requiresSamples).toBe(true);
  });

  it('מחזיר null עבור id לא קיים', () => {
    expect(loadGenrePackById('does-not-exist')).toBeNull();
  });
});
