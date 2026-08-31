/**
 * @file        beatKitSelection.test.ts
 * @description ⭐ 2026-08-31: רגרסיה — **מקצב ידני מחייב ערכת תופים**.
 *
 *              ⚠️ הבאג שנתפס בבדיקה חיה ("אין קיקים שמפוצצים את המוח, לא ברור"): ברירת
 *              המחדל לתופים בטראנס/האוס היא פריסט **סינת'**, ו-`SynthProvider` מתעלם
 *              מ-`drumPiece` לגמרי. כלומר תבנית-ביט שאומרת "קיק ב-1, מחיאה ב-2, היי-האט
 *              בשמינית" הושמעה כ**אותו צליל סינת' בגבהים שונים** — בלי קיק, בלי מחיאה, בלי
 *              היי-האט. המשתמש שמע ביפ אחיד וחשב שהתופים חלשים; הם פשוט לא היו תופים.
 * @author      Soundiform
 * @created     2026-08-31
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import { loadAllGenrePacks, loadGenrePackById } from '@soundiform/genres';
import { toGenreAudioConfig } from './genreAdapter';

describe('בחירת ערכה אוטומטית כשנבחר מקצב', () => {
  it('בכל סגנון שיש בו מקצבים — בחירת מקצב מביאה ערכה', () => {
    for (const pack of loadAllGenrePacks()) {
      const firstBeat = pack.beatPatterns?.[0]?.id;
      if (!firstBeat) {
        continue;
      }
      const config = toGenreAudioConfig(pack, 'seed', undefined, firstBeat);
      expect(config.drumKitPresets?.drums, `${pack.id} עם מקצב`).toBeDefined();
    }
  });

  it('הסינת׳ של התופים מוסר — אחרת הביפ ממשיך להישמע מתחת לערכה', () => {
    const pack = loadGenrePackById('trance');
    expect(pack).not.toBeNull();
    const config = toGenreAudioConfig(pack!, 'seed', undefined, pack!.beatPatterns?.[0]?.id);
    expect(config.synthPresets.drums).toBeUndefined();
  });

  it('בלי מקצב — שום דבר לא משתנה, הסינת׳ נשאר וערכה לא נטענת', () => {
    const pack = loadGenrePackById('trance');
    const config = toGenreAudioConfig(pack!, 'seed', undefined, undefined);
    expect(config.drumKitPresets?.drums).toBeUndefined();
    expect(config.synthPresets.drums).toBeDefined();
  });

  it('בחירה מפורשת של המשתמש גוברת על הבחירה האוטומטית', () => {
    const pack = loadGenrePackById('trance');
    const chosen = pack!.soundOptions?.drums?.find((option) => option.id === 'acoustic-kit');
    expect(chosen, 'acoustic-kit חייב להישאר זמין כאופציה').toBeDefined();
    const config = toGenreAudioConfig(
      pack!,
      'seed',
      { drums: ['acoustic-kit'] },
      pack!.beatPatterns?.[0]?.id,
    );
    expect(config.drumKitPresets?.drums?.instrumentId).toBe('acoustic-kit');
  });

  it('טראנס והאוס בוחרים את הערכה האלקטרונית, לא את האקוסטית', () => {
    // ⚠️ נמדד: הקיק האקוסטי הוא תוף-בס קונצרטי — התקפה 25ms ויחס sub/lowMid של 0.86.
    // הוא לא קיק ריקוד בשום עוצמה. האלקטרוני: התקפה 1.5ms, יחס 2.37.
    for (const genreId of ['trance', 'house']) {
      const pack = loadGenrePackById(genreId);
      const config = toGenreAudioConfig(pack!, 'seed', undefined, pack!.beatPatterns?.[0]?.id);
      expect(config.drumKitPresets?.drums?.instrumentId, genreId).toBe('electronic-kit');
    }
  });
});
