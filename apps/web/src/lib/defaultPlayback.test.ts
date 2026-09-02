/**
 * @file        defaultPlayback.test.ts
 * @description ⭐ 2026-09-01: מה שכפתור **Play** באמת מריץ, בכל סגנון, בברירת מחדל.
 * @author      Soundiform
 * @created     2026-09-01
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **למה זה לא כפילות של samplerAssets.test.ts.** הבדיקה ההיא מצליבה את מה ש**מוצהר**
 * בחבילות-הסגנון מול הדיסק. הבדיקה הזו מצליבה את מה ש**נפתר בזמן ריצה** — וזה לא אותו דבר
 * מאז ש-autoSelectDrumKit בוחר ערכה בעצמו: הערכה לא מוצהרת בשום בחירה של המשתמש, היא נבחרת
 * בקוד. אם קובץ שלה חסר, `DrumKitProvider.load` **זורק**, הרינדור נופל, ו-Play פשוט לא
 * עובד — בלי ששום דבר אחר ייכשל קודם.
 */

import { describe, expect, it } from 'vitest';
import { composeMusicalScore, geometryToMusic } from '@soundiform/core';
import { loadAllGenrePacks } from '@soundiform/genres';
import { toCompositionConfig, toGenreAudioConfig } from '@/lib/genreAdapter';

const shape = {
  version: '1.0.0',
  paths: [
    {
      points: [0.9, 0.6, 0.3, 0.1, 0.35, 0.7, 0.2, 0.8, 0.4].map((y, i) => ({ x: i / 8, y })),
      closed: false,
    },
  ],
};

describe('the exact chain Play runs', () => {
  it('every genre composes a score and an audio config without throwing', () => {
    for (const pack of loadAllGenrePacks()) {
      const intent = geometryToMusic(shape as never, `play-${pack.id}`);
      const score = composeMusicalScore(intent, toCompositionConfig(pack));
      const cfg = toGenreAudioConfig(pack, intent.seed);
      expect(score.tracks.length, pack.id).toBeGreaterThan(0);
      const total = score.tracks.reduce((s, t) => s + t.notes.length, 0);
      expect(total, pack.id).toBeGreaterThan(0);
      const samplers = Object.values(cfg.samplerPresets ?? {}).flat();
      const kits = Object.values(cfg.drumKitPresets ?? {});
      console.log(
        `${pack.id.padEnd(10)} tracks=${String(score.tracks.length)} notes=${String(total)} ` +
          `samplers=[${samplers.map((s) => s.instrumentId).join(',') || '-'}] kits=[${kits.map((k) => k.instrumentId).join(',') || '-'}]`,
      );
    }
  });

  it('every asset the default config needs exists on disk', async () => {
    const { existsSync } = await import('node:fs');
    const root = 'public/samples';
    const missing: string[] = [];
    for (const pack of loadAllGenrePacks()) {
      const intent = geometryToMusic(shape as never, `play-${pack.id}`);
      const cfg = toGenreAudioConfig(pack, intent.seed);
      for (const preset of Object.values(cfg.samplerPresets ?? {}).flat()) {
        for (const note of preset.notes) {
          const path = `${root}/${preset.instrumentId}/${note}.${preset.extension ?? 'mp3'}`;
          if (!existsSync(path)) missing.push(`${pack.id}: ${path}`);
        }
      }
      for (const kit of Object.values(cfg.drumKitPresets ?? {})) {
        for (const piece of kit.pieces) {
          const path = `${root}/${kit.instrumentId}/${piece}.${kit.extension ?? 'mp3'}`;
          if (!existsSync(path)) missing.push(`${pack.id}: ${path}`);
        }
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });
});
