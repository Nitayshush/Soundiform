/**
 * @file        mixChain.ts
 * @description שרשרת מיקס לכל טראק — send-amounts מ-Track.mixSettings (§4.6, כמה reverb/delay),
 *              אופי האפקט (משך ריוורב, זמן/פידבק דיליי) מ-MixCharacterConfig של הסגנון.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⭐ Sprint 5: MixCharacterConfig מגיע מ-GenrePack.mixChain (§5.1) — packages/audio לא יכול
 * לייבא GenrePack ישירות (§3: audio → core, shared בלבד), אז apps/web ממיר. בלי קונפיג
 * מפורש נופלים ל-DEFAULT_MIX_CHARACTER.
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * מבנה השרשרת לכל טראק:
 *   instrument.output → panner ─────────────────────────→ outputGain → destination (master)
 *                              ├─ reverbSendGain → reverb ↗
 *                              └─ delaySendGain  → delay  ↗
 * reverb/delay נוצרים רק אם ה-send המתאים גדול מאפס — נמנע מיצירת Reverb (יקר, אסינכרוני)
 * לטראקים כמו בס שאין להם שום send.
 */

import { FeedbackDelay, Gain, Panner, Reverb } from 'tone';
import type { InputNode } from 'tone';
import type { MixSettings } from '@shape-sound/core';

export interface MixCharacterConfig {
  reverbDecaySeconds: number;
  /** בתחביר זמן של Tone.js, למשל "8n". */
  delayTime: string;
  delayFeedback: number;
}

export const DEFAULT_MIX_CHARACTER: MixCharacterConfig = {
  reverbDecaySeconds: 2,
  delayTime: '8n',
  delayFeedback: 0.25,
};

/** מתחת לסף הזה, send נחשב "כבוי" — לא שווה להקים אפקט (עלות CPU/זמן ready של Reverb). */
const SEND_EPSILON = 0.001;

export interface MixChainHandle {
  /** נקודת החיבור עבור instrumentProvider.output.connect(mixChain.input). */
  readonly input: InputNode;
  dispose(): void;
}

/**
 * בונה שרשרת מיקס עבור טראק בודד ומחבר אותה ל-destination (בדרך כלל אפיק המאסטר).
 * אסינכרוני כי Tone.Reverb מייצר Impulse Response ברקע (`reverb.ready`).
 */
export async function buildMixChain(
  mixSettings: MixSettings,
  destination: InputNode,
  character: MixCharacterConfig = DEFAULT_MIX_CHARACTER,
): Promise<MixChainHandle> {
  const panner = new Panner(mixSettings.pan);
  const outputGain = new Gain(mixSettings.volume);
  panner.connect(outputGain);
  outputGain.connect(destination);

  const disposables: { dispose(): void }[] = [panner, outputGain];
  const readyPromises: Promise<void>[] = [];

  if (mixSettings.reverbSend > SEND_EPSILON) {
    const reverb = new Reverb(character.reverbDecaySeconds);
    const reverbSendGain = new Gain(mixSettings.reverbSend);
    panner.connect(reverbSendGain);
    reverbSendGain.connect(reverb);
    reverb.connect(outputGain);
    disposables.push(reverb, reverbSendGain);
    readyPromises.push(reverb.ready);
  }

  if (mixSettings.delaySend > SEND_EPSILON) {
    const delay = new FeedbackDelay(character.delayTime, character.delayFeedback);
    const delaySendGain = new Gain(mixSettings.delaySend);
    panner.connect(delaySendGain);
    delaySendGain.connect(delay);
    delay.connect(outputGain);
    disposables.push(delay, delaySendGain);
  }

  await Promise.all(readyPromises);

  return {
    input: panner,
    dispose: () => {
      disposables.forEach((node) => {
        node.dispose();
      });
    },
  };
}
