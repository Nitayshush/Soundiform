/**
 * @file        genreAdapter.test.ts
 * @description בדיקות יחידה ל-genreAdapter.ts — במיוחד מיזוג-פריסטים לבחירת-צליל מרובה
 *              (mergeSynthPresets/presetToLayers, פנימיים — נבדקים דרך toGenreAudioConfig).
 * @author      Soundiform
 * @created     2026-08-25
 */

import { describe, expect, it } from 'vitest';
import type { GenrePack } from '@soundiform/genres';
import { toGenreAudioConfig } from './genreAdapter';

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
