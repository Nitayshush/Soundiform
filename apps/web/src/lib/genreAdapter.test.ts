/**
 * @file        genreAdapter.test.ts
 * @description בדיקות יחידה ל-genreAdapter.ts — במיוחד מיזוג-פריסטים לבחירת-צליל מרובה
 *              (mergeSynthPresets/presetToLayers, פנימיים — נבדקים דרך toGenreAudioConfig).
 * @author      Soundiform
 * @created     2026-08-25
 */

import { describe, expect, it } from 'vitest';
import { composeMusicalScore, geometryToMusic } from '@soundiform/core';
import type { ShapeData } from '@soundiform/shared';
import { loadGenrePackById, type GenrePack } from '@soundiform/genres';
import { toCompositionConfig, toGenreAudioConfig } from './genreAdapter';

function makeTestPack(): GenrePack {
  return {
    id: 'test-genre',
    displayName: { he: 'בדיקה', en: 'Test' },
    tempo: { min: 100, max: 150, default: 120 },
    grid: { subdivision: 16, swingAmount: 0 },
    allowedModes: ['aeolian'],
    defaultMode: 'aeolian',
    harmonicTendency: 'modal',
    chordProgression: [0, 5, 3, 4],
    roles: ['bass'],
    rhythmPatterns: {},
    synthMap: {
      bass: {
        oscillatorType: 'sawtooth',
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 },
        polyphonic: false,
      },
    },
    soundOptions: {
      bass: [
        {
          id: 'single-layer',
          displayName: { he: 'שכבה בודדת', en: 'Single Layer' },
          preset: {
            oscillatorType: 'sine',
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 },
            polyphonic: false,
          },
        },
        {
          id: 'multi-layer',
          displayName: { he: 'רב-שכבתי', en: 'Multi Layer' },
          preset: {
            oscillatorType: 'sawtooth',
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 },
            polyphonic: true,
            layers: [
              {
                oscillatorType: 'sawtooth',
                envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 },
                gain: 1,
                detuneSemitones: 0,
              },
              {
                oscillatorType: 'square',
                envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 },
                gain: 0.5,
                detuneSemitones: -12,
              },
            ],
          },
        },
      ],
    },
    mixChain: { reverbDecaySeconds: 2, delayTime: '8n', delayFeedback: 0.3 },
    arrangement: { sectionOrder: ['loop'] },
    sidechainEnabled: false,
    requiresSamples: false,
  };
}

describe('toGenreAudioConfig — בחירת-צליל מרובה (mergeSynthPresets)', () => {
  it('בחירה בודדת: הפריסט מוחזר כמו-שהוא, בלי מיזוג', () => {
    const config = toGenreAudioConfig(makeTestPack(), 'seed', { bass: ['single-layer'] });
    expect(config.synthPresets.bass?.layers).toBeUndefined();
    expect(config.synthPresets.bass?.oscillatorType).toBe('sine');
  });

  it('כמה בחירות: השכבות של שני הפריסטים ממוזגות יחד', () => {
    const config = toGenreAudioConfig(makeTestPack(), 'seed', {
      bass: ['single-layer', 'multi-layer'],
    });
    // single-layer הופך לשכבה סינתטית אחת (presetToLayers), multi-layer תורם את שתי השכבות שלו.
    expect(config.synthPresets.bass?.layers).toHaveLength(3);
  });

  it('polyphonic=true אם כלשהו מהפריסטים הנבחרים פוליפוני', () => {
    const config = toGenreAudioConfig(makeTestPack(), 'seed', {
      bass: ['single-layer', 'multi-layer'],
    });
    expect(config.synthPresets.bass?.polyphonic).toBe(true);
  });

  it('MUTED_SOUND_OPTION_ID בתוך המערך משתיק את התפקיד לגמרי, גם עם id-ים נוספים', () => {
    const config = toGenreAudioConfig(makeTestPack(), 'seed', {
      bass: ['single-layer', '__muted__'],
    });
    expect(config.mutedRoles).toContain('bass');
  });

  it('id לא-קיים מתעלם בשקט, לא זורק — נופל לברירת-המחדל', () => {
    expect(() =>
      toGenreAudioConfig(makeTestPack(), 'seed', { bass: ['does-not-exist'] }),
    ).not.toThrow();
  });
});

/**
 * ⭐ 2026-08-28 (הסבב המבני לסאונד בנייד) — תקציב-האוסצילטורים (applyOscillatorBudget).
 * הרקע: מדידה על מנוע-הרינדור הראתה שהעלות כמעט-לינארית במספר האוסצילטורים הכולל, ושבחירת
 * 4 צלילים לכל תפקיד מגיעה ל-136 אוסצילטורים — פי 6.5 מצליל בודד, ומעבר ליכולת של נייד.
 * הדרישה המוזיקלית (מפורשות מהמשתמש): **כל הצלילים שנבחרו חייבים להמשיך להתנגן יחד** —
 * אסור להשתיק/לסובב ביניהם. לכן הקיצוץ הוא ב"עובי" (unison) בלבד, יחסית, עם רצפה של 1.
 */
describe('toGenreAudioConfig — תקציב-אוסצילטורים בערימת-צלילים', () => {
  const WIDE_ENVELOPE = { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 };

  /** בונה pack עם N אופציות-צליל זהות ורחבות ל-role נתון. */
  function makeHeavyPack(role: 'lead' | 'pad', count: number, polyphonic: boolean): GenrePack {
    const base = makeTestPack();
    return {
      ...base,
      roles: [role],
      synthMap: {
        [role]: { oscillatorType: 'sawtooth', envelope: WIDE_ENVELOPE, polyphonic },
      },
      soundOptions: {
        [role]: Array.from({ length: count }, (_, index) => ({
          id: `wide-${String(index)}`,
          displayName: { he: `רחב ${String(index)}`, en: `Wide ${String(index)}` },
          preset: {
            oscillatorType: 'sawtooth' as const,
            envelope: WIDE_ENVELOPE,
            polyphonic,
            unison: { count: 9, spreadCents: 30 },
          },
        })),
      },
    };
  }

  function totalOscillators(preset: { layers?: { unison?: { count: number } }[] } | undefined) {
    return (preset?.layers ?? []).reduce((sum, layer) => sum + (layer.unison?.count ?? 2), 0);
  }

  it('בחירה בודדת כבדה (9 אוסצילטורים, מונופוני) לא נוגעים בה — התקציב לא מתערב', () => {
    const config = toGenreAudioConfig(makeHeavyPack('lead', 4, false), 'seed', {
      lead: ['wide-0'],
    });
    // בחירה בודדת מוחזרת כמו-שהיא (בלי layers בכלל), בדיוק כמו קודם.
    expect(config.synthPresets.lead?.layers).toBeUndefined();
    expect(config.synthPresets.lead?.unison?.count).toBe(9);
  });

  /** מה שהיה נוצר בלי תקציב בכלל: 4 צלילים × unison 9. */
  const UNBUDGETED_STACK_OSCILLATORS = 4 * 9;

  it('ערימה מונופונית חורגת מוקטנת — אבל כל צליל שנבחר עדיין מיוצג בשכבה משלו', () => {
    const config = toGenreAudioConfig(makeHeavyPack('lead', 4, false), 'seed', {
      lead: ['wide-0', 'wide-1', 'wide-2', 'wide-3'],
    });
    const preset = config.synthPresets.lead;
    expect(preset?.layers).toHaveLength(4); // אף צליל שנבחר לא נעלם
    expect(totalOscillators(preset)).toBeLessThan(UNBUDGETED_STACK_OSCILLATORS);
    for (const layer of preset?.layers ?? []) {
      expect(layer.unison?.count).toBeGreaterThanOrEqual(1);
    }
  });

  it('ערימה פוליפונית מוקטנת חזק יותר ממונופונית — אקורד מכפיל את העלות בפועל', () => {
    const selection = ['wide-0', 'wide-1', 'wide-2', 'wide-3'];
    const mono = toGenreAudioConfig(makeHeavyPack('lead', 4, false), 'seed', { lead: selection });
    const poly = toGenreAudioConfig(makeHeavyPack('pad', 4, true), 'seed', { pad: selection });

    expect(poly.synthPresets.pad?.polyphonic).toBe(true);
    expect(poly.synthPresets.pad?.layers).toHaveLength(4);
    // ⭐ זו הנקודה המהותית: אותה ערימה בדיוק, אבל פוליפונית — חייבת לצאת דקה יותר, כי כל
    // שכבה שלה תתנגן על כל תו באקורד. בלי המשקל הזה התקציב היה "מתמחר" פאד בזול ולא נוגע
    // בדיוק בתפקיד היקר ביותר (מדידה: הפאד היה 80 מתוך 136 האוסצילטורים).
    expect(totalOscillators(poly.synthPresets.pad)).toBeLessThan(
      totalOscillators(mono.synthPresets.lead),
    );
  });

  it('ערימה קיצונית: אף שכבה לא יורדת מתחת לאוסצילטור אחד (צליל נבחר לא נעלם)', () => {
    const config = toGenreAudioConfig(makeHeavyPack('pad', 8, true), 'seed', {
      pad: Array.from({ length: 8 }, (_, index) => `wide-${String(index)}`),
    });
    const preset = config.synthPresets.pad;
    expect(preset?.layers).toHaveLength(8);
    for (const layer of preset?.layers ?? []) {
      expect(layer.unison?.count).toBeGreaterThanOrEqual(1);
    }
  });
});

/** צורה חדה/מורכבת במיוחד — הרבה קודקודים חדים לאורך כל הצורה, לא רק כמה. בדיוק המקרה
 * שדווח כ"קליטק/חירחורים": ציור מלא-פינות אמור לדחוף את cornerHint גבוה על פני הרבה נקודות
 * לאורך כל הלולאה, לא רק בכמה מקומות בודדים. */
function makeSpikyShapeData(): ShapeData {
  const pointCount = 40;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = (index / pointCount) * 2 * Math.PI;
    const radius = index % 2 === 0 ? 0.45 : 0.15; // כוכב חד — קפיצה חדה בכל נקודה שנייה
    return {
      x: 0.5 + radius * Math.cos(angle),
      y: 0.5 + radius * Math.sin(angle),
    };
  });
  return { version: '1.0.0', paths: [{ points, closed: true }] };
}

describe("composeMusicalScore + genreAdapter — תיקון-ביצועים עם תוכן-ז'אנר אמיתי (לא סינתטי)", () => {
  it('צורה חדה-במיוחד + פאק trance האמיתי (packages/genres) → צפיפות-תופים עדיין חסומה', () => {
    const trancePack = loadGenrePackById('trance');
    expect(trancePack).not.toBeNull();
    if (!trancePack) {
      return;
    }

    const shape = makeSpikyShapeData();
    const intent = geometryToMusic(shape, 'seed-spiky-real-content');
    const score = composeMusicalScore(intent, toCompositionConfig(trancePack));

    const drumsTrack = score.tracks.find((track) => track.role === 'drums');
    expect(drumsTrack?.notes.length ?? 0).toBeGreaterThan(0);

    // ⚠️ 'build' מקבל מילוי-כל-step מכוון (buildBuildSectionNotes, ותיק — לא תלוי ב-
    // cornerHint) — 16/בר שם זה נכון-בכוונה, לא מה שנבדק כאן. משתמשים ב-loop הארוך-ביותר
    // כמדד הכי-נקי לצפיפות התלויה-בקורנר; טולרנס קטן (לא שוויון מדויק) כי הומניזציה יכולה
    // להזיז תו-גבול בכמה טיקים לתוך/מחוץ לטווח (ראה groove/humanize.ts).
    const loopSection = score.sections.find((section) => section.name === 'loop');
    expect(loopSection).toBeDefined();
    const loopStartTick = (loopSection?.startBar ?? 0) * 4 * 480;
    const loopEndTick = loopStartTick + (loopSection?.lengthBars ?? 0) * 4 * 480;
    const loopNotes = (drumsTrack?.notes ?? []).filter(
      (note) => note.startTick >= loopStartTick && note.startTick < loopEndTick,
    );
    const notesPerBar = loopNotes.length / (loopSection?.lengthBars ?? 1);
    // ⚠️ התקרה המדויקת (4 בסיס + עד 3 נוספות = 7/בר) מאומתת ב-harmonyEngine.test.ts's ייעודי
    // (intent סינתטי, בלי רעש-גבולות). כאן, עם intent אמיתי מ-geometryToMusic ותוכן-ז'אנר
    // אמיתי, מספיק להראות שהצפיפות עדיין *באותו סדר-גודל* — רחוק מ-16/בר (המצב הישן, ללא תקרה).
    expect(notesPerBar).toBeLessThanOrEqual(8);
  });
});
