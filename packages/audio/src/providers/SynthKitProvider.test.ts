/**
 * @file        SynthKitProvider.test.ts
 * @description ⭐ 2026-09-28 (ערכת-תופים מסונתזת): רינדור-אמת (לא בדיקה-טהורה) — הדפוס
 *              כאן דומה יותר ל-SynthProvider.test.ts/SynthProviderScheduling.test.ts מאשר
 *              ל-DrumKitProvider.test.ts: אין כאן לוגיקה טהורה-מבודדת שווה-בדיקה (parsePieceKey
 *              וכו'), ההתנהגות המהותית *היא* בניית-הגרף/דיספאצ'-לפי-חלק דרך Tone.js.
 * @author      Soundiform
 * @created     2026-09-28
 */

import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@soundiform/core';
import { renderToBuffer } from '../render/serverRenderer';
import type { GenreAudioConfig } from '../render/sharedScheduling';
import type { SynthKitPresetConfig } from './SynthKitProvider';

// ⚠️ תו קצר בבאפר-בר-שלם (2s ב-120bpm) מדולל ע"י RMS על פני כל הבאפר — אותו לקח כמו
// "hypno-blip" (techno.json) — שיא הוא אות "יש קול" יציב יותר לתו טרנזיינטי בודד.
function peak(samples: Float32Array): number {
  let max = 0;
  for (const sample of samples) max = Math.max(max, Math.abs(sample));
  return max;
}

/** ⚠️ `noUncheckedIndexedAccess` הופך גישת-מערך ל-`T | undefined` — ערוץ ריק בפועל אמור
 * ליפול ממילא על ה-`peak`/הבדיקות למטה, אז מערך ריק הוא ברירת-מחדל בטוחה כאן, לא `!`. */
function channel0(buffer: { channels: Float32Array[] }): Float32Array {
  return buffer.channels[0] ?? new Float32Array(0);
}

// ⚠️ pitch=45 (≈92Hz, PREVIEW_PITCH.drums ב-usePreviewSound.ts) — פילטר תלול יחסית לתדר-
// היסוד הזה יכול להשאיר כמעט כלום (אותה בעיה שכבר נתקלנו בה עם hypno-blip/techno.json).
// שני הפריסטים כאן מכוונים לגובה הזה במפורש, לא רק "קיק/היי-האט טיפוסיים".
const TEST_KIT: SynthKitPresetConfig = {
  pieces: {
    kick: {
      oscillatorType: 'sine',
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.08 },
      polyphonic: false,
    },
    'hihat-closed': {
      oscillatorType: 'square',
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
      polyphonic: false,
      filter: { type: 'highpass', frequencyHz: 700 },
    },
  },
};

function makeScore(notes: MusicalScore['tracks'][number]['notes']): MusicalScore {
  return {
    version: '1.0.0',
    seed: 'synth-kit-test',
    tempo: 120,
    timeSignature: [4, 4],
    key: { root: 0, mode: 'aeolian' },
    genreId: 'test',
    durationBars: 1,
    tracks: [
      {
        role: 'drums',
        instrumentId: 'test-synth-kit',
        notes,
        mixSettings: { volume: 1, pan: 0, reverbSend: 0, delaySend: 0 },
      },
    ],
    sections: [{ name: 'loop', startBar: 0, lengthBars: 1 }],
    metadata: { avgNoteDensity: 1, dominantMode: 'aeolian', rootFrequencyHz: 220 },
  };
}

function cfg(kit: SynthKitPresetConfig): GenreAudioConfig {
  return {
    synthPresets: {},
    synthKitPresets: { drums: kit },
    mixCharacter: { reverbDecaySeconds: 0.1, delayTime: '8n', delayFeedback: 0 },
  };
}

describe('SynthKitProvider — דיספאצ׳ אמיתי לפי חלק-ערכה', () => {
  it('שני חלקים באותו pitch מייצרים אודיו שונה בפועל (גוון, לא רק פיץ׳)', async () => {
    const kickScore = makeScore([{ startTick: 0, durationTicks: 240, pitch: 45, velocity: 1, drumPiece: 'kick' }]);
    const hatScore = makeScore([
      { startTick: 0, durationTicks: 240, pitch: 45, velocity: 1, drumPiece: 'hihat-closed' },
    ]);
    const kickBuffer = await renderToBuffer(kickScore, cfg(TEST_KIT));
    const hatBuffer = await renderToBuffer(hatScore, cfg(TEST_KIT));

    const kickSamples = channel0(kickBuffer);
    const hatSamples = channel0(hatBuffer);
    // ⚠️ סף נמוך בכוונה: נמדד אמפירית מול הפריסט-הקיים-בפרודקשן (house.json synthMap.drums,
    // אותה מעטפת sustain=0 קצרה) שגם הוא מודד peak~0.0045 בפיץ' נמוך — מעטפת קצרה על אוסצילטור
    // נמוך-תדר מטבעה לא מגיעה לשיא גבוה (המעטפת דועכת לפני שהגל השלים אפילו מחזור אחד).
    expect(peak(kickSamples)).toBeGreaterThan(0.002);
    expect(peak(hatSamples)).toBeGreaterThan(0.002);

    // ⚠️ לא משווים רק RMS (יכול להיות דומה במקרה) — משווים את הצורה עצמה. גל-סינוס דרך
    // lowpass וגל-ריבוע דרך highpass לא אמורים לצאת קרובים כלל, דגימה-דגימה.
    let sumSquaredDiff = 0;
    const len = Math.min(kickSamples.length, hatSamples.length);
    for (let index = 0; index < len; index += 1) {
      const diff = (kickSamples[index] ?? 0) - (hatSamples[index] ?? 0);
      sumSquaredDiff += diff * diff;
    }
    const diffRms = Math.sqrt(sumSquaredDiff / len);
    expect(diffRms).toBeGreaterThan(0.001);
  });

  it('חלק שלא הוגדר בערכה נופל לחלק ברירת-מחדל, לא נעלם בשקט', async () => {
    const score = makeScore([
      { startTick: 0, durationTicks: 240, pitch: 45, velocity: 1, drumPiece: 'crash' },
    ]);
    const buffer = await renderToBuffer(score, cfg(TEST_KIT));
    expect(peak(channel0(buffer))).toBeGreaterThan(0.002);
  });

  it('מכות צפופות על אותו חלק לא מפילות את הרינדור (הגנת-מרווח-מינימלי)', async () => {
    const notes = Array.from({ length: 16 }, (_, index) => ({
      startTick: index * 30, // צפוף בכוונה — הרבה מתחת לסף המקטין (0.012s ≈ ~576 טיקים ב-120bpm)
      durationTicks: 20,
      pitch: 45,
      velocity: 1,
      drumPiece: 'kick' as const,
    }));
    const score = makeScore(notes);
    await expect(renderToBuffer(score, cfg(TEST_KIT))).resolves.toBeDefined();
  });
});
